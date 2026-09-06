// Geographic scope only. Membership is not evidence of usable accessibility.
export const CITY_SCOPE_ID = 'jakarta-mainland-bekasi-city-v1';
const CITY_IDS = [5802438, 5802441, 7625977, 7626001, 7626002, 14509733];
let loadedScope;

export function validateCityScope(scope) {
  const ids = scope?.features?.map(f => f.properties?.relation_id);
  if (scope?.scope_id !== CITY_SCOPE_ID || !ids || ids.length !== CITY_IDS.length || new Set(ids).size !== CITY_IDS.length || !CITY_IDS.every(id => ids.includes(id))) {
    throw new Error('Batas wilayah kota tidak lengkap. Data tidak ditampilkan di luar cakupan.');
  }
  for (const feature of scope.features) {
    if (feature.geometry?.type !== 'MultiPolygon' || !feature.geometry.coordinates.length || feature.bbox?.length !== 4) throw new Error('Geometri batas kota tidak valid.');
    for (const polygon of feature.geometry.coordinates) {
      if (!polygon.length) throw new Error('Poligon batas kota kosong.');
      for (const ring of polygon) {
        if (ring.length < 4 || ring.some(p => p.length !== 2 || !p.every(Number.isFinite)) || ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw new Error('Batas kota tidak membentuk poligon tertutup.');
      }
    }
  }
  return scope;
}

export function loadCityScope() {
  if (!loadedScope) {
    loadedScope = fetch('data/city-boundaries.json?v=city1').then(response => {
      if (!response.ok) throw new Error('Batas kota gagal dimuat. Coba muat ulang.');
      return response.json();
    }).then(validateCityScope).catch(error => { loadedScope = undefined; throw error; });
  }
  return loadedScope;
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1], [bx, by] = ring[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) <= 1e-12 && x >= Math.min(ax,bx) - 1e-12 && x <= Math.max(ax,bx) + 1e-12 && y >= Math.min(ay,by) - 1e-12 && y <= Math.max(ay,by) + 1e-12) return true;
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function cityForPoint(scope, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const feature of scope.features) {
    const [west,south,east,north] = feature.bbox;
    if (lng < west || lng > east || lat < south || lat > north) continue;
    if (feature.geometry.coordinates.some(polygon => inRing(lng,lat,polygon[0]) && !polygon.slice(1).some(hole => inRing(lng,lat,hole)))) return feature.properties;
  }
  return null;
}

export function filterCityVenues(venues, scope) {
  const result = [];
  for (const venue of venues) {
    const city = cityForPoint(scope, venue.lat, venue.lng);
    if (city) result.push({...venue, city: city.name, cityRelationId: city.relation_id});
  }
  return result;
}

export function buildCityQuery(scope, selectors, timeout = 60) {
  const ids = scope.features.map(f => f.properties.relation_id).join(',');
  return `[out:json][timeout:${timeout}];relation(id:${ids});map_to_area->.cities;(${selectors.map(selector => `nwr${selector}(area.cities);`).join('')});out center tags;`;
}
