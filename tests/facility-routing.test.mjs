import test from 'node:test';
import assert from 'node:assert/strict';
import * as planner from '../js/facility-routing.js';

const origin = [0, 0];
const destination = { lat: 0, lng: 0.02, name: 'Tujuan' };
const venue = { id: 'toilet', name: 'Toilet', lat: 0.001, lng: 0.01, category: 'accessible_restroom', attributes: {} };
const direct = { coordinates: [origin, [0, 0.02]], distanceKm: 2.3, durationMinutes: 30, maneuvers: [], warnings: ['Data OSM terbatas'] };
const options = { origin, destination, preferences: ['accessible_restroom'], venues: [venue] };

function fixture(...responses) {
  const calls = [];
  const router = async (...args) => {
    calls.push(args);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'Unexpected router call');
    return response;
  };
  return { calls, router };
}

test('good alternative uses a matching nearby facility and preserves the wheelchair profile', async () => {
  const alternative = { ...direct, coordinates: [origin, [venue.lat, venue.lng], [destination.lat, destination.lng]], distanceKm: 2.5 };
  const { calls, router } = fixture(direct, alternative);
  const result = await plan({ ...options, router });
  assert.deepEqual(result.preferred, { ...alternative, facilities: [venue] });
  assert.deepEqual(result.facilities, [venue]);
  assert.equal(result.direct, direct);
  assert.deepEqual(calls[1], [origin, destination, 'wheelchair', { via: [venue] }]);
  assert.match(result.reason, /bukan.*bukti/i);
});

test('overdetour alternative is rejected using actual router distance', async () => {
  const alternative = { ...direct, coordinates: [origin, [venue.lat, venue.lng], [0, 0.02]], distanceKm: 2.9 };
  const { calls, router } = fixture(direct, alternative);
  const result = await plan({ ...options, router });
  assert.equal(result.preferred, null);
  assert.deepEqual(result.facilities, []);
  assert.equal(calls.length, 2);
  assert.equal(result.direct, direct);
});

test('failed alternative keeps the successful baseline without walking fallback', async () => {
  const { calls, router } = fixture(direct, new Error('Waypoint unreachable'));
  const result = await plan({ ...options, router });
  assert.equal(result.preferred, null);
  assert.equal(result.direct, direct);
  assert.deepEqual(result.facilities, []);
  assert.deepEqual(calls.map(call => call[2]), ['wheelchair', 'wheelchair']);
});

test('candidates exclude distant venues and venues within 30m of either endpoint', async () => {
  for (const location of [[0.003, 0.01], [0, 0.0001], [0, 0.0199]]) {
    const { calls, router } = fixture(direct, direct);
    const result = await plan({ ...options, venues: [{ ...venue, lat: location[0], lng: location[1] }], router });
    assert.equal(result.preferred, null);
    assert.equal(calls.length, 1);
  }
});

test('alternative geometry must actually come within 60m of its waypoint', async () => {
  const { calls, router } = fixture(direct, direct);
  const result = await plan({ ...options, router });
  assert.equal(calls.length, 2);
  assert.equal(result.preferred, null);
  assert.deepEqual(result.facilities, []);
});

test('business and true attributes match preferences; unknown or false attributes do not', async () => {
  for (const [preference, fields] of [['business', { isBusiness: true }], ['elevator', { attributes: { elevator: true } }]]) {
    const candidate = { ...venue, category: 'other', ...fields };
    const alternative = { ...direct, coordinates: [origin, [candidate.lat, candidate.lng], [0, 0.02]] };
    const { router } = fixture(direct, alternative);
    const result = await plan({ ...options, venues: [candidate], preferences: [preference], router });
    assert.deepEqual(result.facilities, [candidate]);
  }
  const { calls, router } = fixture(direct);
  const result = await plan({ ...options, preferences: ['elevator', 'business'], venues: [
    { ...venue, attributes: { elevator: false } },
    { ...venue, attributes: { elevator: null } },
    { ...venue, category: 'business', attributes: { elevator: 'yes' } }
  ], router });
  assert.equal(result.preferred, null);
  assert.equal(calls.length, 1);
});

test('tries at most two candidates sequentially and ranks matches before actual detour', async () => {
  const second = { ...venue, id: 'second', lng: 0.012, attributes: { elevator: true } };
  const third = { ...venue, id: 'third', lng: 0.014 };
  for (const extraPreference of [true, false]) {
    const calls = [];
    let active = false;
    const router = async (...args) => {
      assert.equal(active, false, 'Requests must be sequential');
      active = true;
      await new Promise(resolve => setImmediate(resolve));
      active = false;
      calls.push(args);
      const via = args[3].via[0];
      if (!via) return direct;
      return { ...direct, distanceKm: via.id === 'second' ? 2.7 : 2.4, coordinates: [origin, [via.lat, via.lng], [0, 0.02]] };
    };
    const result = await plan({ ...options, venues: [venue, second, third], preferences: extraPreference ? ['accessible_restroom', 'elevator'] : ['accessible_restroom'], router });
    assert.equal(calls.length, 3);
    assert.equal(result.facilities[0].id, extraPreference ? 'second' : 'toilet');
  }
});

test('a failed first candidate does not prevent a successful second candidate', async () => {
  const second = { ...venue, id: 'second', lng: 0.012 };
  const alternative = { ...direct, coordinates: [origin, [second.lat, second.lng], [0, 0.02]] };
  const { calls, router } = fixture(direct, new Error('No first route'), alternative);
  const result = await plan({ ...options, venues: [venue, second], router });
  assert.equal(calls.length, 3);
  assert.deepEqual(result.facilities, [second]);
});

test('custom detour limit includes equality and rejects distances just above it', async () => {
  for (const [distanceKm, accepted] of [[direct.distanceKm * 1.1, true], [direct.distanceKm * 1.1 + 0.001, false]]) {
    const { router } = fixture(direct, { ...direct, distanceKm, coordinates: [origin, [venue.lat, venue.lng], [0, 0.02]] });
    const result = await plan({ ...options, maxDetourRatio: 0.1, router });
    assert.equal(Boolean(result.preferred), accepted);
  }
});

test('malformed alternative distances are not accepted as cheap detours', async () => {
  for (const distanceKm of [-1, null, '2.5', NaN, Infinity]) {
    const { router } = fixture(direct, { ...direct, distanceKm, coordinates: [origin, [venue.lat, venue.lng], [0, 0.02]] });
    const result = await plan({ ...options, router });
    assert.equal(result.preferred, null);
  }
});

async function plan(options) {
  assert.equal(typeof planner.planFacilityRoute, 'function', 'planner must export planFacilityRoute');
  return planner.planFacilityRoute(options);
}

test('no candidates keeps the direct route and explains the accessibility limitation', async () => {
  const { calls, router } = fixture(direct);
  const result = await plan({ origin, destination, router });
  assert.equal(result.direct, direct);
  assert.equal(result.preferred, null);
  assert.deepEqual(result.facilities, []);
  assert.match(result.reason, /bukan.*(bukti|jaminan).*trotoar/i);
  assert.deepEqual(calls, [[origin, destination, 'wheelchair', { via: [] }]]);
});

test('baseline failure propagates without trying another profile', async () => {
  const error = new Error('Rute kursi roda tidak tersedia');
  const { calls, router } = fixture(error);
  await assert.rejects(plan({ ...options, router }), e => e === error);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], 'wheelchair');
});
