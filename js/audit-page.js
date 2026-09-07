import{shell,footer,initShell,initLogout,loadVenues,initAnimations}from'./core.js?v=25';
import{registerUser as apiRegister,loginUser as apiLogin,logout as apiLogout,me as apiMe,fetchAudits,submitAudit}from'./api.js?v=6';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
$('#shell').innerHTML=shell('audit');$('#footer').innerHTML=footer();initShell();initLogout();initAnimations();

let rating=0,features=new Set(),venues=[],imageData=null,me=null;
const select=$('#venue-select'),imageInput=$('#audit-image'),explanation=$('#audit-explanation');

/* ---------- Auth gate ---------- */
const gate=$('#audit-gate'),form=$('#audit-form');
function showForm(user){
  me=user;
  if(user){
    gate.hidden=true;form.hidden=false;
    $('#audit-as-who').textContent='Masuk sebagai '+(user.name||user.email||'Pengguna')+' · '+user.email;
  }else{
    gate.hidden=false;form.hidden=true;me=null;
  }
  stats();
}
function showAuthError(target,msg){const el=$(target);if(!el)return;el.textContent=msg;el.hidden=false;setTimeout(()=>{el.hidden=true},4500)}
$('#audit-logout')?.addEventListener('click',async()=>{await apiLogout();showForm(null)});
$$('.auth-tab').forEach(t=>t.onclick=()=>{
  $$('.auth-tab').forEach(x=>{const on=x===t;x.classList.toggle('active',on);x.setAttribute('aria-selected',String(on))});
  const which=t.dataset.authTab;
  $('#auth-form-register').hidden=which!=='register';
  $('#auth-form-login').hidden=which!=='login';
});
$('#auth-form-register')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const name=$('#auth-name').value.trim();
  const email=$('#auth-email-reg').value.trim().toLowerCase();
  const password=$('#auth-pw-reg').value;
  try{const r=await apiRegister({name,email,password});if(r&&r.ok){showForm(r.user)}else{showAuthError('#auth-error-register',(r&&r.error)||'Gagal membuat akun.')}}
  catch(err){showAuthError('#auth-error-register',err.message||'Gagal membuat akun.')}
});
$('#auth-form-login')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const email=$('#auth-email-login').value.trim().toLowerCase();
  const password=$('#auth-pw-login').value;
  try{const r=await apiLogin({email,password});if(r&&r.ok){showForm(r.user)}else{showAuthError('#auth-error-login',(r&&r.error)||'Email atau kata sandi salah.')}}
  catch(err){showAuthError('#auth-error-login',err.message||'Gagal masuk.')}
});

/* ---------- Audit form ---------- */
let myAudits=[];
async function stats(){try{myAudits=await fetchAudits()}catch{myAudits=[]}const approved=myAudits.filter(a=>a.status==='approved').length,pending=myAudits.filter(a=>(a.status||'pending')==='pending').length;$('#score').textContent=approved*10+' poin';$('#audit-count').textContent=myAudits.length?approved+' disetujui · '+pending+' menunggu':'Belum ada audit'}
function validate(){$('#submit').disabled=!(select.value&&rating&&me)}
$$('.check-item').forEach(b=>b.onclick=()=>{const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',on);on?features.add(b.dataset.feature):features.delete(b.dataset.feature)});
$$('.star').forEach(b=>b.onclick=()=>{rating=+b.dataset.value;$$('.star').forEach(s=>{s.classList.toggle('active',+s.dataset.value<=rating);s.setAttribute('aria-checked',+s.dataset.value===rating)});validate()});
select.onchange=()=>{const v=venues.find(x=>x.id===select.value);features.clear();$$('.check-item').forEach(b=>{const on=!!v?.attributes?.[b.dataset.feature];b.setAttribute('aria-pressed',on);if(on)features.add(b.dataset.feature)});validate()};
explanation.oninput=()=>$('#explanation-count').textContent=explanation.value.length;
function clearImage(){imageData=null;imageInput.value='';$('#image-preview').hidden=true;$('#upload-box').hidden=false;$('#preview-img').removeAttribute('src')}
$('#remove-image').onclick=clearImage;
async function compressImage(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Format gambar harus JPG, PNG, atau WebP');if(file.size>5*1024*1024)throw new Error('Ukuran gambar maksimum 5 MB');const bitmap=await createImageBitmap(file),max=1280,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(bitmap,0,0,w,h);bitmap.close();return canvas.toDataURL('image/jpeg',0.76)}
async function handleImage(file){if(!file)return;const box=$('#upload-box');box.querySelector('.upload-title').textContent='Memproses foto...';try{const dataUrl=await compressImage(file);if(dataUrl.length>900000)throw new Error('Foto terlalu besar setelah kompresi.');imageData={dataUrl,name:file.name,type:'image/jpeg'};$('#preview-img').src=dataUrl;$('#image-preview').hidden=false;$('#upload-box').hidden=true;box.querySelector('.upload-title').textContent='Seret foto atau klik'}catch(err){alert(err.message);box.querySelector('.upload-title').textContent='Seret foto atau klik'}}
imageInput.onchange=async e=>{await handleImage(e.target.files[0])};
['dragover','drop'].forEach(ev=>$('#upload-box').addEventListener(ev,e=>{e.preventDefault()}));
$('#upload-box').addEventListener('drop',async e=>{e.preventDefault();await handleImage(e.dataTransfer.files[0])});
$('#audit-form').onsubmit=async e=>{
  e.preventDefault();
  if(!me){showForm(null);return}
  const v=venues.find(x=>x.id===select.value);if(!v){alert('Pilih lokasi terlebih dahulu.');return}
  const audit={locationId:v.id,locationName:v.name,contributorName:(me.name||me.email).slice(0,40),rating,features:[...features],explanation:explanation.value.trim(),image:imageData};
  $('#submit').disabled=true;$('#submit').textContent='Mengirim...';
  try{await submitAudit(audit);$('#submit').textContent='Audit terkirim';explanation.value='';$('#explanation-count').textContent='0';clearImage();rating=0;features.clear();$$('.star').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-checked','false')});select.value='';$$('.check-item').forEach(x=>x.setAttribute('aria-pressed','false'));stats();setTimeout(()=>{$('#submit').textContent='Kirim audit';validate()},1800)}
  catch(err){$('#submit').disabled=false;$('#submit').textContent='Kirim audit';if(err.requireAuth||err.status===401){showForm(null);alert(err.message||'Masuk dulu untuk mengirim audit.')}else{alert(err.message||'Gagal mengirim audit.')}}
};

/* ---------- Init ---------- */
async function init(){
  try{venues=await loadVenues();select.innerHTML='<option value="">Pilih lokasi...</option>'+venues.map(v=>'<option value="'+v.id+'">'+(v.name||'').replace(/[<>]/g,'')+'</option>').join('')}catch(e){select.innerHTML='<option>Gagal memuat lokasi</option>'}
  try{const r=await apiMe();showForm(r)}catch{showForm(null)}
}
init();
