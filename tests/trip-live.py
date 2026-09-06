"""Manual integration probe: actual OSM snapshot and public Valhalla, no fixtures."""
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page()
 page.goto('http://127.0.0.1:8000/map.html',wait_until='domcontentloaded')
 page.wait_for_function("document.querySelector('#trip-target').options.length>2")
 result=page.evaluate("""async()=>{
 const {loadVenues}=await import('./js/core.js?v=city1');
 const {planFacilityRoute}=await import('./js/facility-routing.js');
 const venues=await loadVenues();
 const plan=await planFacilityRoute({origin:[-6.193,106.822],destination:{lat:-6.210,lng:106.824,name:'Titik tujuan uji'},profile:'wheelchair',venues,preferences:['wheelchair_ramp','tactile_paving','accessible_restroom'],maxDetourRatio:0.5});
 return {directKm:plan.direct.distanceKm,preferredKm:plan.preferred?.distanceKm||null,facilities:plan.facilities.map(v=>({id:v.id,name:v.name})),reason:plan.reason};
 }""")
 assert result['directKm']>0
 print(json.dumps(result,ensure_ascii=True))
 b.close()
