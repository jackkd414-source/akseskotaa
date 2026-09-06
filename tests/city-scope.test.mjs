import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

const moduleUrl = new URL('../js/city-scope.js', import.meta.url);
const boundaries = JSON.parse(readFileSync(new URL('../data/city-boundaries.json', import.meta.url)));

test('city scope accepts actual selected city polygons, not the old regional bbox', async () => {
  assert.ok(existsSync(moduleUrl), 'Missing city-scope filter');
  const {cityForPoint, filterCityVenues} = await import(moduleUrl);
  assert.equal(cityForPoint(boundaries, -6.2245133, 106.9798267)?.name, 'Kota Bekasi'); // Kranji
  assert.equal(cityForPoint(boundaries, -6.1876872, 106.823756)?.name, 'Jakarta Pusat'); // Sarinah
  assert.equal(cityForPoint(boundaries, -6.1212226, 106.8616239)?.name, 'Jakarta Utara'); // JPO example
  for (const [lat, lng] of [
    [-6.2618245, 107.0837982], // Cibitung: Kabupaten Bekasi
    [-6.2766831, 106.7446926], // Pondok Ranji: Tangerang Selatan
    [-6.4488237, 106.8023619], // Citayam, outside selected cities
    [-5.800, 106.620], // Kepulauan Seribu
  ]) assert.equal(cityForPoint(boundaries, lat, lng), null);
  assert.equal(cityForPoint(boundaries, NaN, 107), null);
  const before = [
    {id:'kranji',lat:-6.2245133,lng:106.9798267},
    {id:'cibitung',lat:-6.2618245,lng:107.0837982,city:'Kota Bekasi'},
  ];
  assert.deepEqual(filterCityVenues(before, boundaries).map(v=>v.id), ['kranji']);
  assert.equal(before[0].city, undefined, 'Source record should not be mutated');
});

test('concave polygon and holes use geometry rather than bounding boxes', async () => {
  assert.ok(existsSync(moduleUrl), 'Missing city-scope filter');
  const {cityForPoint} = await import(moduleUrl);
  const fixture = {features:[{properties:{name:'Fixture'},bbox:[0,0,3,3],geometry:{type:'MultiPolygon',coordinates:[[
    [[0,0],[3,0],[3,1],[1,1],[1,3],[0,3],[0,0]],
    [[0.2,0.2],[0.4,0.2],[0.4,0.4],[0.2,0.4],[0.2,0.2]],
  ]]}}]};
  assert.equal(cityForPoint(fixture,0.5,0.5)?.name,'Fixture');
  assert.equal(cityForPoint(fixture,1.5,2),null);
  assert.equal(cityForPoint(fixture,0.3,0.3),null);
  assert.equal(cityForPoint(fixture,0,1)?.name,'Fixture');
});

test('source scope validates all six city IDs and builds a bounded area query', async () => {
  assert.ok(existsSync(moduleUrl), 'Missing city-scope filter');
  const {validateCityScope, buildCityQuery} = await import(moduleUrl);
  assert.equal(validateCityScope(boundaries), boundaries);
  assert.throws(()=>validateCityScope({...boundaries,features:boundaries.features.slice(0,5)}));
  const query = buildCityQuery(boundaries, ['["tactile_paving"="yes"]']);
  assert.ok(query.includes('map_to_area'));
  assert.ok(query.includes('14509733')); // Kota, not Kabupaten Bekasi
  assert.ok(!query.includes('14765575')); // Kabupaten explicitly excluded
  assert.ok(query.includes('(area.cities)'));
});
