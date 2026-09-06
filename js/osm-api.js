import {CITY_SCOPE_ID, loadCityScope, filterCityVenues, buildCityQuery} from './city-scope.js?v=1';

const CACHE_KEY = 'akseskota_osm_selected_cities_v7';
const CACHE_TTL = 60 * 60 * 1000;
const SNAPSHOT_URL = 'data/osm-snapshot.json?v=cities1';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const SELECTORS = [
  '["ramp"="wheelchair"]', '["ramp:wheelchair"="yes"]',
  '["highway"="ramp"]["wheelchair"="yes"]',
  '["amenity"="toilets"]["wheelchair"="yes"]',
  '["toilets:wheelchair"="yes"]', '["tactile_paving"="yes"]',
  '["wheelchair"~"^(yes|designated)$"]',
];

const yes = value => value === 'yes' || value === 'designated';
const known = (tags, ...keys) => {
  for (const key of keys) if (key in tags) return yes(tags[key]);
  return null;
};
function category(tags) {
  if (tags.highway === 'elevator' || yes(tags.elevator)) return 'elevator';
  if ((tags.amenity === 'toilets' && yes(tags.wheelchair)) || yes(tags['toilets:wheelchair'])) return 'accessible_restroom';
  if (yes(tags.tactile_paving)) return 'tactile_paving';
  if (tags.ramp === 'wheelchair' || yes(tags['ramp:wheelchair']) || (tags.highway === 'ramp' && yes(tags.wheelchair))) return 'wheelchair_ramp';
  return 'wheelchair_place';
}
function label(tags, id, cat) {
  return tags.name || tags['name:id'] || tags.brand || ({
    accessible_restroom: 'Toilet aksesibel', tactile_paving: 'Jalur taktil',
    wheelchair_place: 'Akses kursi roda', wheelchair_ramp: 'Rampa',
  }[cat]);
}
function parse(data) {
  if (!Array.isArray(data.elements) || data.remark) throw new Error('Respons OSM tidak lengkap.');
  return data.elements.map(element => {
    const lat = element.lat ?? element.center?.lat, lng = element.lon ?? element.center?.lon;
    const tags = element.tags || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const cat = category(tags);
    if (cat === 'elevator') return null;
    return {
      id: `osm-${element.type}-${element.id}`, osm_id: element.id, osm_type: element.type,
      name: label(tags, element.id, cat), lat, lng, category: cat,
      address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '),
      attributes: {
        wheelchair_ramp: tags.ramp === 'wheelchair' || yes(tags['ramp:wheelchair']) || (tags.highway === 'ramp' && yes(tags.wheelchair)) ? true : known(tags, 'ramp:wheelchair', 'ramp'),
        accessible_restroom: tags.amenity === 'toilets' && yes(tags.wheelchair) ? true : known(tags, 'toilets:wheelchair'),
        tactile_paving: known(tags, 'tactile_paving'), wheelchair_access: known(tags, 'wheelchair'),
      },
      source: 'OpenStreetMap', osm_updated_at: data.osm3s?.timestamp_osm_base || null, tags,
    };
  }).filter(Boolean);
}
function readCache(allowStale = false) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.scopeId !== CITY_SCOPE_ID || !Array.isArray(cached.venues) || !Number.isFinite(cached.cachedAt)) return null;
    if (!allowStale && Date.now() - cached.cachedAt >= CACHE_TTL) return null;
    return cached;
  } catch { return null; }
}
function writeCache(result) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({cachedAt: Date.now(), scopeId: CITY_SCOPE_ID, ...result})); } catch { /* Optional cache. */ }
}
function scoped(venues, cityScope) {
  return filterCityVenues(venues.filter(v => v && v.category !== 'elevator' && v.tags?.highway !== 'elevator' && !yes(v.tags?.elevator)), cityScope);
}
async function bundled(cityScope, warning) {
  const response = await fetch(SNAPSHOT_URL, {cache: 'no-cache'});
  if (!response.ok) throw new Error('Snapshot lokasi gagal dimuat.');
  const raw = await response.json();
  return {venues: scoped(parse(raw), cityScope), updatedAt: raw.osm3s?.timestamp_osm_base, source: 'bundled-osm-snapshot', warning, cityScope};
}

export async function fetchOSMLocations({fresh = false} = {}) {
  // A missing boundary never falls back to the old regional bbox.
  const cityScope = await loadCityScope();
  if (!fresh) {
    const cached = readCache();
    if (cached) return {venues: scoped(cached.venues, cityScope), updatedAt: cached.updatedAt, source: 'cache', cityScope};
    try { return await bundled(cityScope); } catch { /* Try a live city-scoped query. */ }
  }
  let lastError;
  for (const endpoint of ENDPOINTS) {
    try {
      const url = `${endpoint}?data=${encodeURIComponent(buildCityQuery(cityScope, SELECTORS))}`;
      const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(70000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      const venues = scoped(parse(raw), cityScope);
      if (!venues.length) throw new Error('Respons OSM tidak berisi lokasi dalam cakupan kota.');
      const result = {venues, updatedAt: raw.osm3s?.timestamp_osm_base || null};
      writeCache(result);
      return {...result, source: 'live', cityScope};
    } catch (error) { lastError = error; }
  }
  const stale = readCache(true);
  if (stale) return {venues: scoped(stale.venues, cityScope), updatedAt: stale.updatedAt, source: 'stale-cache', warning: lastError?.message, cityScope};
  try { return await bundled(cityScope, lastError?.message); } catch { /* Report failure, never invent data. */ }
  throw new Error(`Data OpenStreetMap gagal dimuat: ${lastError?.message || 'layanan tidak tersedia'}`);
}
export function clearCache() { localStorage.removeItem(CACHE_KEY); }
