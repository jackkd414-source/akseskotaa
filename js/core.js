import{getAuth,logout}from'./user-store.js';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function closeMenu(){const m=$('#menu-btn'),l=$('#navlinks');if(l&&m){l.classList.remove('open');m.setAttribute('aria-expanded','false')}}
export function initShell(){const menu=$('#menu-btn'),links=$('#navlinks');menu?.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',open)});links?.addEventListener('click',e=>{if(e.target===links)closeMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});initA11y()}

const sunSvg='Terang';
const moonSvg='Gelap';
function updateToggleIcon(){const btn=$('#a11y-btn');if(!btn)return;const isDark=document.documentElement.dataset.theme==='high-contrast';btn.innerHTML=isDark?sunSvg:moonSvg;}
export function initA11y(){
 const a11yBtn=$('#a11y-btn'),panel=$('#a11y-panel');
 a11yBtn?.addEventListener('click',()=>{const open=panel.classList.toggle('open');a11yBtn.setAttribute('aria-expanded',open)});
 document.addEventListener('click',e=>{if(panel?.classList.contains('open')&&!panel.contains(e.target)&&!a11yBtn.contains(e.target))panel.classList.remove('open')});
 const contrast=$('#contrast-toggle');
 if(localStorage.getItem('akseskota_contrast')==='true'){document.documentElement.dataset.theme='high-contrast';contrast?.setAttribute('aria-checked','true')}
 updateToggleIcon();
 contrast?.addEventListener('click',()=>{const on=contrast.getAttribute('aria-checked')!=='true';contrast.setAttribute('aria-checked',on);document.documentElement.dataset.theme=on?'high-contrast':'';localStorage.setItem('akseskota_contrast',on);updateToggleIcon();});
 const size=$('#text-size');
 const saved=localStorage.getItem('akseskota_text_size')||'medium';document.documentElement.dataset.textSize=saved;if(size)size.value=saved;
 size?.addEventListener('change',()=>{document.documentElement.dataset.textSize=size.value;localStorage.setItem('akseskota_text_size',size.value)});
}

import{fetchOSMLocations}from'./osm-api.js?v=4';
import{applyAdminState}from'./admin-store.js';
export function initLogout(){
 const btn=$('#btn-logout');
 btn?.addEventListener('click',()=>{logout();window.location.href='login.html'});
}

export async function loadVenues(options={}){
 const result=await fetchOSMLocations(options);
 const venues=applyAdminState(result.venues);
 venues.updatedAt=result.updatedAt;venues.dataSource=result.source;venues.warning=result.warning;
 return venues;
}

export const featureLabels={wheelchair_ramp:'Rampa',elevator:'Lift',accessible_restroom:'Toilet aksesibel',tactile_paving:'Jalur taktil',signage:'Rambu jelas'};
export const categories={wheelchair_ramp:{label:'Rampa',color:'#2878b5',letter:'R'},elevator:{label:'Lift',color:'#176b45',letter:'L'},accessible_restroom:{label:'Toilet',color:'#b26b1c',letter:'T'},tactile_paving:{label:'Taktil',color:'#795597',letter:'J'}};

export function shell(active=''){
 const auth=getAuth();
 const loggedIn=auth&&auth.loggedIn;
 const roleLabel=loggedIn?(auth.role==='admin'?'Admin':'Kontributor'):'';
 const sanitize=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const userBadge=loggedIn?`<span class="nav-user"><span class="nav-user-dot"></span>${sanitize(roleLabel)}: ${sanitize(auth.name||auth.email)}</span>`:'';
 const logoutBtn=loggedIn?`<button class="navlink btn-logout" id="btn-logout">Keluar</button>`:'';
 const loginLink=!loggedIn?`<a class="navlink ${active==='login'?'active':''}" href="login.html">Masuk</a>`:'';
 const adminLink=loggedIn&&auth.role==='admin'?`<a class="navlink ${active==='admin'?'active':''}" href="admin.html">Admin</a>`:'';
 const isDark=localStorage.getItem('akseskota_contrast')==='true';
 const toggleIcon=isDark?sunSvg:moonSvg;
 return `<a class="skip-link" href="#main">Lewati ke konten</a><header class="topbar"><nav class="nav" aria-label="Navigasi utama"><a class="brand" href="index.html"><span class="brand-mark">A</span>AksesKota</a><div class="nav-spacer"></div><div class="nav-right"><button class="icon-btn theme-toggle" id="a11y-btn" aria-label="Ubah warna" aria-expanded="false">${toggleIcon}</button>${userBadge}</div><button class="menu-btn" id="menu-btn" aria-expanded="false" aria-label="Buka navigasi"><span></span><span></span><span></span></button></nav></header><div class="navlinks" id="navlinks"><a class="navlink ${active==='home'?'active':''}" href="index.html">Beranda</a><a class="navlink ${active==='map'?'active':''}" href="map.html">Peta</a><a class="navlink ${active==='audit'?'active':''}" href="audit.html">Audit</a><a class="navlink ${active==='community'?'active':''}" href="community.html">Komunitas</a><a class="navlink ${active==='business'?'active':''}" href="business.html">Usaha</a><a class="navlink ${active==='about'?'active':''}" href="about.html">Tentang</a>${adminLink}${loginLink}<div class="menu-divider"></div>${logoutBtn}</div><aside class="a11y-panel" id="a11y-panel" aria-label="Ubah warna"><h3>Ubah Warna</h3><div class="a11y-row"><label>Kontras tinggi</label><button class="switch" id="contrast-toggle" role="switch" aria-checked="false"></button></div><div class="a11y-row"><label for="text-size">Ukuran teks</label><select id="text-size"><option value="medium">Normal</option><option value="large">Besar</option><option value="xlarge">Sangat besar</option></select></div></aside>`;
}

export function footer(){return `<footer class="footer"><div class="footer-in"><a class="brand" href="index.html"><span class="brand-mark">A</span>AksesKota</a><span>Data peta © OpenStreetMap · Mendukung SDG 8, 9, 11</span></div></footer>`}

export function initAnimations(){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 const observer=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('anim-visible');observer.unobserve(e.target)}})},{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
 document.querySelectorAll('.anim-hidden').forEach(el=>observer.observe(el));
}
