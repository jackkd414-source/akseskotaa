import test from 'node:test';
import assert from 'node:assert/strict';
import {getAccessibleRoute} from '../js/accessible-routing.js';
test('via facility is sent as a break and every returned leg is rendered', async()=>{
 const original=globalThis.fetch; let payload;
 globalThis.fetch=async url=>{payload=JSON.parse(new URL(url).searchParams.get('json'));return {ok:true,json:async()=>({trip:{summary:{length:2,time:600},legs:[{shape:'??',maneuvers:[{type:1,length:1,time:300}]},{shape:'AA',maneuvers:[{type:4,length:1,time:300}]}]}})};};
 try{const route=await getAccessibleRoute([0,0],{lat:0.02,lng:0.02},'wheelchair',{via:[{lat:0.01,lng:0.01}]});assert.equal(payload.locations.length,3);assert.equal(payload.locations[1].type,'break');assert.equal(route.coordinates.length,2);assert.equal(route.maneuvers.length,2);assert.equal(route.distanceKm,2);assert.equal(payload.costing_options.pedestrian.type,'wheelchair');assert.equal(payload.costing_options.pedestrian.use_hills,0);assert.equal('wheelchair' in payload.costing_options.pedestrian,false);}finally{globalThis.fetch=original;}
});
