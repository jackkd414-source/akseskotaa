import{getAuth,logout}from'./user-store.js';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

const KEY_CONTRAST = 'akseskota_contrast';
const KEY_TEXT = 'akseskota_text_size';
const KEY_MOTION = 'akseskota_motion';

function closeMenu() {
  const btn = $('#menu-btn'), list = $('#navlinks');
  if (!btn || !list) return;
  list.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
}

function closePanel() {
  const btn = $('#a11y-btn'), panel = $('#a11y-panel');
  if (!btn || !panel) return;
  panel.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}

export function initShell() {
  // Pastikan handler terpasang setelah DOM tersedia; modul ES dieksekusi
  // sebelum parsing selesai sehingga querySelector masih kosong.
  // Nama "runBootstrap" unik di sini: modul lain punya fungsi "boot" yang
  // menimpa arrow-function bernama sama di scope ini.
  const runBootstrap = () => {
    const menu = $('#menu-btn'), links = $('#navlinks');

    menu?.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
      if (open) links.querySelector('.navlink')?.focus();
    });

    // Escape menutup panel dan menu, lalu mengembalikan fokus ke pemicunya
    // supaya pengguna keyboard tidak kehilangan posisi.
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const panel = $('#a11y-panel'), panelBtn = $('#a11y-btn');
      if (panel && !panel.hidden) {
        closePanel();
        panelBtn?.focus();
        return;
      }
      if (links?.classList.contains('open')) {
        closeMenu();
        menu?.focus();
      }
    });

    // Klik di luar menutup panel, tetapi tidak mencuri fokus.
    document.addEventListener('click', e => {
      const panel = $('#a11y-panel'), btn = $('#a11y-btn');
      if (panel && !panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) closePanel();
    });

    initA11y();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runBootstrap, { once: true });
  } else {
    runBootstrap();
  }
}

export function initA11y() {
  const btn = $('#a11y-btn'), panel = $('#a11y-panel');

  btn?.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    // Fokus dipindah setelah panel benar-benar terlihat; elemen di dalam
    // [hidden] tidak dapat menerima fokus.
    if (open) {
      const first = panel.querySelector('input, select, button');
      if (first) first.focus();
    }
  });

  // --- Kontras tinggi ---
  const contrast = $('#contrast-toggle');
  const contrastOn = localStorage.getItem(KEY_CONTRAST) === 'true';
  if (contrastOn) document.documentElement.dataset.theme = 'high-contrast';
  if (contrast) {
    contrast.checked = contrastOn;
    contrast.addEventListener('change', () => {
      const on = contrast.checked;
      if (on) document.documentElement.dataset.theme = 'high-contrast';
      else delete document.documentElement.dataset.theme;
      localStorage.setItem(KEY_CONTRAST, String(on));
    });
  }

  // --- Ukuran teks ---
  const size = $('#text-size');
  const savedSize = localStorage.getItem(KEY_TEXT) || 'medium';
  document.documentElement.dataset.textSize = savedSize;
  if (size) {
    size.value = savedSize;
    size.addEventListener('change', () => {
      document.documentElement.dataset.textSize = size.value;
      localStorage.setItem(KEY_TEXT, size.value);
    });
  }

  // --- Kurangi animasi ---
  const motion = $('#motion-toggle');
  const motionOff = localStorage.getItem(KEY_MOTION) === 'off';
  if (motionOff) document.documentElement.dataset.motion = 'off';
  if (motion) {
    motion.checked = motionOff;
    motion.addEventListener('change', () => {
      const off = motion.checked;
      if (off) document.documentElement.dataset.motion = 'off';
      else delete document.documentElement.dataset.motion;
      localStorage.setItem(KEY_MOTION, off ? 'off' : 'on');
    });
  }
}

import{fetchOSMLocations}from'./osm-api.js?v=10';
import{filterCityVenues}from'./city-scope.js?v=1';
export function initLogout(){
 const btn=$('#btn-logout');
 btn?.addEventListener('click',()=>{logout();window.location.href='login.html'});
}

// Custom locations (publik, hanya yang disetujui) + overrides admin.
let _adminLocationsCache=null;
export async function fetchAdminLocationsState(){
 if(_adminLocationsCache)return _adminLocationsCache;
 let custom=[],overrides=[];
 try{
  const res=await fetch('/api/locations',{credentials:'same-origin'});
  if(res.ok){const d=await res.json();custom=d.custom||[]}
 }catch{/* publik gagal → coba admin */}
 const auth=getAuth();
 if(auth?.role==='admin'){
  try{
   const res=await fetch('/api/admin/locations',{credentials:'same-origin'});
   if(res.ok){const d=await res.json();overrides=d.overrides||[];custom=d.custom?.filter(c=>!c.deleted&&!c.pending)||custom}
  }catch{/* abaikan */}
 }
 _adminLocationsCache={custom,overrides};
 return _adminLocationsCache;
}
export function clearAdminLocationsCache(){_adminLocationsCache=null}
function applyAdminState(base,adminState){
 const{custom,overrides}=adminState;
 const ovMap=new Map(overrides.map(o=>[o.osm_id,o]));
 const out=[...custom.filter(c=>!c.deleted).map(c=>({
   ...c,id:c.id,name:c.name,address:c.address||'',lat:c.lat,lng:c.lng,
   source:c.source||'Admin lokal',category:(c.categories&&c.categories[0])||'wheelchair_place',
   categories:c.categories||[],attributes:c.attributes||{}
 })),...base.map(v=>{
   const ov=ovMap.get(v.id);
   if(!ov)return v;
   if(ov.deleted)return null;
   const merged={...v,...(ov.name?{name:ov.name}:{}),...(ov.address?{address:ov.address}:{})};
   const cats=ov.categories&&ov.categories.length?ov.categories:[v.category];
   merged.categories=cats;merged.category=cats[0]||v.category;
   merged.attributes={...v.attributes,...(ov.attributes||{})};
   return merged;
 })].filter(Boolean);
 return out;
}
export async function loadVenues(options={}){
 const result=await fetchOSMLocations(options);
 const adminState=await fetchAdminLocationsState();
 const overlaid=applyAdminState(result.venues,adminState).filter(v=>v.category!=='elevator');
 const venues=filterCityVenues(overlaid,result.cityScope);
 venues.updatedAt=result.updatedAt;venues.dataSource=result.source;venues.warning=result.warning;venues.scopeId=result.cityScope.scope_id;
 return venues;
}

export const featureLabels={wheelchair_access:'Akses kursi roda',wheelchair_ramp:'Rampa',accessible_restroom:'Toilet aksesibel',tactile_paving:'Jalur taktil',signage:'Rambu jelas'};
export const categories={wheelchair_place:{label:'Akses kursi roda',color:'#38606b',letter:'A'},wheelchair_ramp:{label:'Rampa',color:'#1b4f86',letter:'R'},accessible_restroom:{label:'Toilet',color:'#8a4a0b',letter:'T'},tactile_paving:{label:'Taktil',color:'#5b3a82',letter:'J'}};

const NAV = [
  ['home', 'index.html', 'Beranda'],
  ['map', 'map.html', 'Peta'],
  ['audit', 'audit.html', 'Audit'],
  ['community', 'community.html', 'Komunitas'],
  ['business', 'business.html', 'Usaha'],
  ['about', 'about.html', 'Tentang'],
];

const escapeAttr = x => String(x).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function shell(active = '') {
  const auth = getAuth();
  const loggedIn = auth && auth.loggedIn;
  const roleLabel = loggedIn ? (auth.role === 'admin' ? 'Admin' : 'Kontributor') : '';

  const items = [...NAV];
  if (loggedIn && auth.role === 'admin') items.push(['admin', 'admin.html', 'Admin']);
  if (!loggedIn) items.push(['login', 'login.html', 'Masuk']);

  const links = items.map(([key, href, label]) => {
    const current = active === key;
    return `<li><a class="navlink${current ? ' active' : ''}" href="${href}"${
      current ? ' aria-current="page"' : ''}>${label}</a></li>`;
  }).join('');

  const account = loggedIn
    ? `<li class="nav-account"><span class="nav-user">${escapeAttr(roleLabel)}: ${
        escapeAttr(auth.name || auth.email)}</span>
       <button class="btn btn-quiet" id="btn-logout">Keluar</button></li>`
    : '';

  return `
<a class="skip-link" href="#main">Lewati ke konten</a>
<header class="topbar">
  <nav class="nav page" aria-label="Navigasi utama">
    <a class="brand" href="index.html">
      <span class="brand-mark" aria-hidden="true">A</span>AksesKota
    </a>

    <button class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="navlinks">
      <span class="menu-bars" aria-hidden="true"><span></span><span></span><span></span></span>
      <span class="menu-btn-text">Menu</span>
    </button>

    <ul class="navlinks" id="navlinks">${links}${account}</ul>

    <button class="btn btn-outline a11y-btn" id="a11y-btn"
            aria-expanded="false" aria-controls="a11y-panel">Aksesibilitas</button>
  </nav>
</header>

<aside class="a11y-panel" id="a11y-panel" hidden>
  <h2 class="a11y-title">Pengaturan tampilan</h2>

  <div class="a11y-row">
    <label class="check-row" for="contrast-toggle">
      <input type="checkbox" id="contrast-toggle">
      Kontras tinggi
    </label>
    <p class="a11y-hint">Latar gelap dengan teks putih untuk kontras maksimum.</p>
  </div>

  <div class="a11y-row">
    <label for="text-size">Ukuran teks</label>
    <select id="text-size">
      <option value="medium">Normal</option>
      <option value="large">Besar</option>
      <option value="xlarge">Sangat besar</option>
    </select>
  </div>

  <div class="a11y-row">
    <label class="check-row" for="motion-toggle">
      <input type="checkbox" id="motion-toggle">
      Kurangi animasi
    </label>
    <p class="a11y-hint">Mematikan gerak dan transisi di seluruh halaman.</p>
  </div>

  <p class="a11y-note">Pengaturan tersimpan di perangkat ini.</p>
</aside>`;
}

export function footer() {
  return `<footer class="footer">
  <div class="footer-in page">
    <a class="brand" href="index.html">
      <span class="brand-mark" aria-hidden="true">A</span>AksesKota
    </a>
    <p class="footer-note">Data peta &copy; OpenStreetMap &middot; kontributor. Mendukung SDG 8, 9, dan 11.</p>
  </div>
</footer>`;
}

export function initAnimations() {
  const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const userReduced = localStorage.getItem(KEY_MOTION) === 'off';

  // Ketika motion dinonaktifkan, konten harus tetap terlihat: tanpa ini
  // elemen .anim-hidden akan tertinggal dalam keadaan transparan.
  if (systemReduced || userReduced) {
    document.querySelectorAll('.anim-hidden').forEach(el => el.classList.add('anim-visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('anim-visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.anim-hidden').forEach(el => observer.observe(el));
}
