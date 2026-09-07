import{loadVenues,categories,featureLabels,initA11y,clearAdminLocationsCache}from'./core.js?v=24';
import{fetchAdminAudits,moderateAudit as apiModerateAudit,fetchBusinesses,fetchAdminLocations,saveCustomLocation,updateLocation as apiUpdateLocation,deleteLocation as apiDeleteLocation,approveLocationSuggestion,rejectLocationSuggestion,fetchAdminLeaderboard,removeContributor,fetchAdminBusinesses,verifyBusiness,deleteBusiness,registerBusiness}from'./api.js?v=6';
import{clearCache}from'./osm-api.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let venues=[],auditFilter='pending',deleteTarget=null;
const esc=s=>{const d=document.createElement('div');d.textContent=s??'';return d.innerHTML};
let SERVER_BUSINESSES=[];
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)};
function showView(name){$$('.admin-view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));$$('.admin-nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
 if(name==='locations')renderLocations();
 if(name==='audits')renderAudits();
 if(name==='businesses'){loadAdminBusinesses().then(renderBusinesses)}
 if(name==='leaderboard'){loadAdminLeaderboard().then(renderLeaderboard)}
 if(name==='activity')renderActivity();
 if(name==='suggestions')renderSuggestions();
}
$$('.admin-nav-item').forEach(b=>b.onclick=()=>showView(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
initA11y();
reload();
async function reload(){try{venues=await loadVenues();renderAll()}catch(e){toast(e.message)}}
let SERVER_AUDITS=[];
async function renderAll(){try{SERVER_AUDITS=await fetchAdminAudits()}catch(e){SERVER_AUDITS=[];toast(e.message||'Gagal memuat audit')}try{SERVER_BUSINESSES=await fetchBusinesses()}catch(e){SERVER_BUSINESSES=[]}
try{SERVER_LOCATIONS=await fetchAdminLocations()}catch(e){SERVER_LOCATIONS={custom:[],overrides:[]}}const audits=SERVER_AUDITS,pending=audits.filter(a=>(a.status||'pending')==='pending').length;$('#stat-locations').textContent=venues.length;$('#stat-custom').textContent=SERVER_BUSINESSES.length;$('#stat-pending').textContent=pending;const pendLoc=SERVER_LOCATIONS.filter(l=>l.pending&&!l.deleted);const sb=$('#suggestion-badge');if(sb){sb.textContent=pendLoc.length||''}$('#stat-approved').textContent=audits.filter(a=>a.status==='approved').length;$('#pending-badge').textContent=pending||'';$('#recent-audits').innerHTML=audits.slice(-5).reverse().map(a=>auditMini(a)).join('')||'<p class="empty">Belum ada audit.</p>';renderLocations();renderAudits();renderActivity()}
function auditMini(a){return`<div class="mini-row"><div><strong>${esc(a.locationName)}</strong><small>${new Date(a.timestamp).toLocaleString('id-ID')}</small></div><span class="status ${a.status||'pending'}">${statusLabel(a.status)}</span></div>`}
const statusLabel=s=>({approved:'Disetujui',rejected:'Ditolak',pending:'Menunggu'}[s||'pending']);
function renderLocations(){const q=$('#location-search').value.toLowerCase(),cat=$('#location-category').value;const rows=venues.filter(v=>(cat==='all'||(v.categories||[]).includes(cat)||v.category===cat)&&(!q||v.name.toLowerCase().includes(q)||(v.address||'').toLowerCase().includes(q)||v.id.includes(q))).slice(0,250);$('#locations-body').innerHTML=rows.map(v=>`<tr><td><strong>${esc(v.name)}</strong><small>${esc(v.address||v.id)}</small></td><td>${(v.categories&&v.categories.length?v.categories:[v.category]).map(c=>`<span class="category-pill">${categories[c]?.label||c}</span>`).join()}</td><td>${esc(v.source||'OpenStreetMap')}</td><td><code>${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}</code></td><td><div class="row-actions"><button data-edit="${v.id}">Edit</button><a class="row-map" href="map.html?venue=${encodeURIComponent(v.id)}" target="_blank" rel="noopener">Peta</a><a class="row-sv" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${(+v.lat).toFixed(7)},${(+v.lng).toFixed(7)}" target="_blank" rel="noopener">Street View</a><button class="delete" data-delete="${v.id}">Hapus</button></div></td></tr>`).join('')||'<tr><td colspan="5" class="empty">Tidak ada lokasi.</td></tr>';$$('[data-edit]').forEach(b=>b.onclick=()=>openLocation(venues.find(v=>v.id===b.dataset.edit)));$$('[data-delete]').forEach(b=>b.onclick=()=>confirmDelete(venues.find(v=>v.id===b.dataset.delete)))}
$('#location-search').oninput=renderLocations;$('#location-category').onchange=renderLocations;
function openLocation(v=null){$('#location-form').reset();$('#loc-id').value=v?.id||'';$('#loc-name').value=v?.name||'';$('#loc-address').value=v?.address||'';const cats=[...new Set([...(v?.categories||[]),(v?.category?[v.category]:[])])];$$('[data-loc-cat]').forEach(x=>x.checked=cats.includes(x.dataset.locCat));$('#loc-source').value=v?.source||'Admin lokal';$('#loc-lat').value=v?.lat??'';$('#loc-lng').value=v?.lng??'';$('#dialog-title').textContent=v?'Edit lokasi':'Tambah lokasi';$('#location-dialog').showModal()}
$$('[data-open-location]').forEach(b=>b.onclick=()=>openLocation());
$('#location-cancel').onclick=()=>$('#location-dialog').close();
$('#location-close').onclick=()=>$('#location-dialog').close();
$('#location-form').onsubmit=async e=>{
 e.preventDefault();
 const id=$('#loc-id').value,categories=$$('[data-loc-cat]').filter(x=>x.checked).map(x=>x.dataset.locCat);
 // Koordinat: terima "lat, lng", "lat lng", atau tab — di kedua kombinasi arah
 const latRaw=$('#loc-lat').value.trim(),lngRaw=$('#loc-lng').value.trim();
 let lat=parseFloat(latRaw),lng=parseFloat(lngRaw);
 if((!Number.isFinite(lat)||!Number.isFinite(lng))&&(latRaw||lngRaw)){
  const parts=(latRaw+' '+lngRaw).trim().split(/[\s,;]+/).filter(Boolean).map(parseFloat).filter(Number.isFinite);
  if(parts.length===2){lat=parts[0];lng=parts[1]}
 }
 if(!Number.isFinite(lat)||!Number.isFinite(lng)){toast('Koordinat tidak valid. Contoh: -6.1087136 106.8993756');return}
 const data={name:$('#loc-name').value.trim(),address:$('#loc-address').value.trim(),categories,lat,lng,source:$('#loc-source').value,attributes:Object.fromEntries(categories.map(c=>[c,true]))};
 if(!categories.length){toast('Pilih minimal satu kategori');return}
 // Nama kosong → ambil otomatis dari alamat koordinat (Nominatim)
 if(!data.name){
  const btn=$('#save-location');btn.disabled=true;const prev=btn.textContent;btn.textContent='Mencari nama…';
  try{
   const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id`,{headers:{'Accept':'application/json'}});
   const j=await r.json();
   data.name=(j.name||j.address&&(j.address.amenity||j.address.shop||j.address.office||j.address.building||j.address.road))||'Lokasi tanpa nama';
   if(!data.address&&j.display_name)data.address=String(j.display_name).split(',').slice(0,3).join(',');
  }catch(err){data.name='Lokasi tanpa nama'}
  btn.disabled=false;btn.textContent=prev;
 }
 if(!data.name){toast('Nama lokasi wajib diisi');return}
 try{
  if(id)await apiUpdateLocation(id,data);else await saveCustomLocation(data);
  clearAdminLocationsCache();$('#location-dialog').close();setTimeout(()=>toast(id?'Lokasi diperbarui':'Lokasi masuk antrean usulan — setujui di menu Usulan lokasi agar tampil di peta'),150);reload()
 }catch(err){toast(err.message||'Gagal menyimpan lokasi')}
};
function confirmDelete(v){deleteTarget=v;$('#confirm-text').textContent=`${v.name} akan disembunyikan dari peta pada perangkat ini.`;$('#confirm-dialog').showModal()}
$('#confirm-dialog').addEventListener('close',async()=>{if($('#confirm-dialog').returnValue==='confirm'&&deleteTarget){try{await apiDeleteLocation(deleteTarget.id);toast('Lokasi dihapus')}catch(err){toast(err.message||'Gagal menghapus lokasi')}deleteTarget=null;reload()}});
function renderAudits(){const rows=SERVER_AUDITS.filter(a=>auditFilter==='all'||(a.status||'pending')===auditFilter);$('#audit-queue').innerHTML=rows.slice().reverse().map(a=>`<article class="audit-review"><div class="audit-review-head"><div><strong>${esc(a.locationName)}</strong><small>${esc(a.contributorName||'Anonim')} · ${new Date(a.timestamp).toLocaleString('id-ID')} · ${a.rating}/5</small></div><span class="status ${a.status||'pending'}">${statusLabel(a.status)}</span></div><div class="audit-features">${(a.features||[]).filter(f=>featureLabels[f]).map(f=>`<span> ${featureLabels[f]||f}</span>`).join('')||'<span>Tidak ada fasilitas dipilih</span>'}</div>${a.image?.dataUrl?`<a class="audit-evidence" href="${a.image.dataUrl}" target="_blank" rel="noopener"><img src="${a.image.dataUrl}" alt="Bukti kondisi ${esc(a.locationName)}"><span>Lihat foto bukti </span></a>`:''}${a.explanation?`<div class="audit-explanation"><strong>Penjelasan kontributor</strong><p>${esc(a.explanation)}</p></div>`:''}<label>Catatan moderator<textarea data-note="${a.id}" placeholder="Alasan atau catatan internal">${esc(a.moderationNote||'')}</textarea></label><div class="review-actions"><button class="btn approve-btn" data-approve="${a.id}">Setujui</button><button class="btn reject-btn" data-reject="${a.id}">Tolak</button></div></article>`).join('')||'<div class="admin-card empty">Tidak ada audit pada status ini.</div>';$$('[data-approve]').forEach(b=>b.onclick=()=>moderate(b.dataset.approve,'approved'));$$('[data-reject]').forEach(b=>b.onclick=()=>moderate(b.dataset.reject,'rejected'))}
async function moderate(id,status){const note=$(`[data-note="${id}"]`)?.value||'';try{await apiModerateAudit(id,status,note);toast(status==='approved'?'Audit disetujui':'Audit ditolak')}catch(e){toast(e.message||'Gagal memoderasi')}await renderAll()}
$$('[data-audit-filter]').forEach(b=>b.onclick=()=>{auditFilter=b.dataset.auditFilter;$$('[data-audit-filter]').forEach(x=>x.classList.toggle('active',x===b));renderAudits()});
let SERVER_LOCATIONS={custom:[],overrides:[]};
function renderSuggestions(){
 const pend=SERVER_LOCATIONS.custom.filter(l=>l.pending&&!l.deleted);
 const catLabel={wheelchair_place:'Akses kursi roda',wheelchair_ramp:'Rampa',accessible_restroom:'Toilet aksesibel',tactile_paving:'Jalur taktil'};
 $('#suggestions-list').innerHTML=pend.length?pend.map(l=>`<article class="audit-review"><div class="audit-review-head"><div><strong>${esc(l.name)}</strong><small>${esc(l.contributor_name||'Anonim')} · ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}${l.address?' · '+esc(l.address):''}</small></div><span class="status pending">Menunggu</span></div><div class="audit-features">${(l.categories||[]).map(c=>`<span>${catLabel[c]||c}</span>`).join('')}</div><div class="review-actions"><button class="btn approve-btn" data-approve-loc="${l.id}">Setujui</button><button class="btn reject-btn" data-reject-loc="${l.id}">Tolak</button></div></article>`).join(''):'<p class="empty">Tidak ada usulan lokasi menunggu moderasi.</p>';
 $$('[data-approve-loc]').forEach(b=>b.onclick=async()=>{try{await approveLocationSuggestion(b.dataset.approveLoc);toast('Usulan disetujui')}catch(e){toast(e.message||'Gagal menyetujui')}await reload()});
 $$('[data-reject-loc]').forEach(b=>b.onclick=async()=>{try{await rejectLocationSuggestion(b.dataset.rejectLoc);toast('Usulan ditolak')}catch(e){toast(e.message||'Gagal menolak')}await reload()});
}
function renderActivity(){const rows=SERVER_AUDITS.filter(a=>a.moderatedAt).slice(0,30).map(a=>`<div class="activity-row"><span>${new Date(a.moderatedAt).toLocaleString('id-ID')}</span><strong>${esc(statusLabel(a.status))}</strong><span>${esc(a.locationName)}</span></div>`).join('')||'<p class="empty">Belum ada aktivitas moderasi.</p>';$('#activity-list').innerHTML=rows}
const bizBadge={platinum:'P',gold:'G',silver:'S',bronze:'B'};
const SERVICE_LABELS={kursi_roda:'Kursi roda',tuna_netra:'Tuna netra',bahasa_isyarat:'Isyarat',lansia:'Lansia'};
let ADMIN_BUSINESSES=[];
async function loadAdminBusinesses(){try{ADMIN_BUSINESSES=await fetchAdminBusinesses();}catch(e){ADMIN_BUSINESSES=[];toast(e.message||'Gagal memuat usaha')}}
function renderBusinesses(){
 const q=($('#businesses-search')?.value||'').toLowerCase();
 const flt=$('#businesses-filter')?.value||'all';
 const rows=ADMIN_BUSINESSES.filter(b=>{
   if(flt==='accessible'&&!b.services?.length)return false;
   if(flt==='unverified'&&b.verified)return false;
   if(!q)return true;
   const hay=(b.name+' '+b.address+' '+(b.owner_name||'')+' '+(b.owner_email||'')).toLowerCase();
   return hay.includes(q);
 });
 const body=$('#businesses-body');const empty=$('#businesses-empty');
 if(!body)return;
 if(rows.length===0){body.innerHTML='';empty.hidden=false;return}
 empty.hidden=true;
 body.innerHTML=rows.map(b=>{
   const services=(b.services||[]).map(s=>`<span class="biz-svc-chip">${SERVICE_LABELS[s]||s}</span>`).join('')||'<small style="color:var(--muted)">—</small>';
   const accessible=b.services?.length?`<span class="biz-accessible-badge">Aksesibel</span>`:'<small style="color:var(--muted)">—</small>';
   const statusBadge=b.verified?'<span style="color:var(--green);font-weight:700">Terverifikasi</span>':'<span style="color:var(--amber);font-weight:700">Menunggu</span>';
   return `<tr><td><strong>${esc(b.name)}</strong><small>${esc(b.address||'')}</small></td><td><small>${esc(b.owner_name||'—')}</small><small>${esc(b.owner_email||'')}</small></td><td>${services}</td><td>${accessible}<br>${statusBadge}</td><td><div class="row-actions"><button class="btn btn-outline" data-biz-verify="${b.id}" data-verified="${b.verified?'1':'0'}">${b.verified?'Batalkan verifikasi':'Verifikasi'}</button><button class="delete" data-biz-delete="${b.id}">Hapus</button></div></td></tr>`;
 }).join('');
 $$('[data-biz-verify]').forEach(b=>b.onclick=async()=>{const id=b.dataset.bizVerify;const next=b.dataset.verified!=='1';try{await verifyBusiness(id,next);toast(next?'Usaha diverifikasi':'Verifikasi dibatalkan');await loadAdminBusinesses();renderBusinesses()}catch(e){toast(e.message)}});
 $$('[data-biz-delete]').forEach(b=>b.onclick=async()=>{const id=b.dataset.bizDelete;if(!confirm('Hapus usaha ini? Semua review terkait ikut terhapus.'))return;try{await deleteBusiness(id);toast('Usaha dihapus');await loadAdminBusinesses();renderBusinesses()}catch(e){toast(e.message)}});
}
$('#businesses-search')?.addEventListener('input',renderBusinesses);
$('#businesses-filter')?.addEventListener('change',renderBusinesses);

let ADMIN_LEADERBOARD=[];
async function loadAdminLeaderboard(){try{ADMIN_LEADERBOARD=await fetchAdminLeaderboard();}catch(e){ADMIN_LEADERBOARD=[]}}
function renderLeaderboard(){
 const q=($('#leaderboard-search')?.value||'').toLowerCase();
 const rows=ADMIN_LEADERBOARD.filter(r=>!q||r.name.toLowerCase().includes(q));
 const body=$('#leaderboard-body');const empty=$('#leaderboard-empty');
 if(!body)return;
 if(rows.length===0){body.innerHTML='';empty.hidden=false;return}
 empty.hidden=true;
 body.innerHTML=rows.map((r,i)=>`<tr><td class="rank">${i+1}</td><td><strong>${esc(r.name)}</strong></td><td>${r.count}</td><td><strong>${r.points}</strong></td><td><div class="row-actions"><button class="delete" data-lb-remove="${esc(r.name)}">Hapus</button></div></td></tr>`).join('');
 $$('[data-lb-remove]').forEach(b=>b.onclick=async()=>{const name=b.dataset.lbRemove;if(!confirm(`Hapus kontributor "${name}" dari leaderboard? Audit mereka akan ditandai ditolak.`))return;try{const r=await removeContributor(name);toast(`${r.removed} kontribusi dihapus`);await loadAdminLeaderboard();renderLeaderboard()}catch(e){toast(e.message)}});
}
$('#leaderboard-search')?.addEventListener('input',renderLeaderboard);
$('#export-btn').onclick=()=>{const blob=new Blob([JSON.stringify(SERVER_AUDITS,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`akseskota-audits-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
// Import backup tidak didukung mode server; elemen #import-file sengaja tidak dirender.
$('#refresh-osm').onclick=()=>{clearCache();toast('Cache OSM dibersihkan');reload()};
await reload();
