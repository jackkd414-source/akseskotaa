import{shell,initShell,initLogout,loadVenues,categories,featureLabels,initAnimations}from'./core.js?v=25';
import{routeProfileLabel}from'./accessible-routing.js?v=3';
import{planFacilityRoutes}from'./facility-routing.js?v=4';
import{debounce,reverseGeocode,searchPlaces}from'./map-network.js?v=2';
import{fetchBusinesses}from'./api.js?v=6';
import{getAuth}from'./user-store.js';
import{deleteLocation,suggestLocation,updateLocation}from'./api.js?v=6';import{clearAdminLocationsCache}from'./core.js?v=25';
let MAP_BUSINESSES=[];fetchBusinesses().then(b=>{MAP_BUSINESSES=b}).catch(()=>{});
const isBusinessLocation=id=>MAP_BUSINESSES.some(b=>b.locationId===id);
const getBusinessForLocation=id=>MAP_BUSINESSES.find(b=>b.locationId===id)||null;
document.querySelector('#shell').innerHTML=shell('map');initShell();initLogout();initAnimations();
const $=s=>document.querySelector(s);let venues=[],filtered=[],selected=null,userLocation=null,routeLayer=null,routeDestination=null,routeProfile='wheelchair',locationMarker=null;
const map=L.map('map',{center:[-6.225,106.822],zoom:12,maxZoom:19,zoomControl:false});
let initialBoundsSet=false;
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,detectRetina:false,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});L.control.zoom({position:'bottomright'}).addTo(map);
const clusters=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:48,iconCreateFunction:c=>L.divIcon({className:'',html:`<div class="cluster-inner">${c.getChildCount()}</div>`,iconSize:[42,42]})}).addTo(map);
const markerById=new Map();
function icon(v){const c=categories[v.category]||categories.wheelchair_ramp;const biz=isBusinessLocation(v.id);const bizBadge=biz?'<div class="biz-marker-badge" title="Usaha Aksesibel"></div>':'';return L.divIcon({className:'',html:`<div class="marker-wrap">${bizBadge}<div class="custom-marker-inner" style="background:${c.color}"><span>${c.letter}</span></div></div>`,iconSize:[44,58],iconAnchor:[22,50]})}
// ---------- Edit lokasi langsung dari peta (admin) ----------
let editingVenueId=null;
function openEditDialog(v){
  editingVenueId=v.id;
  const dlg=document.getElementById('add-location-dialog');
  document.getElementById('add-location-title').textContent='Edit lokasi';
  document.getElementById('add-location-coords').textContent=`Koordinat: ${(+v.lat).toFixed(5)}, ${(+v.lng).toFixed(5)}`;
  document.getElementById('add-location-note').textContent='Perubahan langsung tersimpan dan tampil di peta.';
  document.getElementById('add-loc-name').value=v.name||'';
  document.getElementById('add-loc-address').value=v.address||'';
  document.querySelectorAll('[data-add-cat]').forEach(x=>{
    x.checked=(v.categories||[]).includes(x.dataset.addCat)||(v.category===x.dataset.addCat);
  });
  const submit=document.getElementById('add-location-submit');
  submit.textContent='Simpan perubahan';
  const wrap=document.getElementById('add-name-wrap');
  if(wrap)wrap.style.display='none';
  if(!dlg.open)dlg.showModal();
  document.getElementById('add-loc-name').focus();
}
function resetAddDialog(){
  editingVenueId=null;
  const submit=document.getElementById('add-location-submit');
  if(submit)submit.textContent='Kirim';
  const wrap=document.getElementById('add-name-wrap');
  if(wrap)wrap.style.display='';
}

// ---------- Tambah lokasi langsung dari peta ----------
let addPickMode=false,addPickMarker=null;
const addBtn=document.getElementById('add-location-btn');
const addDlg=document.getElementById('add-location-dialog');
if(addBtn){
  addBtn.onclick=()=>{
    if(addPickMode){stopAddPick();return}
    startAddPick();
  };
  document.getElementById('add-location-close').onclick=()=>{addDlg.close();resetAddDialog();stopAddPick()};
  document.getElementById('add-location-cancel').onclick=()=>{addDlg.close();resetAddDialog();stopAddPick()};
  addDlg.addEventListener('close',()=>{resetAddDialog();if(addPickMode)stopAddPick()});
  document.getElementById('add-location-form').onsubmit=async e=>{
    e.preventDefault();
    const submitBtn=document.getElementById('add-location-submit');
    const categories=[...document.querySelectorAll('[data-add-cat]')].filter(x=>x.checked).map(x=>x.dataset.addCat);
    const name=document.getElementById('add-loc-name').value.trim();
    const address=document.getElementById('add-loc-address').value.trim();
    if(editingVenueId){
      if(name.length<2){toastSV('Nama minimal 2 karakter.');return}
      if(!categories.length){toastSV('Pilih minimal satu kategori.');return}
      const tgt=venues.find(x=>x.id===editingVenueId);
      if(!tgt){toastSV('Lokasi tidak ditemukan.');return}
      submitBtn.disabled=true;submitBtn.textContent='Menyimpan…';
      try{
        await updateLocation(editingVenueId,{name,address,categories,lat:+tgt.lat,lng:+tgt.lng,attributes:Object.fromEntries(categories.map(c=>[c,true]))});
        addDlg.close();
        toastSV('Lokasi diperbarui.');
        tgt.name=name;tgt.address=address;tgt.categories=categories;tgt.category=categories[0]||tgt.category;
        clearAdminLocationsCache();
        fillTripPlaces();applyFilters();
        if(selected?.id===editingVenueId)showDetail(tgt);
      }catch(err){toastSV(err.message||'Gagal menyimpan perubahan.');submitBtn.disabled=false;submitBtn.textContent='Simpan perubahan'}
      return;
    }
    if(!addPickCoords){toastSV('Klik lokasi di peta dulu.');return}
    if(name.length<2){toastSV('Nama minimal 2 karakter.');return}
    if(!categories.length){toastSV('Pilih minimal satu kategori.');return}
    submitBtn.disabled=true;submitBtn.textContent='Mengirim…';
    try{
      const r=await suggestLocation({
        name,
        address,
        lat:addPickCoords.lat,lng:addPickCoords.lng,
        categories,
        contributorName:document.getElementById('add-loc-contributor').value.trim()
      });
      addDlg.close();
      toastSV(r.message||'Tersimpan. Menunggu verifikasi admin sebelum tampil di peta.');
      stopAddPick();
    }catch(err){toastSV(err.message||'Gagal mengirim lokasi.');submitBtn.disabled=false;submitBtn.textContent='Kirim'}
  };
}
let addPickCoords=null;
function startAddPick(){
  addPickMode=true;addPickCoords=null;
  addBtn.textContent='Klik titik di peta';
  addBtn.classList.add('picking');
  map.getContainer().style.cursor='crosshair';
  toastSV('Klik titik di peta untuk lokasi baru. Tekan Escape untuk batal.');
}
function stopAddPick(){
  addPickMode=false;addPickCoords=null;
  addBtn.textContent='Tambah lokasi';addBtn.classList.remove('picking');
  map.getContainer().style.cursor='';
  if(addPickMarker){map.removeLayer(addPickMarker);addPickMarker=null}
  document.removeEventListener('keydown',addEscape);
}
function addEscape(e){if(e.key==='Escape')stopAddPick()}
document.addEventListener('keydown',addEscape);
map.on('click',e=>{
  if(!addPickMode||editingVenueId)return;
  addPickCoords={lat:e.latlng.lat,lng:e.latlng.lng};
  if(addPickMarker)map.removeLayer(addPickMarker);
  addPickMarker=L.circleMarker([addPickCoords.lat,addPickCoords.lng],{radius:10,color:'#fff',weight:3,fillColor:'#1C5B41',fillOpacity:1}).addTo(map);
  const isAdmin=getAuth()?.role==='admin';
  document.getElementById('add-location-title').textContent=isAdmin?'Tambah lokasi':'Usulkan lokasi';
  document.getElementById('add-location-coords').textContent=`Koordinat: ${addPickCoords.lat.toFixed(5)}, ${addPickCoords.lng.toFixed(5)}`;
  document.getElementById('add-location-note').textContent='Setiap lokasi baru diverifikasi di konsol admin sebelum tampil di peta publik.';
  if(!addDlg.open)addDlg.showModal();
  document.getElementById('add-loc-name').focus();
});

function renderMarkers(){clusters.clearLayers();markerById.clear();filtered.forEach(v=>{const m=L.marker([v.lat,v.lng],{icon:icon(v),title:v.name}).on('click',()=>showDetail(v));markerById.set(v.id,m);});clusters.addLayers([...markerById.values()])}
function renderResults(){const box=$('#results');$('#result-meta').textContent=`${filtered.length} lokasi aktif`;box.innerHTML=filtered.slice(0,100).map(v=>{const c=categories[v.category]||categories.wheelchair_ramp;const sub=escapeHTML(locationSubtitle(v));return `<button class="result ${selected?.id===v.id?'active':''}" data-id="${v.id}"><span class="result-icon" style="color:${c.color}">${c.letter}</span><span><strong>${escapeHTML(v.name)}</strong><small>${sub}</small></span></button>`}).join('');box.querySelectorAll('.result').forEach(b=>b.onclick=()=>focusVenue(venues.find(v=>v.id===b.dataset.id)))}
function escapeHTML(s=''){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function locationSubtitle(v){return v.address&&v.address.trim()?v.address:`${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}`}
async function awaitRefreshVenues(){try{await loadRealData(true)}catch{/* status sudah ditangani loadRealData */}}

function showDetail(v){selected=v;const c=categories[v.category]||categories.wheelchair_ramp;const features=Object.entries(v.attributes||{}).filter(([k])=>featureLabels[k]).filter(([,val])=>val===true||val===false).map(([k,val])=>`<span class="feature">${featureLabels[k]}: ${val===true?'tersedia':'tidak tersedia'}</span>`).join('');const updated=v.osm_updated_at?new Date(v.osm_updated_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'waktu tidak tersedia';const biz=getBusinessForLocation(v.id);const bizSection=biz?`<div class="detail-business"><strong>Usaha Aksesibel</strong><small style="display:block;margin-top:6px;color:var(--muted)">Skor ${biz.score||0} · ${biz.reviewCount||0} review · ${biz.trend==='improving'?'Berkembang':biz.trend==='declining'?'Menurun':'Stabil'}</small></div>`:'';$('#detail').innerHTML=`<div class="detail-top"><div><span class="detail-category">${c.label}</span><h2>${escapeHTML(v.name)}</h2><p id="detail-addr">${escapeHTML(locationSubtitle(v))}</p></div><button class="detail-close" id="detail-close" aria-label="Tutup detail">×</button></div>${bizSection}<div class="feature-list">${features}</div><p><strong>${v.source==='Admin lokal'?'Data admin':'Belum diverifikasi'}</strong></p>${v.source==='Admin lokal'?'':`<details class="detail-warn"><summary>Kondisi bisa berubah</summary><div class="warn-body"><p>Data ${updated} dari OpenStreetMap, bukan hasil pemeriksaan langsung.</p></div></details>`}${getAuth()?.role==='admin'?`<div class="detail-admin-actions"><button class="btn btn-outline" id="detail-edit-btn">Edit lokasi</button><button class="btn btn-outline detail-delete" id="detail-delete-btn">Hapus lokasi</button></div>`:''}<div class="detail-actions"><button class="btn btn-outline" id="route-btn">Petunjuk arah</button><a class="btn btn-primary" href="audit.html?venue=${encodeURIComponent(v.id)}">Audit lokasi</a><a class="btn btn-outline" href="business.html?location=${encodeURIComponent(v.id)}&name=${encodeURIComponent(v.name)}">Daftar usaha di sini</a><button class="btn street-btn" id="street-btn" aria-label="Buka panorama 3D Street View di sekitar ${escapeHTML(v.name)}">Lihat Street View sekitar</button><a class="btn btn-outline" href="https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}" target="_blank" rel="noopener">Google Maps</a></div>`;$('#detail').classList.add('open');if(!v.address||!v.address.trim()){reverseGeocode(v.lat,v.lng,()=>selected===v&&$('#detail').classList.contains('open')).then(a=>{const el=document.getElementById('detail-addr');if(el&&a&&selected===v)el.textContent=a})}$('#detail-close').onclick=()=>$('#detail').classList.remove('open');$('#route-btn').onclick=()=>routeTo(v);$('#street-btn').onclick=()=>openStreetView(v);$('#detail-edit-btn')?.addEventListener('click',()=>openEditDialog(v));$('#detail-delete-btn')?.addEventListener('click',async()=>{if(!confirm(`Hapus "${v.name}" dari peta? Lokasi disembunyikan dan bisa dipulihkan dari konsol admin.`))return;try{await deleteLocation(v.id)}catch(e){toastSV(e.message||'Gagal menghapus lokasi');return}toastSV(`"${v.name}" dihapus dari peta.`);$('#detail').classList.remove('open');clearAdminLocationsCache();venues=venues.filter(x=>x.id!==v.id);if(selected?.id===v.id)selected=null;fillTripPlaces();applyFilters()});renderResults()}
const svCache=new Map();
let svCheckDisabled=false;
async function hasStreetView(lat,lng){
  if(svCheckDisabled)return null;
  const key=`${lat.toFixed(4)},${lng.toFixed(4)}`;
  if(svCache.has(key))return svCache.get(key);
  let result=null;
  try{
    const res=await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?source=outdoor&location=${lat},${lng}&radius=50`,{signal:AbortSignal.timeout(5000)});
    if(res.ok){
      const data=await res.json();
      if(data.status==='OK')result=true;
      else if(data.status==='ZERO_RESULTS')result=false;
      else if(data.status==='REQUEST_DENIED'||data.status==='OVER_QUERY_LIMIT'){svCheckDisabled=true;result=null}
    }
  }catch{result=null}
  svCache.set(key,result);
  return result;
}
async function openStreetView(v){
  const btn=$('#street-btn');
  const url=`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(v.lat)},${encodeURIComponent(v.lng)}`;
  btn.disabled=true;const orig=btn.textContent;btn.textContent='Memeriksa…';
  let has;
  try{has=await hasStreetView(v.lat,v.lng)}catch{has=null}finally{btn.disabled=false;btn.textContent=orig}
  if(has===false){
    btn.textContent='Street View tidak tersedia';
    toastSV('Street View belum tersedia di titik ini. Gunakan foto audit untuk melihat kondisi.');
    setTimeout(()=>{btn.textContent=orig},3000);
    return;
  }
  window.open(url,'_blank','noopener,noreferrer');
}
function toastSV(msg){
  let el=document.getElementById('sv-toast');
  if(!el){el=document.createElement('div');el.id='sv-toast';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1b3d2f;color:#fff;padding:10px 16px;border-radius:8px;font-size:.9rem;z-index:10000;box-shadow:0 4px 14px rgba(0,0,0,.25)';document.body.appendChild(el)}
  el.textContent=msg;el.style.opacity='1';
  clearTimeout(el._t);el._t=setTimeout(()=>{el.style.opacity='0'},3500);
}
function focusVenue(v){if(!v)return;map.setView([v.lat,v.lng],16);const m=markerById.get(v.id);if(m)clusters.zoomToShowLayer(m,()=>m.fire('click'));if(innerWidth<861)$('#map-sidebar').classList.remove('open')}
function applyFilters(){const cat=$('#category-chips .chip.active')?.dataset.category||'all',q=$('#search').value.trim().toLowerCase();filtered=venues.filter(v=>{if(q&&!v.name.toLowerCase().includes(q)&&!(v.address||'').toLowerCase().includes(q))return false;if(cat==='all')return true;if(cat==='business')return isBusinessLocation(v.id);return v.category===cat});renderMarkers();renderResults();if(q&&filtered.length===1)focusVenue(filtered[0])}
$('#category-chips').onclick=e=>{const chip=e.target.closest('.chip');if(!chip)return;document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c===chip));applyFilters()};const delayedFilter=debounce(applyFilters,250);$('#search-form').onsubmit=e=>{e.preventDefault();delayedFilter.cancel();applyFilters()};$('#search').oninput=delayedFilter;$('#expand-search').onclick=()=>$('#map-sidebar').classList.toggle('open');
function locate(){return new Promise((resolve,reject)=>{if(!navigator.geolocation){alert('Geolokasi tidak didukung browser ini.');reject(new Error('Geolokasi tidak didukung'));return}if(!window.isSecureContext){alert('Geolokasi butuh HTTPS atau localhost. Buka situs via URL aman, bukan IP publik HTTP.');reject(new Error('insecure'));return}const btn=$('#location-btn');btn.textContent='Mencari…';const opts={enableHighAccuracy:true,timeout:15000,maximumAge:0};navigator.geolocation.getCurrentPosition(p=>{const acc=Math.round(p.coords.accuracy);userLocation=[p.coords.latitude,p.coords.longitude];map.setView(userLocation,acc>80?14:16);if(locationMarker){map.removeLayer(locationMarker._group)}locationMarker={_group:L.layerGroup([L.circleMarker(userLocation,{radius:7,color:'#fff',weight:3,fillColor:'#2878b5',fillOpacity:1}).bindTooltip(`Lokasi Anda · ±${acc} m`).openTooltip(),L.circle(userLocation,{radius:acc,color:'#2878b5',weight:1,fillOpacity:.08})]).addTo(map)};btn.textContent='Lokasi saya';btn.title=`Akurasi ±${acc} m`;resolve(userLocation)},e=>{const msg={1:'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser, lalu coba lagi.',2:'Perangkat tidak dapat menentukan posisi. Pastikan layanan lokasi (GPS) aktif di perangkat.',3:'Waktu permintaan lokasi habis. Coba lagi di area terbuka.'}[e.code]||'Lokasi gagal diambil.';alert(msg);btn.textContent='Lokasi saya';reject(e)},opts)})}$('#location-btn').onclick=()=>locate().catch(()=>{});
function renderRoute(route){if(routeLayer)map.removeLayer(routeLayer);routeLayer=L.polyline(route.coordinates,{color:route.profile==='walking'?'#2878b5':'#176b45',weight:7,opacity:.9,lineCap:'round'}).addTo(map);map.fitBounds(routeLayer.getBounds(),{padding:[55,55]});$('#route-summary').innerHTML=`<div><strong>${route.distanceKm<1?Math.round(route.distanceKm*1000)+' m':route.distanceKm.toFixed(1)+' km'}</strong><small>Jarak</small></div><div><strong>${route.durationMinutes} mnt</strong><small>Estimasi</small></div>`;$('#route-quality').innerHTML=route.warnings.map(w=>`<div class="route-warning">${escapeHTML(w)}</div>`).join('')+`<div class="route-engine">${escapeHTML(routeProfileLabel(route.profile))} · ${escapeHTML(route.engine)}</div>`;$('#route-steps').innerHTML=route.maneuvers.map((m,i)=>`<li><span class="route-step-num">${i+1}</span><span>${escapeHTML(m.instruction)}</span><small>${escapeHTML(m.distance)}</small></li>`).join('')}
let routeRun=0, pickMode=null;
const picked={}, pointMarkers={};
function setTripPoint(which,lat,lng){
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){$('#trip-status').textContent='Koordinat tidak valid.';return;}
 const id=`picked-${which}`,name=`Titik ${which==='origin'?'asal':'tujuan'} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
 picked[which]={id,name,lat,lng};
 const select=$(`#trip-${which}`);select.querySelector(`option[value="${id}"]`)?.remove();select.add(new Option(name,id));select.value=id;if(which==='target'){$('#destination-search').value=name;$('#destination-search').setCustomValidity('')}updateTripHint();
 if(pointMarkers[which])map.removeLayer(pointMarkers[which]);
 pointMarkers[which]=L.marker([lat,lng],{icon:L.divIcon({className:'trip-point-wrap',iconSize:[44,44],iconAnchor:[22,44],html:`<span class="trip-point"><span>${which==='origin'?'A':'B'}</span></span>`})}).addTo(map);
 $('#trip-status').textContent=`${name} dipilih.`;
}
function updateTripHint(){const origin=$('#trip-origin').selectedOptions[0]?.textContent||'Lokasi saya';const profLabel={wheelchair:'Kursi roda',elderly:'Lansia',walking:'Jalan kaki'}[$('#trip-profile').value]||'Kursi roda';$('#trip-origin-hint').textContent=`Dari ${origin.replace(' (izin GPS)','')} · ${profLabel}`;}
function fillTripPlaces(){
 for(const which of ['origin','target']){
  const select=$(`#trip-${which}`),old=select.value;
  select.replaceChildren(new Option(which==='origin'?'Lokasi saya (izin GPS)':'Pilih tujuan…',which==='origin'?'gps':''));
  for(const v of venues)select.add(new Option(v.name,v.id));
  if(picked[which])select.add(new Option(picked[which].name,picked[which].id));
  if([...select.options].some(o=>o.value===old))select.value=old;
 }
 const list=$('#destination-places');list.replaceChildren();
 const names=new Set();for(const v of venues){if(names.has(v.name))continue;names.add(v.name);list.append(new Option(v.name,v.name));}
 updateTripHint();
}
for(const which of ['origin','target']){
 $(`#pick-${which}`).onclick=()=>{pickMode=which;$('#trip-status').textContent='Klik titik pada peta. Tekan Escape untuk batal.';if(innerWidth<861)$('#map-sidebar').classList.remove('open')};
}
map.on('click',e=>{if(pickMode){setTripPoint(pickMode,e.latlng.lat,e.latlng.lng);pickMode=null;}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')pickMode=null});
function tripPlace(which){const id=$(`#trip-${which}`).value;return picked[which]?.id===id?picked[which]:venues.find(v=>v.id===id)}
function showRouteOptions(plan){
 const box=$('#route-options');box.replaceChildren();
 const note=document.createElement('p');note.className='route-note';note.textContent=plan.reason;box.append(note);
 const fmt=route=>`${route.distanceKm<1?Math.round(route.distanceKm*1000)+' m':route.distanceKm.toFixed(1)+' km'} · ${route.durationMinutes} mnt`;
 if(!plan.options.length){renderRoute(plan.direct);}
 // Satu kartu per jenis fasilitas — masing-masing punya rute sendiri.
 const cards=plan.options.map(opt=>{
  const btn=document.createElement('button');btn.type='button';btn.className='route-choice';
  btn.setAttribute('aria-pressed','false');
  btn.innerHTML=`<strong>Lewat ${opt.label}</strong><small>${fmt(opt.route)}</small>`;
  btn.dataset.venue=opt.venue.name;
  btn.onclick=()=>{
   box.querySelectorAll('.route-choice').forEach(b=>{const on=b===btn;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
   renderRoute(opt.route);
  };
  return btn;
 });
 box.append(...cards);
 if(cards.length)cards[0].click(); else renderRoute(plan.direct);
 // Jelaskan fasilitas pilihan yang tidak dapat rute — biar user tahu kenapa.
 const NOTE_TEXT={onroute:'sudah dilewati rute langsung',far:'melebihi batas tambahan jarak',none:'tidak ada di sekitar rute'};
 for(const n of plan.notes||[]){
  const p=document.createElement('p');p.className='route-via';p.textContent=n.label+': '+NOTE_TEXT[n.status]+'.';box.append(p);
 }
}
async function calculateRoute(){
 routeProfile=$('#trip-profile').value;
 document.querySelectorAll('[data-route-profile]').forEach(b=>{const active=b.dataset.routeProfile===routeProfile;b.classList.toggle('active',active);b.setAttribute('aria-checked',String(active))});
 const run=++routeRun;routeDestination=tripPlace('target');
 if(!routeDestination){$('#trip-status').textContent='Pilih tujuan terlebih dahulu.';return;}
 let origin;
 if($('#trip-origin').value==='gps'){try{origin=await locate()}catch{return}}else{const v=tripPlace('origin');if(!v)return;origin=[v.lat,v.lng]}
 if(run!==routeRun)return;
 if(Math.abs(origin[0]-routeDestination.lat)<0.00001&&Math.abs(origin[1]-routeDestination.lng)<0.00001){$('#trip-status').textContent='Asal dan tujuan harus berbeda.';return;}
 $('#route-destination').textContent=routeDestination.name;$('#route-from').value=$('#trip-origin').selectedOptions[0].textContent;
 $('#route-panel').classList.add('open');$('#route-panel').classList.remove('minimized');setMinimizeBtn(true);$('#detail').classList.remove('open');$('#route-loading').hidden=false;$('#route-options').replaceChildren();$('#route-quality').replaceChildren();$('#route-steps').replaceChildren();
 if(routeLayer){map.removeLayer(routeLayer);routeLayer=null}
 $('#trip-status').textContent='Menghitung rute dan rute fasilitas pilihan…';
 if(innerWidth<861)$('#map-sidebar').classList.remove('open');
 try{
  const plan=await planFacilityRoutes({origin,destination:routeDestination,profile:routeProfile,venues:venues.map(v=>({...v,isBusiness:isBusinessLocation(v.id)})),preferences:[...document.querySelectorAll('#trip-form input[name=facility]:checked')].map(e=>e.value),maxDetourRatio:Number($('#trip-detour').value)});
  if(run!==routeRun)return;showRouteOptions(plan);
 }catch(e){if(run!==routeRun)return;$('#route-quality').textContent=e.message+' Coba lagi, atau pilih profil Jalan kaki secara manual. Profil tersebut dapat melewati tangga.';$('#trip-status').textContent='Rute belum tersedia; tidak ada rute rekaan yang ditampilkan.'}
 finally{if(run===routeRun)$('#route-loading').hidden=true}
}
async function resolveDestination(){
 const input=$('#destination-search'),q=input.value.trim().toLowerCase();
 const current=tripPlace('target');if(current?.name.toLowerCase()===q){input.setCustomValidity('');return true;}
 const exact=venues.filter(v=>v.name.toLowerCase()===q),partial=venues.filter(v=>v.name.toLowerCase().includes(q));
 const v=exact.length===1?exact[0]:!exact.length&&partial.length===1?partial[0]:null;
 if(v){$('#trip-target').value=v.id;input.value=v.name;input.setCustomValidity('');return true;}
 // Tidak ada di data AksesKota → cari bangunan via geocoding (tetap area Jakarta/Bekasi)
 if(q.length>=3){
  const found=await searchPlaces(q,3);
  if(found.length){
   setTripPoint('target',found[0].lat,found[0].lng);
   input.value=$('#destination-search').value;
   input.setCustomValidity('');
   return true;
  }
 }
 input.setCustomValidity(exact.length>1?'Ada beberapa tempat dengan nama ini. Pilih titik yang tepat di peta.':'Nama tempat tidak ditemukan. Coba ketik nama bangunan atau pilih titik di peta.');return false;
}
$('#destination-search').oninput=()=>{$('#destination-search').setCustomValidity('');$('#trip-target').value='';queueGeocodeSuggest()};
const geocodeSuggest=debounce(async()=>{
 const q=$('#destination-search').value.trim();const list=$('#destination-places');
 if(q.length<3||tripPlace('target')?.name.toLowerCase()===q.toLowerCase())return;
 const found=await searchPlaces(q,6);
 if(!found.length||$('#destination-search').value.trim()!==q)return;
 // gabung: venue internal dulu, lalu hasil geocoding (tanpa duplikat nama)
 const opts=[];
 const seen=new Set();
 for(const v of venues){if(v.name.toLowerCase().includes(q.toLowerCase())&&!seen.has(v.name)){seen.add(v.name);opts.push(v.name)}}
 for(const r of found){if(!seen.has(r.name)){seen.add(r.name);opts.push(r.name)}}
 list.replaceChildren(...opts.slice(0,10).map(n=>new Option(n)));
},700);
function queueGeocodeSuggest(){geocodeSuggest()}
$('#destination-search').onchange=resolveDestination;
$('#trip-origin').onchange=updateTripHint;$('#trip-profile').onchange=updateTripHint;
$('#trip-form').onsubmit=async e=>{e.preventDefault();const ok=await resolveDestination();if(ok)calculateRoute();else $('#destination-search').reportValidity()};
function routeTo(v){$('#trip-target').value=v.id;$('#destination-search').value=v.name;$('#destination-search').setCustomValidity('');calculateRoute()}
document.querySelectorAll('[data-route-profile]').forEach(btn=>btn.onclick=()=>{routeProfile=btn.dataset.routeProfile;$('#trip-profile').value=routeProfile;document.querySelectorAll('[data-route-profile]').forEach(b=>{const active=b===btn;b.classList.toggle('active',active);b.setAttribute('aria-checked',String(active))});calculateRoute()});
function setMinimizeBtn(expanded){const b=$('#route-minimize');if(!b)return;b.textContent=expanded?'−':'+';b.setAttribute('aria-expanded',String(expanded))}
$('#route-close').onclick=()=>{routeRun++;$('#route-loading').hidden=true;$('#route-panel').classList.remove('open');$('#route-panel').classList.remove('minimized');setMinimizeBtn(true);if(routeLayer){map.removeLayer(routeLayer);routeLayer=null}};
$('#route-minimize').onclick=(e)=>{e.stopPropagation();const min=$('#route-panel').classList.toggle('minimized');setMinimizeBtn(!min)};
// Ketika disusutkan, ketuk bilah judul untuk membuka lagi
$('#route-panel').addEventListener('click',e=>{if(e.target.closest('button'))return;const p=$('#route-panel');if(p.classList.contains('minimized')){p.classList.remove('minimized');setMinimizeBtn(true)}});
async function loadRealData(fresh=false){const status=$('#data-status'),refresh=$('#refresh-data');refresh.disabled=true;status.querySelector('strong').textContent=fresh?'Memperbarui OpenStreetMap…':'Mengambil data OpenStreetMap…';try{venues=await loadVenues({fresh});fillTripPlaces();applyFilters();if(!initialBoundsSet){const bounds=L.latLngBounds(venues.map(v=>[v.lat,v.lng]));if(bounds.isValid())map.fitBounds(bounds,{padding:[30,30],maxZoom:13});initialBoundsSet=true;}if(!map.hasLayer(tiles))tiles.addTo(map);const when=venues.updatedAt?new Date(venues.updatedAt).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'baru saja';status.querySelector('strong').textContent=`Data peta aktif · ${venues.length} lokasi`;status.querySelector('span').textContent=`Data ${when}${venues.dataSource==='live'?' · langsung':venues.dataSource==='cache'?' · cache 1 jam':venues.dataSource==='stale-cache'?' · cache lama':' · tersimpan'}. Kondisi fisik dapat berubah.`}catch(e){status.querySelector('strong').textContent='Data real gagal dimuat';status.querySelector('span').textContent=e.message;$('#result-meta').textContent='Tidak ada data demo yang ditampilkan'}finally{refresh.disabled=false;if(!map.hasLayer(tiles))tiles.addTo(map)}}
$('#refresh-data').onclick=()=>loadRealData(true);
await loadRealData();
// Deep-link: map.html?venue=<id> → fokus + buka detail (dipakai tombol "Peta" di konsol admin)
{
  const vid=new URLSearchParams(location.search).get('venue');
  if(vid){const v=venues.find(x=>x.id===vid);if(v)focusVenue(v)}
}
