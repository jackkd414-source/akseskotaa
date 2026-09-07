import{shell,footer,initShell,initLogout,initAnimations}from'./core.js?v=25';
const $=s=>document.querySelector(s);$('#shell').innerHTML=shell('community');$('#footer').innerHTML=footer();initShell();initLogout();initAnimations();
import{fetchAudits,fetchLeaderboard,fetchBusinesses}from'./api.js?v=6';
let approved=[],score=0;
try{
 const audits=await fetchAudits();approved=audits.filter(a=>a.status==='approved');score=approved.length*10;
}catch{}
$('#your-score').textContent=`${score} poin`;$('#your-audits').textContent=`${approved.length} audit disetujui`;
const defs=[['Audit Pertama','1 audit disetujui',1],['Penjelajah','5 lokasi disetujui',5],['Kontributor Aktif','10 audit disetujui',10],['Pahlawan Akses','25 audit disetujui',25]];const unique=new Set(approved.map(a=>a.locationId)).size;$('#badges').innerHTML=defs.map(([name,desc,n],i)=>`<div class="badge ${(i===1?unique:approved.length)<n?'locked':''}"><b>${name}</b><small>${desc}</small></div>`).join('');
const esc=s=>{const d=document.createElement('div');d.textContent=s??'';return d.innerHTML};
let rows=[];
try{rows=await fetchLeaderboard()}catch{}
$('#leaderboard').innerHTML=rows.length?rows.map((x,i)=>`<tr><td class="rank">${i+1}</td><td><strong>${esc(x.name)}</strong></td><td>${x.count}</td><td>${x.points}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Belum ada kontribusi yang disetujui. Audit dengan nama Anda akan tampil di sini setelah lolos moderasi.</td></tr>';

// Business mini leaderboard
let bizLeaderboard=[];try{bizLeaderboard=(await fetchBusinesses())||[]}catch{}
const bizBox=$('#business-mini-leaderboard');
if(bizLeaderboard.length===0){bizBox.innerHTML='<p class="empty">Belum ada usaha terdaftar. <a href="business.html">Daftarkan usaha pertama</a></p>'}else{bizBox.innerHTML=`<table class="leader-table"><thead><tr><th>#</th><th>Usaha</th><th>Skor</th></tr></thead><tbody>${bizLeaderboard.slice(0,5).map((b,i)=>`<tr><td data-label="#" class="rank">${i+1}</td><td data-label="Usaha"><strong>${b.name}</strong></td><td data-label="Skor"><strong>${b.score}</strong></td></tr>`).join('')}</tbody></table>`}
