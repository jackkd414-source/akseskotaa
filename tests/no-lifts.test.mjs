import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchOSMLocations} from '../js/osm-api.js';
import {readFileSync} from 'node:fs';
const boundaries=JSON.parse(readFileSync(new URL('../data/city-boundaries.json',import.meta.url)));
test('lift records are excluded even when returned with wheelchair=yes',async()=>{
 const fetchBefore=globalThis.fetch;
 globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
 globalThis.fetch=async url=>String(url).includes('city-boundaries.json')?{ok:true,json:async()=>boundaries}:({ok:true,json:async()=>({elements:[{type:'node',id:1,lat:-6.2,lon:107,tags:{highway:'elevator',wheelchair:'yes'}},{type:'node',id:2,lat:-6.2,lon:107,tags:{elevator:'yes'}},{type:'node',id:3,lat:-6.2,lon:107,tags:{wheelchair:'yes'}}]})});
 try{const r=await fetchOSMLocations({fresh:true});assert.deepEqual(r.venues.map(v=>v.osm_id),[3]);}finally{globalThis.fetch=fetchBefore;}
});
