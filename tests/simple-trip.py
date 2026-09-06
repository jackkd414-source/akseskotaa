from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 b=p.chromium.launch(headless=True); page=b.new_page(viewport={'width':1280,'height':800});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/map.html',wait_until='domcontentloaded')
 assert page.locator('#destination-search').count()==1, 'Missing simple destination search'
 page.wait_for_function("document.querySelector('#trip-target').options.length>2")
 assert not page.locator('#trip-options').evaluate('e=>e.open')
 assert not page.locator('#trip-origin').is_visible()
 assert not page.locator('#trip-detour').is_visible()
 assert page.locator('#trip-form button[type=submit]').is_visible()
 page.locator('#destination-search').fill('Kranji');page.locator('#destination-search').dispatch_event('change')
 assert page.locator('#trip-target').input_value()!=''
 page.locator('#trip-options summary').first.click();assert page.locator('#trip-origin').is_visible()
 page.select_option('#trip-origin',index=2)
 page.route('**/route?json=*',lambda r:r.fulfill(content_type='application/json',body=json.dumps({'trip':{'summary':{'length':1,'time':600},'legs':[{'shape':'??AA','maneuvers':[{'type':1,'length':1,'time':600}]}]}})))
 page.locator('#trip-form button[type=submit]').click()
 page.wait_for_function("document.querySelector('#route-options').textContent.includes('langsung')")
 page.locator('#route-close').click()
 page.set_viewport_size({'width':390,'height':844});page.locator('#expand-search').click()
 page.locator('#trip-options').evaluate('e=>e.open=false')
 assert page.locator('#trip-form').bounding_box()['height']<450
 assert not errors, errors
 page.screenshot(path='tests/simple-trip-mobile.png')
 print(json.dumps({'simple_flow':'PASS','advanced_collapsed':'PASS','mobile_height':page.locator('#trip-form').bounding_box()['height'],'errors':errors}))
 b.close()
