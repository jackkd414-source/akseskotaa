// Bounded address cache; serial requests respect Nominatim's 1 request/s limit.
const KEY = 'akseskota_addresses_v1';
const TTL = 30 * 24 * 60 * 60 * 1000;
const cache = new Map();
try {
  const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (Array.isArray(rows)) for (const [key, entry] of rows.slice(-200)) {
    if (entry && typeof entry.value === 'string' && Date.now() - entry.time < TTL) cache.set(key, entry);
  }
} catch { /* Storage unavailable or malformed: continue in memory. */ }
let queue = Promise.resolve();
let lastStarted = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function debounce(fn, delay = 250) {
  let timer;
  const run = (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  run.cancel = () => clearTimeout(timer);
  return run;
}
export function reverseGeocode(lat, lng, isCurrent = () => true) {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < TTL) return Promise.resolve(entry.value);
  const task = queue.then(async () => {
    // Drop queued selections that the visitor has already left.
    if (!isCurrent()) return '';
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < TTL) return cached.value;
    await sleep(Math.max(0, 1100 - (Date.now() - lastStarted)));
    if (!isCurrent()) return '';
    lastStarted = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=id`, {
        headers: { Accept: 'application/json' }, signal: controller.signal
      });
      if (!res.ok) return '';
      const { address: a = {} } = await res.json();
      const road = a.road || a.pedestrian || a.footway || a.residential || '';
      const value = [road ? road + (a.house_number ? ` ${a.house_number}` : '') : '', a.suburb || a.village || a.city_district || '', a.city || a.county || ''].filter(Boolean).join(', ');
      if (value) {
        cache.set(key, { value, time: Date.now() });
        while (cache.size > 200) cache.delete(cache.keys().next().value);
        try { localStorage.setItem(KEY, JSON.stringify([...cache])); } catch { /* Cache is optional. */ }
      }
      return value;
    } catch { return ''; } finally { clearTimeout(timeout); }
  });
  queue = task.catch(() => '');
  return task;
}


// Forward geocoding untuk tujuan bebas (bangunan mana pun di area Jakarta/Bekasi).
// Batas pencarian lewat viewbox + bounded supaya hasil tetap relevan lokal.
const SEARCH_CACHE = new Map();
const SEARCH_TTL = 30 * 60 * 1000;
let searchQueue = Promise.resolve();
let lastSearchAt = 0;
export async function searchPlaces(query, limit = 6) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  const hit = SEARCH_CACHE.get(key);
  if (hit && Date.now() - hit.time < SEARCH_TTL) return hit.value;
  const task = searchQueue.then(async () => {
    await sleep(Math.max(0, 1100 - (Date.now() - lastSearchAt)));
    lastSearchAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=id&limit=' + limit
        + '&viewbox=106.66,-6.37,107.01,-6.08&bounded=1&q=' + encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!res.ok) return [];
      const rows = await res.json();
      return rows.map(r => ({
        name: r.display_name ? r.display_name.split(',').slice(0, 3).join(', ') : r.name || q,
        lat: Number(r.lat), lng: Number(r.lon)
      })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    } catch { return []; }
    finally { clearTimeout(timeout); }
  });
  searchQueue = task;
  const value = await task;
  SEARCH_CACHE.set(key, { time: Date.now(), value });
  return value;
}
