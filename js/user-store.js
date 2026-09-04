/**
 * AksesKota — User Store
 * Client-side user registration & login using localStorage.
 * Passwords are stored as SHA-256 hashes for basic security.
 */

const USERS_KEY = 'akseskota_users';
const AUTH_KEY = 'akseskota_auth';

/* ---------- Internal helpers ---------- */

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- Public API ---------- */

/**
 * Register a new user.
 * @returns {{ ok: boolean, error?: string }}
 */
export async function registerUser({ name, email, password }) {
  const users = getUsers();
  const normalizedEmail = email.trim().toLowerCase();

  // Check duplicate
  if (users.some(u => u.email === normalizedEmail)) {
    return { ok: false, error: 'Email sudah terdaftar. Silakan masuk atau gunakan email lain.' };
  }

  // Validate
  if (!name || name.trim().length < 2) {
    return { ok: false, error: 'Nama harus minimal 2 karakter.' };
  }
  if (!normalizedEmail || !normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
    return { ok: false, error: 'Format email tidak valid.' };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: 'Kata sandi minimal 6 karakter.' };
  }

  const hashed = await hashPassword(password);
  const user = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    email: normalizedEmail,
    password: hashed,
    provider: 'email',
    createdAt: new Date().toISOString(),
    picture: ''
  };

  users.push(user);
  saveUsers(users);

  return { ok: true };
}

/**
 * Login with email & password.
 * @returns {{ ok: boolean, user?: object, error?: string }}
 */
export async function loginUser({ email, password }) {
  const users = getUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find(u => u.email === normalizedEmail && u.provider === 'email');

  if (!user) {
    return { ok: false, error: 'Email tidak ditemukan. Silakan daftar terlebih dahulu.' };
  }

  const hashed = await hashPassword(password);
  if (user.password !== hashed) {
    return { ok: false, error: 'Kata sandi salah. Silakan coba lagi.' };
  }

  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, picture: user.picture }
  };
}

/**
 * Login / register with Google (simulated on client-side).
 * @param {{ email: string, name: string, picture: string }} profile
 * @returns {{ ok: boolean, user?: object, error?: string }}
 */
export function loginWithGoogle(profile) {
  if (!profile || !profile.email) {
    return { ok: false, error: 'Data Google tidak valid.' };
  }

  const users = getUsers();
  const normalizedEmail = profile.email.trim().toLowerCase();
  let user = users.find(u => u.email === normalizedEmail);

  if (!user) {
    // Auto-register
    user = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: profile.name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      password: '',
      provider: 'google',
      createdAt: new Date().toISOString(),
      picture: profile.picture || ''
    };
    users.push(user);
    saveUsers(users);
  }

  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, picture: user.picture }
  };
}

/**
 * Login with admin credentials (client-side validation).
 * Admin access is validated with a fixed code.
 */
export async function loginAdmin({ email, password, code }) {
  const ADMIN_CODE = 'AKSES2024';
  const ADMIN_PASSWORD_MIN = 6;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
    return { ok: false, error: 'Format email tidak valid.' };
  }
  if (!password || password.length < ADMIN_PASSWORD_MIN) {
    return { ok: false, error: 'Kata sandi admin minimal 6 karakter.' };
  }
  if (!code || code !== ADMIN_CODE) {
    return { ok: false, error: 'Kode akses admin salah. Hubungi administrator untuk kode yang valid.' };
  }

  return {
    ok: true,
    user: { id: 'admin', name: 'Administrator', email: normalizedEmail, picture: '' }
  };
}

/* ---------- Auth session ---------- */

export function saveAuth(data) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

/**
 * Find a user by email (for "forgot password" hint, etc.)
 */
export function findUserByEmail(email) {
  const users = getUsers();
  return users.find(u => u.email === email.trim().toLowerCase()) || null;
}

/**
 * Auto-load seed users on first visit.
 * If localStorage has no users, fetch data/seed-users.json and merge them.
 */
export async function loadSeedUsers() {
  const users = getUsers();
  if (users.length > 0) return; // Already has users, skip

  try {
    const res = await fetch('data/seed-users.json');
    if (!res.ok) return;
    const seed = await res.json();
    if (!seed.users || !seed.users.length) return;

    const existingEmails = new Set(users.map(u => u.email));
    const newUsers = seed.users.filter(u => !existingEmails.has(u.email));
    if (newUsers.length) {
      saveUsers([...users, ...newUsers]);
    }
  } catch {
    // Silently fail — seed is optional
  }
}
