import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchOSMLocations} from '../js/osm-api.js';

const boundaries = JSON.parse(readFileSync(new URL('../data/city-boundaries.json',import.meta.url)));
const fixture = {osm3s:{timestamp_osm_base:'2026-09-05T10:00:00Z'},elements:[
  {type:'node',id:1,lat:-6.2245133,lon:106.9798267,tags:{name:'Fixture Kranji',wheelchair:'yes'}},
  {type:'node',id:2,lat:-6.2618245,lon:107.0837982,tags:{name:'Fixture Cibitung',wheelchair:'yes','addr:city':'Kota Bekasi'}},
  {type:'node',id:3,lat:-6.2766831,lon:106.7446926,tags:{name:'Fixture Pondok Ranji',wheelchair:'yes'}},
  {type:'node',id:4,lat:-6.1876872,lon:106.823756,tags:{name:'Fixture Sarinah','tactile_paving':'yes'}},
]};
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),values};
}
function mockFetch(requests,failLive=false) {
  return async url=>{
    const str=String(url);requests.push(str);
    if(str.includes('city-boundaries.json'))return {ok:true,json:async()=>structuredClone(boundaries)};
    if(str.includes('osm-snapshot.json'))return {ok:true,json:async()=>structuredClone(fixture)};
    if(failLive)throw new Error('Fixture unavailable');
    return {ok:true,json:async()=>structuredClone(fixture)};
  };
}

test('fresh query is city-area scoped and filters neighboring coordinates',async()=>{
  const saved=globalThis.fetch;globalThis.localStorage=storage();const requests=[];
  globalThis.fetch=mockFetch(requests);
  try {
    const result=await fetchOSMLocations({fresh:true});
    assert.deepEqual(result.venues.map(v=>v.osm_id),[1,4]);
    assert.equal(result.venues[0].city,'Kota Bekasi');
    assert.equal(result.venues[1].city,'Jakarta Pusat');
    const query=requests.filter(url=>url.includes('interpreter')).map(url=>new URL(url).searchParams.get('data'))[0];
    assert.ok(query.includes('map_to_area->.cities'));
    assert.ok(query.includes('14509733')&&!query.includes('14765575'));
    assert.equal(result.cityScope.scope_id,boundaries.scope_id);
  } finally {globalThis.fetch=saved;}
});

test('bundled fallback cannot revive outside-city places from an older snapshot',async()=>{
  const saved=globalThis.fetch;globalThis.localStorage=storage();const requests=[];
  globalThis.fetch=mockFetch(requests,true);
  try {
    const result=await fetchOSMLocations({fresh:true});
    assert.deepEqual(result.venues.map(v=>v.osm_id),[1,4]);
    assert.equal(result.source,'bundled-osm-snapshot');
    assert.ok(result.warning);
  } finally {globalThis.fetch=saved;}
});

test('cached records are re-filtered by coordinates, with old user data untouched',async()=>{
  const saved=globalThis.fetch;const store=storage({'akseskota_audits':'[{"id":"keep-audit"}]'});globalThis.localStorage=store;
  const requests=[];globalThis.fetch=mockFetch(requests);
  try {
    await fetchOSMLocations({fresh:true});
    const entry=[...store.values].find(([key])=>key!=='akseskota_audits');
    assert.ok(entry,'fresh result must be cached');
    const cached=JSON.parse(entry[1]);
    cached.venues.push({id:'outside-in-cache',lat:-6.2618245,lng:107.0837982,category:'wheelchair_place',city:'Kota Bekasi'});
    store.setItem(entry[0],JSON.stringify(cached));
    const result=await fetchOSMLocations();
    assert.equal(result.source,'cache');
    assert.ok(!result.venues.some(v=>v.id==='outside-in-cache'));
    assert.equal(store.getItem('akseskota_audits'),'[{"id":"keep-audit"}]');
  } finally {globalThis.fetch=saved;}
});

test('post-admin overlays cannot move a public location outside the selected cities',async()=>{
  const saved=globalThis.fetch;const store=storage({
    akseskota_audits:'[{"id":"keep-audit"}]',
    akseskota_admin_overrides:JSON.stringify({'osm-node-1':{lat:-6.2618245,lng:107.0837982}}),
    akseskota_admin_custom:JSON.stringify([
      {id:'custom-inside',name:'Fixture local city',lat:-6.1876872,lng:106.823756,category:'tactile_paving'},
      {id:'custom-outside',name:'Fixture local outside',lat:-6.4488237,lng:106.8023619,category:'tactile_paving'},
    ]),
  });globalThis.localStorage=store;const originalCustom=store.getItem('akseskota_admin_custom');
  globalThis.fetch=mockFetch([]);
  try {
    const {loadVenues}=await import('../js/core.js');
    const result=await loadVenues({fresh:true});
    assert.deepEqual(result.map(v=>v.id).sort(),['custom-inside','osm-node-4']);
    assert.equal(store.getItem('akseskota_admin_custom'),originalCustom);
    assert.equal(store.getItem('akseskota_audits'),'[{"id":"keep-audit"}]');
  } finally {globalThis.fetch=saved;}
});
