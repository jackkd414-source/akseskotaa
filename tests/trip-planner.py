"""UI checks with explicit synthetic router fixture; isolated browser storage."""
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True); page=b.new_page(viewport={'width':1280,'height':800});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/map.html',wait_until='domcontentloaded')
 assert page.locator('#trip-form').count()==1, 'Missing origin/destination journey planner'
 page.wait_for_function("document.querySelector('#trip-origin').options.length > 2")
 page.locator('#trip-options summary').first.click()
 page.select_option('#trip-origin',index=1)
 target=page.locator('#trip-target option').nth(2).text_content()
 page.locator('#destination-search').fill(target);page.locator('#destination-search').dispatch_event('change')
 calls=[]
 def route(r):
  q=json.loads(__import__('urllib.parse',fromlist=['urlparse']).parse_qs(__import__('urllib.parse',fromlist=['urlparse']).urlparse(r.request.url).query)['json'][0]); calls.append(q)
  r.fulfill(content_type='application/json',body=json.dumps({'trip':{'summary':{'length':1,'time':600},'legs':[{'shape':'??AA','maneuvers':[{'type':1,'length':1,'time':600}]}]}}))
 page.route('**/route?json=*',route)
 page.locator('#trip-form button[type=submit]').click()
 page.wait_for_function("document.querySelector('#route-options').textContent.includes('langsung')",timeout=20000)
 assert len(calls)>=1
 assert calls[0]['locations'][0]['lat'] != calls[0]['locations'][-1]['lat']
 assert 'belum' in page.locator('#route-options').inner_text().lower()
 page.locator('#route-close').click()
 page.locator('#pick-target').click();page.locator('#map').click(position={'x':400,'y':250})
 assert page.locator('#trip-target').input_value()=='picked-target'
 page.set_viewport_size({'width':390,'height':844})
 page.locator('#expand-search').click()
 assert page.locator('#trip-form button[type=submit]').is_visible()
 assert not errors,errors
 print(json.dumps({'planner':'PASS','router':'explicit fixture','map_point':'PASS','mobile':'PASS','errors':errors}))
 b.close()
