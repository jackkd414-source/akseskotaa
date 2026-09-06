/**
 * AksesKota — API client.
 * Semua data (akun, audit, usaha) kini tersimpan di server (SQLite),
 * bukan lagi localStorage. Sesi via cookie HttpOnly.
 */

async function call(path, options = {}) {
  const res = await fetch(path, {
    headers: options.body ? { 'Content-Type': 'application/json' } : {},
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

/* ---------- Session ---------- */

export async function fetchMe() {
  const { user } = await call('/api/me');
  return user; // null atau {id,name,email,role}
}

export function saveAuth(user) {
  // Kompatibilitas: halaman lama membaca localStorage untuk render cepat.
  // Sesi sebenarnya dipegang cookie server.
  if (user) localStorage.setItem('akseskota_auth', JSON.stringify({ ...user, loggedIn: true, timestamp: Date.now() }));
}

export function getAuth() {
  try {
    const a = JSON.parse(localStorage.getItem('akseskota_auth') || 'null');
    return a && a.loggedIn ? a : null;
  } catch { return null; }
}

export async function logout() {
  try { await call('/api/logout', { method: 'POST' }); } catch { /* abaikan */ }
  localStorage.removeItem('akseskota_auth');
}
export async function me() {
  const { user } = await call('/api/me');
  return user || null;
}

/* ---------- Auth ---------- */

export async function registerUser({ name, email, password }) {
  const { user } = await call('/api/register', { method: 'POST', body: { name, email, password } });
  saveAuth({ ...user, provider: 'email' });
  return { ok: true, user };
}

export async function loginUser({ email, password }) {
  const { user } = await call('/api/login', { method: 'POST', body: { email, password } });
  saveAuth({ ...user, provider: 'email' });
  return { ok: true, user };
}

export async function loginAdmin({ email, password, code }) {
  const { user } = await call('/api/admin/login', { method: 'POST', body: { email, password, code } });
  saveAuth(user);
  return { ok: true, user };
}

export async function findUserByEmail() {
  // Server tidak membocorkan keberadaan akun — selalu sarankan hubungi admin.
  return null;
}

/* ---------- Audits ---------- */

export async function fetchAudits() {
  const { audits } = await call('/api/audits');
  return audits;
}

export async function submitAudit(audit) {
  return call('/api/audits', { method: 'POST', body: audit });
}

export async function fetchLeaderboard() {
  const { rows } = await call('/api/leaderboard');
  return rows;
}
export async function fetchAdminLeaderboard() {
  const r = await fetch('/api/leaderboard', { headers: { 'x-admin-list': '1' }, credentials: 'same-origin' });
  if (!r.ok) throw new Error('Gagal memuat leaderboard.');
  return (await r.json()).rows || [];
}
export async function removeContributor(name) {
  return call('/api/admin/leaderboard/remove', { method: 'POST', body: { name } });
}
export async function fetchAdminBusinesses() {
  const { businesses } = await call('/api/admin/businesses');
  return businesses;
}
export async function verifyBusiness(id, verified) {
  return call(`/api/admin/businesses/${encodeURIComponent(id)}`, { method: 'POST', body: { verified } });
}
export async function deleteBusiness(id) {
  return call(`/api/admin/businesses/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/* ---------- Businesses ---------- */

export async function fetchBusinesses() {
  const { businesses } = await call('/api/businesses');
  return businesses;
}

export async function registerBusiness(data) {
  return call('/api/businesses', { method: 'POST', body: data });
}

/* ---------- Admin ---------- */

export async function fetchAdminAudits() {
  const { audits } = await call('/api/admin/audits');
  return audits;
}

export async function moderateAudit(id, status, note = '') {
  return call(`/api/admin/audits/${encodeURIComponent(id)}`, { method: 'POST', body: { status, note } });
}

/* ---------- Admin locations ---------- */

export async function fetchAdminLocations() {
  const { custom, overrides } = await call('/api/admin/locations');
  return { custom, overrides };
}

export async function saveCustomLocation(data) {
  const { id } = await call('/api/admin/locations', { method: 'POST', body: data });
  return id;
}

export async function updateLocation(id, data) {
  return call(`/api/admin/locations/${encodeURIComponent(id)}`, { method: 'POST', body: data });
}

export async function deleteLocation(id) {
  return call(`/api/admin/locations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/* ---------- Usulan lokasi (publik) ---------- */

export async function suggestLocation(data) {
  // Admin: langsung tayang. Guest: masuk antrean moderasi.
  return call('/api/locations/suggest', { method: 'POST', body: data });
}

export async function fetchPublicLocations() {
  const { custom } = await call('/api/locations');
  return custom;
}

export async function approveLocationSuggestion(id) {
  return call(`/api/admin/locations/${encodeURIComponent(id)}/approve`, { method: 'POST' });
}

export async function rejectLocationSuggestion(id) {
  return call(`/api/admin/locations/${encodeURIComponent(id)}/reject`, { method: 'POST' });
}
