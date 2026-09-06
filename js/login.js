import { shell, footer, initShell, initLogout, initAnimations } from './core.js?v=24';
import {
  registerUser,
  loginUser,
  loginAdmin,
  saveAuth,
  getAuth,
  logout,
  findUserByEmail
} from './user-store.js?v=2';
import { fetchMe } from './api.js?v=3';

const $ = (s) => document.querySelector(s);

/* ---------- Shell ---------- */
$('#shell').innerHTML = shell();
$('#footer').innerHTML = footer();
initShell();
initLogout();
initAnimations();

/* ---------- Elements ---------- */
const userForm = $('#login-user-form');
const adminForm = $('#login-admin-form');
const registerForm = $('#register-form');
const forgotForm = $('#forgot-form');
const errorBox = $('#login-error');
const successBox = $('#login-success');
const successText = $('#login-success-text');

/* ---------- Helpers ---------- */
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
  successBox.hidden = true;
}

function hideError() {
  errorBox.hidden = true;
}

function showRedirecting(text = 'Mengalihkan...') {
  successBox.hidden = false;
  errorBox.hidden = true;
  if (successText) successText.textContent = text;
  $('#login-view').hidden = true;
  $('#register-view').hidden = true;
  $('#forgot-view').hidden = true;
}

function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('return');
}

function safeReturnUrl(raw) {
  // Hanya izinkan path relatif internal (bukan //, http:, dsb.) agar link
  // login tidak bisa dipakai untuk open redirect ke situs luar.
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  if (!/^[a-zA-Z0-9._-]+\.html(\?[^#]*)?(#.*)?$/.test(raw)) return null;
  if (raw.includes('..')) return null;
  return raw;
}

function redirectAfterLogin(role) {
  showRedirecting();
  const returnUrl = safeReturnUrl(getReturnUrl());
  setTimeout(() => {
    if (returnUrl) {
      window.location.href = returnUrl;
    } else if (role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'map.html';
    }
  }, 800);
}

/* ---------- Check if already logged in (server session via cookie) ---------- */
let existingAuth = null;
try { existingAuth = await fetchMe(); } catch { existingAuth = null; }
if (existingAuth) {
  const returnUrl = safeReturnUrl(getReturnUrl());
  if (returnUrl) {
    if (returnUrl === 'admin.html' && existingAuth.role === 'admin') {
      window.location.href = returnUrl;
    } else if (returnUrl === 'audit.html' && (existingAuth.role === 'user' || existingAuth.role === 'admin')) {
      window.location.href = returnUrl;
    } else if (returnUrl !== 'admin.html') {
      window.location.href = returnUrl;
    }
  }
  // Show logout hint, hide login forms
  const logoutHint = $('#logout-hint');
  const currentRole = $('#current-role');
  const loginView = $('#login-view');
  if (logoutHint) logoutHint.hidden = false;
  if (loginView) {
    loginView.querySelector('.login-tabs').hidden = true;
    loginView.querySelector('#login-user-form').hidden = true;
    loginView.querySelector('#login-admin-form').hidden = true;
    loginView.querySelector('.login-header p').hidden = true;
  }
  if (currentRole) {
    const label = existingAuth.role === 'admin' ? 'admin' : 'pengguna';
    const name = existingAuth.name ? ` (${existingAuth.name})` : '';
    currentRole.textContent = `${label}${name}`;
  }
}

/* ---------- Logout link ---------- */
$('#logout-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  logout();
  window.location.href = 'login.html';
});

/* ---------- User Login ---------- */
userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const email = $('#user-email').value.trim();
  const password = $('#user-password').value;

  if (!email) { showError('Masukkan alamat email Anda.'); $('#user-email').focus(); return; }
  if (!email.includes('@') || !email.includes('.')) { showError('Format email tidak valid.'); $('#user-email').focus(); return; }
  if (!password) { showError('Masukkan kata sandi Anda.'); $('#user-password').focus(); return; }

  const btn = userForm.querySelector('.login-submit');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const result = await loginUser({ email, password });
    if (result.ok) {
      saveAuth({
        role: 'user',
        email: result.user.email,
        name: result.user.name,
        picture: result.user.picture,
        provider: 'email',
        loggedIn: true,
        timestamp: Date.now()
      });
      redirectAfterLogin('user');
    } else {
      showError(result.error);
    }
  } catch (err) {
    showError('Terjadi kesalahan. Silakan coba lagi.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk sebagai Pengguna';
  }
});

/* ---------- Admin Login ---------- */
adminForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const email = $('#admin-email').value.trim();
  const password = $('#admin-password').value;
  const code = $('#admin-code').value.trim();

  if (!email) { showError('Masukkan alamat email admin.'); $('#admin-email').focus(); return; }
  if (!email.includes('@') || !email.includes('.')) { showError('Format email tidak valid.'); $('#admin-email').focus(); return; }
  if (!password) { showError('Masukkan kata sandi admin.'); $('#admin-password').focus(); return; }
  if (password.length < 6) { showError('Kata sandi admin minimal 6 karakter.'); $('#admin-password').focus(); return; }
  if (!code) { showError('Masukkan kode akses admin.'); $('#admin-code').focus(); return; }

  const btn = adminForm.querySelector('.login-submit');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const result = await loginAdmin({ email, password, code });
    if (result.ok) {
      saveAuth({
        role: 'admin',
        email: result.user.email,
        name: result.user.name,
        picture: result.user.picture,
        loggedIn: true,
        timestamp: Date.now()
      });
      redirectAfterLogin('admin');
    } else {
      showError(result.error);
    }
  } catch (err) {
    showError('Terjadi kesalahan. Silakan coba lagi.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk sebagai Admin';
  }
});

/* ---------- Register ---------- */
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const name = $('#reg-name').value.trim();
  const email = $('#reg-email').value.trim();
  const password = $('#reg-password').value;
  const confirm = $('#reg-password-confirm').value;

  if (!name) { showError('Masukkan nama lengkap Anda.'); $('#reg-name').focus(); return; }
  if (name.length < 2) { showError('Nama harus minimal 2 karakter.'); $('#reg-name').focus(); return; }
  if (!email) { showError('Masukkan alamat email Anda.'); $('#reg-email').focus(); return; }
  if (!email.includes('@') || !email.includes('.')) { showError('Format email tidak valid.'); $('#reg-email').focus(); return; }
  if (!password) { showError('Masukkan kata sandi.'); $('#reg-password').focus(); return; }
  if (password.length < 6) { showError('Kata sandi minimal 6 karakter.'); $('#reg-password').focus(); return; }
  if (password !== confirm) { showError('Konfirmasi kata sandi tidak cocok.'); $('#reg-password-confirm').focus(); return; }

  const btn = registerForm.querySelector('.login-submit');
  btn.disabled = true;
  btn.textContent = 'Membuat akun...';

  try {
    const result = await registerUser({ name, email, password });
    if (result.ok) {
      // Auto-login after registration
      const loginResult = await loginUser({ email, password });
      if (loginResult.ok) {
        saveAuth({
          role: 'user',
          email: loginResult.user.email,
          name: loginResult.user.name,
          picture: loginResult.user.picture,
          provider: 'email',
          loggedIn: true,
          timestamp: Date.now()
        });
        redirectAfterLogin('user');
      } else {
        // Fallback: show login view with success message
        window.showView('login');
        showError('Akun berhasil dibuat! Silakan masuk.');
      }
    } else {
      showError(result.error);
    }
  } catch (err) {
    showError('Terjadi kesalahan. Silakan coba lagi.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buat Akun';
  }
});

/* ---------- Forgot Password ---------- */
forgotForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideError();

  const email = $('#forgot-email').value.trim();
  if (!email) { showError('Masukkan alamat email Anda.'); $('#forgot-email').focus(); return; }
  if (!email.includes('@') || !email.includes('.')) { showError('Format email tidak valid.'); $('#forgot-email').focus(); return; }

  const user = findUserByEmail(email);
  const resultEl = $('#forgot-result');

  if (user) {
    resultEl.innerHTML = `Akun ditemukan! Silakan hubungi admin di <strong>admin@akseskota.id</strong> untuk reset password.`;
    resultEl.style.color = 'var(--green)';
    resultEl.style.background = 'var(--mint)';
    resultEl.style.padding = '12px 14px';
    resultEl.style.borderRadius = '10px';
    resultEl.style.marginTop = '12px';
    resultEl.style.fontSize = '.88rem';
    resultEl.style.fontWeight = '600';
  } else {
    resultEl.innerHTML = 'Email tidak ditemukan di sistem kami.';
    resultEl.style.color = 'var(--danger)';
    resultEl.style.background = '#fdf2f1';
    resultEl.style.padding = '12px 14px';
    resultEl.style.borderRadius = '10px';
    resultEl.style.marginTop = '12px';
    resultEl.style.fontSize = '.88rem';
    resultEl.style.fontWeight = '600';
  }
});


/* ---------- Seed users: auto-load on first visit ---------- */
loadSeedUsers();
