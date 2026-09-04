const JAKARTA_BBOX='-6.35,106.72,-6.10,106.93';
const CACHE_KEY='akseskota_osm_real_v3';
const CACHE_TTL=60*60*1000;
const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];

function query(bbox=JAKARTA_BBOX){return `[out:json][timeout:60];(
 nwr["ramp"="wheelchair"](${bbox});
 nwr["highway"="ramp"]["wheelchair"="yes"](${bbox});
 nwr["highway"="elevator"](${bbox});
 nwr["elevator"="yes"](${bbox});
 nwr["amenity"="toilets"]["wheelchair"="yes"](${bbox});
 nwr["toilets:wheelchair"="yes"](${bbox});
 nwr["tactile_paving"="yes"](${bbox});
);out center tags;`}

const yes=v=>v==='yes'||v==='designated';
const known=(tags,...keys)=>{for(const key of keys){if(key in tags)return yes(tags[key])}return null};
function category(t){
 if(t.highway==='elevator'||yes(t.elevator))return'elevator';
 if((t.amenity==='toilets'&&yes(t.wheelchair))||yes(t['toilets:wheelchair']))return'accessible_restroom';
 if(yes(t.tactile_paving))return'tactile_paving';
 return'wheelchair_ramp';
}
function label(t,id,cat){return t.name||t['name:id']||t.brand||({elevator:'Lift OSM',accessible_restroom:'Toilet aksesibel OSM',tactile_paving:'Jalur taktil OSM',wheelchair_ramp:'Lokasi aksesibel OSM'}[cat])+` #${id}`}
function address(t){return [t['addr:housenumber'],t['addr:street'],t['addr:suburb'],t['addr:city']].filter(Boolean).join(', ')}
function parse(data){return(data.elements||[]).map(el=>{
 const lat=el.lat??el.center?.lat,lng=el.lon??el.center?.lon,t=el.tags||{};if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
 const cat=category(t);return{id:`osm-${el.type}-${el.id}`,osm_id:el.id,osm_type:el.type,name:label(t,el.id,cat),lat,lng,category:cat,address:address(t),attributes:{wheelchair_ramp:known(t,'ramp'),elevator:t.highway==='elevator'?true:known(t,'elevator'),accessible_restroom:t.amenity==='toilets'&&yes(t.wheelchair)?true:known(t,'toilets:wheelchair'),tactile_paving:known(t,'tactile_paving'),wheelchair_access:known(t,'wheelchair')},source:'OpenStreetMap',osm_updated_at:data.osm3s?.timestamp_osm_base||null,tags:t}
 }).filter(Boolean)}
function readCache(){try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return c&&Date.now()-c.cachedAt<CACHE_TTL?c:null}catch{return null}}
function writeCache(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify({cachedAt:Date.now(),...data}))}catch{}}

export async function fetchOSMLocations({fresh=false,bbox=JAKARTA_BBOX}={}){
 if(!fresh){const c=readCache();if(c)return{venues:c.venues,updatedAt:c.updatedAt,source:'cache'};try{const response=await fetch('data/osm-snapshot.json');if(response.ok){const raw=await response.json(),venues=parse(raw);if(venues.length)return{venues,updatedAt:raw.osm3s?.timestamp_osm_base,source:'bundled-osm-snapshot'}}}catch{}}
 let lastError;
 for(const endpoint of ENDPOINTS){try{const url=`${endpoint}?data=${encodeURIComponent(query(bbox))}`;const response=await fetch(url,{method:'GET',headers:{Accept:'application/json'},signal:AbortSignal.timeout(70000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const raw=await response.json(),venues=parse(raw);if(!venues.length)throw new Error('Respons OSM kosong');const result={venues,updatedAt:raw.osm3s?.timestamp_osm_base||new Date().toISOString()};writeCache(result);return{...result,source:'live'}}catch(e){lastError=e}}
 const stale=(()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'null')}catch{return null}})();
 if(stale?.venues?.length)return{venues:stale.venues,updatedAt:stale.updatedAt,source:'stale-cache',warning:lastError?.message};
 try{const response=await fetch('data/osm-snapshot.json');if(response.ok){const raw=await response.json(),venues=parse(raw);if(venues.length)return{venues,updatedAt:raw.osm3s?.timestamp_osm_base,source:'bundled-osm-snapshot',warning:lastError?.message}}}catch{}
 throw new Error(`Data OpenStreetMap gagal dimuat: ${lastError?.message||'unknown'}`)
}
export function clearCache(){localStorage.removeItem(CACHE_KEY)}
