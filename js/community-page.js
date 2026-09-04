import{shell,footer,initShell,initLogout,initAnimations}from'./core.js';
import{getBusinessLeaderboard,seedBusinessData,migrateSeedBusinessLocations}from'./business-store.js';
seedBusinessData();migrateSeedBusinessLocations();
const $=s=>document.querySelector(s);$('#shell').innerHTML=shell('community');$('#footer').innerHTML=footer();initShell();initLogout();initAnimations();
let audits=[];try{audits=JSON.parse(localStorage.getItem('akseskota_audits')||'[]')}catch{}const approved=audits.filter(a=>a.status==='approved'),score=approved.length*10;$('#your-score').textContent=`${score} poin`;$('#your-audits').textContent=`${approved.length} audit disetujui`;
const defs=[['Audit Pertama','1 audit disetujui',1],['Penjelajah','5 lokasi disetujui',5],['Kontributor Aktif','10 audit disetujui',10],['Pahlawan Akses','25 audit disetujui',25]];const unique=new Set(approved.map(a=>a.locationId)).size;$('#badges').innerHTML=defs.map(([name,desc,n],i)=>`<div class="badge ${(i===1?unique:approved.length)<n?'locked':''}"><b>${name}</b><small>${desc}</small></div>`).join('');
const rows=approved.length?[['Anda',approved.length,score]]:[];$('#leaderboard').innerHTML=rows.length?rows.map((x,i)=>`<tr><td class="rank">${i+1}</td><td><strong>${x[0]}</strong></td><td>${x[1]}</td><td>${x[2]}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">Belum ada kontribusi yang disetujui. Papan ini hanya menampilkan audit nyata yang sudah lolos moderasi — belum ada peringkat untuk ditampilkan.</td></tr>';

// Business mini leaderboard
const bizBadge={platinum:'P',gold:'G',silver:'S',bronze:'B'};
const bizLeaderboard=getBusinessLeaderboard();
const bizBox=$('#business-mini-leaderboard');
if(bizLeaderboard.length===0){bizBox.innerHTML='<p style="color:var(--muted);text-align:center;padding:20px">Belum ada usaha terdaftar. <a href="business.html" style="color:var(--green);font-weight:700">Daftarkan usaha pertama!</a></p>'}else{bizBox.innerHTML=`<table class="leader-table"><thead><tr><th>#</th><th>Usaha</th><th>Badge</th><th>Skor</th></tr></thead><tbody>${bizLeaderboard.slice(0,5).map((b,i)=>`<tr><td class="rank">${i+1}</td><td><strong>${b.name}</strong></td><td><span class="business-badge badge-${b.badgeLevel}">${bizBadge[b.badgeLevel]||'B'} ${b.badgeLevel==='platinum'?'Platinum':b.badgeLevel==='gold'?'Emas':b.badgeLevel==='silver'?'Perak':'Perunggu'}</span></td><td><strong>${b.score}</strong></td></tr>`).join('')}</tbody></table>`}
