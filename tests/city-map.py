"""Browser regression: real city boundaries/snapshot, isolated old cache/local data.
No field-verification claim. Fixtures are only legacy local records and offline mode.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = json.loads((ROOT/'data/osm-snapshot.json').read_text(encoding='utf-8'))
COUNT = len(SNAPSHOT['elements'])
OLD_AUDITS = json.dumps([{'id':'fixture-audit','locationId':'custom-outside','status':'approved'}])
CUSTOM = json.dumps([
    {'id':'custom-inside','name':'Fixture in Jakarta','lat':-6.1876872,'lng':106.823756,'category':'tactile_paving','source':'Admin lokal','attributes':{'tactile_paving':True}},
    {'id':'custom-outside','name':'Fixture in Cibitung','lat':-6.2618245,'lng':107.0837982,'category':'tactile_paving','source':'Admin lokal','attributes':{'tactile_paving':True}},
])
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1440,'height':960})
    context.add_init_script("""(() => {
      if (sessionStorage.getItem('fixture-initialized')) return;
      sessionStorage.setItem('fixture-initialized','true');
      localStorage.setItem('akseskota_audits', %s);
      localStorage.setItem('akseskota_admin_custom', %s);
      const old = {cachedAt:Date.now(),venues:[{id:'old-cibitung',name:'Cibitung',lat:-6.2618245,lng:107.0837982,category:'wheelchair_place',attributes:{wheelchair_access:true}}]};
      for (const key of ['akseskota_osm_real_v3','akseskota_osm_jakarta_bekasi_v5','akseskota_osm_jakarta_bekasi_no_lifts_v6']) localStorage.setItem(key, JSON.stringify(old));
    })();""" % (json.dumps(OLD_AUDITS), json.dumps(CUSTOM)))
    page = context.new_page()
    errors = []
    page.on('pageerror',lambda e: errors.append(str(e)))
    # A snapshot-first view must work even if Nominatim, tiles and Overpass fail.
    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:8000/') else route.abort())
    page.goto('http://127.0.0.1:8000/map.html',wait_until='domcontentloaded')
    page.wait_for_function("n=>document.querySelector('#result-meta').textContent===n+' lokasi aktif'",arg=COUNT+1)
    assert page.locator('#coverage-note').count()==1, 'Missing visible city-scope explanation'
    assert 'Kota Bekasi' in page.locator('#coverage-note').inner_text()
    names = page.locator('#trip-target option').all_text_contents()
    assert 'Kranji' in names
    for outside in ['Cibitung','Pondok Ranji','Citayam','Fixture in Cibitung']:
        assert outside not in names, outside
    assert page.evaluate("localStorage.getItem('akseskota_audits')") == OLD_AUDITS
    assert page.evaluate("localStorage.getItem('akseskota_admin_custom')") == CUSTOM

    page.locator('#search').fill('JPO Bersama BTN')
    page.wait_for_function("document.querySelectorAll('.result').length===4")
    page.locator('.result').first.click()
    details = page.locator('#detail').inner_text()
    assert 'Jakarta Utara' in details
    assert 'Belum diverifikasi lapangan' in details
    assert 'Tanggal snapshot' in details
    assert 'panorama terdekat' in details
    assert 'jembatan' in details.lower() and 'level' in details.lower()
    assert '✓' not in details and 'Data real OSM' not in details
    assert page.locator('#detail .feature.yes').count()==0
    assert page.locator('#detail a[href^="https://www.openstreetmap.org/way/"]').count()==1
    assert 'bukan informasi rampa' in details
    page.screenshot(path=str(ROOT/'reports/city-scope/map-desktop.png'))

    page.locator('#detail-close').click()
    page.locator('#search').fill('Kranji')
    page.wait_for_function("document.querySelectorAll('.result').length===1")
    page.locator('.result').click()
    assert 'Kota Bekasi' in page.locator('#detail').inner_text()
    page.locator('#refresh-data').click()
    page.wait_for_function("!document.querySelector('#refresh-data').disabled", timeout=30000)
    assert page.locator('.result').count()==1
    assert page.evaluate("localStorage.getItem('akseskota_audits')") == OLD_AUDITS
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT/'reports/city-scope/map-mobile.png'))
    assert not errors, errors
    print(json.dumps({'source_locations':COUNT,'with_local_inside':COUNT+1,'outside_hidden':True,'local_records_preserved':True,'source_claim_not_verified':True,'jpo_context':'PASS','offline_refresh':'PASS','page_errors':errors}))
    context.close()
    browser.close()
