/**
 * AksesKota — User Store (client wrapper).
 * Akun & sesi kini dikelola server (SQLite + cookie HttpOnly).
 * Nama-nama fungsi dipertahankan agar pemanggil lama tidak berubah.
 */
export { registerUser, loginUser, loginAdmin, logout, findUserByEmail } from './api.js?v=3';
export { saveAuth, getAuth } from './api.js?v=3';

// Fungsi lama yang tidak lagi relevan di arsitektur server:
export async function loadSeedUsers() { /* tidak dipakai — data akun di server */ }
export function loginWithGoogle() {
  return { ok: false, error: 'Login Google tidak tersedia. Gunakan email dan kata sandi.' };
}
