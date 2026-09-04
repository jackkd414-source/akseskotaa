import { shell, footer, initShell, initLogout, initAnimations } from './core.js';
import {
  registerUser,
  loginUser,
  loginWithGoogle,
  loginAdmin,
  saveAuth,
  getAuth,
  logout,
  findUserByEmail,
  loadSeedUsers
} from './user-store.js';

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

function redirectAfterLogin(role) {
  showRedirecting();
  const returnUrl = getReturnUrl();
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

/* ---------- Check if already logged in ---------- */
const existingAuth = getAuth();
if (existingAuth?.loggedIn) {
  const returnUrl = getReturnUrl();
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

/* ---------- Google Sign-In ---------- */
// Replace YOUR_CLIENT_ID with your Google Cloud OAuth 2.0 client ID
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID';

function handleGoogleCredential(response) {
  try {
    const payload = JSON.parse(
      atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );

    const email = payload.email || '';
    const name = payload.name || '';
    const picture = payload.picture || '';

    if (!email) { showError('Gagal mendapatkan email dari Google.'); return; }

    const result = loginWithGoogle({ email, name, picture });
    if (result.ok) {
      saveAuth({
        role: 'user',
        email: result.user.email,
        name: result.user.name,
        picture: result.user.picture,
        provider: 'google',
        loggedIn: true,
        timestamp: Date.now()
      });
      redirectAfterLogin('user');
    } else {
      showError(result.error);
    }
  } catch (err) {
    console.error('Google sign-in error:', err);
    showError('Gagal masuk dengan Google. Silakan coba lagi.');
  }
}

/* ---------- Google OAuth popup simulation ---------- */
function openGooglePopup() {
  return new Promise((resolve) => {
    // Build a minimal Google-styled popup
    const overlay = document.createElement('div');
    overlay.id = 'google-popup-overlay';
    overlay.innerHTML = `
      <div class="google-popup">
        <div class="google-popup-header">
          <svg viewBox="0 0 24 24" width="28" height="28">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <h2>Masuk dengan Google</h2>
          <p>Gunakan akun Google Anda untuk masuk ke AksesKota</p>
        </div>
        <div class="google-popup-body">
          <div class="google-popup-field">
            <label for="google-email-input">Email Google</label>
            <input type="email" id="google-email-input" placeholder="nama@gmail.com" autocomplete="email">
          </div>
          <div class="google-popup-actions">
            <button type="button" class="btn btn-google-popup-cancel">Batal</button>
            <button type="button" class="btn btn-primary btn-google-popup-ok">Lanjutkan</button>
          </div>
          <div class="google-popup-error" id="google-popup-error" hidden></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const emailInput = overlay.querySelector('#google-email-input');
    const errBox = overlay.querySelector('#google-popup-error');
    const okBtn = overlay.querySelector('.btn-google-popup-ok');
    const cancelBtn = overlay.querySelector('.btn-google-popup-cancel');

    setTimeout(() => emailInput.focus(), 100);

    function close(val) {
      overlay.remove();
      resolve(val);
    }

    cancelBtn.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

    function doOk() {
      const email = emailInput.value.trim().toLowerCase();
      if (!email) {
        errBox.textContent = 'Masukkan email Google Anda.';
        errBox.hidden = false;
        emailInput.focus();
        return;
      }
      if (!email.includes('@') || !email.includes('.')) {
        errBox.textContent = 'Format email tidak valid.';
        errBox.hidden = false;
        emailInput.focus();
        return;
      }
      const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      close({ email, name, picture: '' });
    }

    okBtn.addEventListener('click', doOk);
    emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doOk(); });
  });
}

function initGoogleSignIn() {
  // Try real Google Identity Services first
  if (typeof google !== 'undefined' && google.accounts && GOOGLE_CLIENT_ID !== 'YOUR_CLIENT_ID') {
    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false
      });

      const triggerPrompt = () => {
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            google.accounts.id.prompt();
          }
        });
      };

      document.getElementById('google-signin-btn')?.addEventListener('click', triggerPrompt);
      document.getElementById('google-register-btn')?.addEventListener('click', triggerPrompt);
      return;
    } catch (err) {
      console.error('Google Sign-In init error:', err);
    }
  }

  // Fallback: popup-based Google-style flow
  const loginBtn = document.getElementById('google-signin-btn');
  const registerBtn = document.getElementById('google-register-btn');

  async function handleGoogleClick() {
    const profile = await openGooglePopup();
    if (!profile) return;

    const result = loginWithGoogle(profile);
    if (result.ok) {
      saveAuth({
        role: 'user',
        email: result.user.email,
        name: result.user.name,
        picture: result.user.picture,
        provider: 'google',
        loggedIn: true,
        timestamp: Date.now()
      });
      redirectAfterLogin('user');
    } else {
      showError(result.error);
    }
  }

  if (loginBtn) loginBtn.addEventListener('click', handleGoogleClick);
  if (registerBtn) registerBtn.addEventListener('click', handleGoogleClick);
}

// Start init when ready
if (typeof google !== 'undefined' && google.accounts) {
  initGoogleSignIn();
} else {
  window.addEventListener('load', initGoogleSignIn);
}

/* ---------- Seed users: auto-load on first visit ---------- */
loadSeedUsers();
