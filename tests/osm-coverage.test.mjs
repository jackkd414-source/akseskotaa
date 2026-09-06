import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchOSMLocations} from '../js/osm-api.js';
import {readFileSync} from 'node:fs';
const boundaries=JSON.parse(readFileSync(new URL('../data/city-boundaries.json',import.meta.url)));
test('refresh includes Bekasi and explicit wheelchair ramps are true, not false',async()=>{
 const saved=globalThis.fetch;let query;
 globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
 globalThis.fetch=async url=>{if(String(url).includes('city-boundaries.json'))return {ok:true,json:async()=>boundaries};query=new URL(url).searchParams.get('data');return {ok:true,json:async()=>({elements:[{type:'node',id:1,lat:-6.2,lon:107,tags:{'ramp:wheelchair':'yes'}},{type:'node',id:2,lat:-6.2,lon:107,tags:{ramp:'wheelchair'}},{type:'node',id:3,lat:-6.2,lon:107,tags:{wheelchair:'yes',name:'Test place'}}]})}};
 try{const data=await fetchOSMLocations({fresh:true});assert.ok(query.includes('map_to_area->.cities'));assert.ok(query.includes('14509733'));assert.ok(!query.includes('14765575'));assert.ok(query.includes('ramp:wheelchair'));assert.ok(data.venues.slice(0,2).every(v=>v.attributes.wheelchair_ramp===true));assert.equal(data.venues[2].category,'wheelchair_place');assert.equal(data.venues[2].attributes.wheelchair_ramp,null);}finally{globalThis.fetch=saved;}
});
