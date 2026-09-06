"""Isolated browser regression checks. No writes to the user's browser profile.
Run: python tests/map_slow_network.py (requires Playwright + Chromium).
External requests are blocked in the slow test; local assets use real HTTP.
Address responses in the cache test are explicit synthetic test fixtures.
"""
import json
import time
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8000/map.html'
from pathlib import Path
COUNT = len(json.loads((Path(__file__).resolve().parents[1]/'data/osm-snapshot.json').read_text(encoding='utf-8'))['elements'])
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={ 'width': 1280, 'height': 800 })
    page = context.new_page()
    errors, requested = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: requested.append(r.url))
    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:8000/') else route.abort())
    cdp = context.new_cdp_session(page)
    cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', {
        'offline': False, 'latency': 400,
        'downloadThroughput': 50 * 1024, 'uploadThroughput': 20 * 1024,
        'connectionType': 'cellular3g'
    })
    start = time.monotonic()
    page.goto(URL, wait_until='domcontentloaded', timeout=60000)
    page.wait_for_function("n => document.querySelector('#result-meta').textContent === n + ' lokasi aktif'", arg=COUNT, timeout=60000)
    elapsed = time.monotonic() - start
    assert page.locator('.result').count() == 100
    assert not any('unpkg.com' in u or 'fonts.google' in u for u in requested)
    assert not any('overpass' in u for u in requested)
    assert 'snapshot lokal' in page.locator('#data-status').inner_text()
    page.locator('#search').fill('Bakmi GM Sunda')
    page.wait_for_function("document.querySelectorAll('.result').length === 1")
    assert 'Bakmi GM Sunda' in page.locator('.result').inner_text()
    page.locator('.result').click()
    assert page.locator('#detail').evaluate("e => e.classList.contains('open')")
    assert 'Bakmi GM Sunda' in page.locator('#detail h2').inner_text()
    assert 'venue=osm-' in page.locator('#detail a[href^="audit.html"]').get_attribute('href')
    page.locator('#refresh-data').click()
    page.wait_for_function("!document.querySelector('#refresh-data').disabled", timeout=60000)
    assert page.locator('#search').input_value() == 'Bakmi GM Sunda'
    assert page.locator('.result').count() == 1
    assert not errors, errors
    print(json.dumps({'test': 'slow-network-external-unavailable', 'latency_ms': 400,
                      'download_KiB_s': 50, 'ready_seconds': round(elapsed, 2),
                      'venues': COUNT, 'search_detail_refresh': 'PASS', 'page_errors': errors}))
    context.close()

    # Normal network: real libraries, real snapshot and real OSM tiles.
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    page.goto(URL, wait_until='domcontentloaded')
    page.wait_for_function("document.querySelectorAll('.result').length > 0")
    try:
        page.wait_for_function("document.querySelectorAll('.leaflet-tile-loaded').length > 0", timeout=20000)
        tiles = page.locator('.leaflet-tile-loaded').count()
        print(json.dumps({'test': 'real-osm-tiles', 'loaded_tiles': tiles}))
    except Exception:
        print(json.dumps({'test': 'real-osm-tiles', 'status': 'external tile service unavailable; not verified'}))
    # Controlled responses verify bounded requests + persistent address cache.
    calls = []
    def address(route):
        calls.append(route.request.url)
        route.fulfill(content_type='application/json', body=json.dumps({'address': {'road': 'Fixture Road', 'city': 'Fixture City'}}))
    context.route('https://nominatim.openstreetmap.org/**', address)
    result = page.evaluate("""async () => {
        const m = await import('./js/map-network.js');
        const values = await Promise.all([m.reverseGeocode(-6.2,106.8), m.reverseGeocode(-6.2,106.8)]);
        return {values, discarded: await m.reverseGeocode(-6.3,106.9,()=>false)};
    }""")
    assert result['values'] == ['Fixture Road, Fixture City'] * 2
    assert result['discarded'] == ''
    assert len(calls) == 1
    page.reload(wait_until='domcontentloaded')
    value = page.evaluate("async () => (await import('./js/map-network.js')).reverseGeocode(-6.2,106.8)")
    assert value == 'Fixture Road, Fixture City' and len(calls) == 1
    print(json.dumps({'test': 'address-cache-fixture', 'duplicate_requests': 1, 'reload_additional_requests': 0, 'discard_stale_selection': 'PASS'}))
    context.close()
    browser.close()
