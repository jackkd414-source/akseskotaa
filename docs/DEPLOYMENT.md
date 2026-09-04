# Panduan Deploy & Backend — AksesKota

Dokumen ini berisi langkah yang **harus dijalankan tim** karena membutuhkan akun
dan kredensial pribadi. Semua file konfigurasi sudah disiapkan di repo.

---

## 1. Repo GitHub publik

Repo git lokal sudah diinisialisasi beserta commit pertama.

```bash
cd WebsiteAksesKota

# Buat repo kosong di https://github.com/new (nama: akseskota, Public, tanpa README)
git remote add origin https://github.com/<USERNAME>/akseskota.git
git branch -M main
git push -u origin main
```

Jika diminta password, gunakan **Personal Access Token**
(GitHub → Settings → Developer settings → Tokens → Generate new token, scope `repo`).

Folder `legacy/` sengaja diabaikan `.gitignore` agar prototipe lama tidak ikut terkirim.

---

## 2. Deploy HTTPS (Netlify — gratis, tanpa kartu)

1. Buka <https://app.netlify.com/start>, login dengan GitHub.
2. **Import an existing project** → pilih repo `akseskota`.
3. Biarkan pengaturan default (`netlify.toml` sudah mengatur semuanya):
   - Publish directory: `.`
   - Build command: kosong
4. **Deploy site**. Situs aktif di `https://<nama-acak>.netlify.app`.
5. **Site configuration → Change site name** → ubah menjadi `akseskota`
   sehingga URL menjadi `https://akseskota.netlify.app`.

HTTPS wajib: fitur geolokasi tidak berjalan di HTTP kecuali `localhost`.

Alternatif: Cloudflare Pages atau Vercel — sama-sama mendeteksi situs statis otomatis.

---

## 3. Backend audit bersama (Supabase — gratis)

Tanpa langkah ini, audit hanya tersimpan di browser pengirim. Dengan langkah ini,
audit terlihat oleh semua pengunjung — termasuk juri.

### 3.1 Buat project

1. Buka <https://supabase.com> → **New project**.
2. Region: **Southeast Asia (Singapore)**.
3. Simpan password database yang dihasilkan.

### 3.2 Buat tabel

1. Masuk ke **SQL Editor → New query**.
2. Tempel seluruh isi [`docs/supabase-schema.sql`](supabase-schema.sql).
3. Klik **Run**.

### 3.3 Sambungkan aplikasi

1. **Project Settings → API**, salin dua nilai:
   - Project URL
   - `anon` `public` key
2. Buka `js/backend-config.js` dan isi:

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

3. Commit dan push. Netlify akan otomatis melakukan deploy ulang.

Kedua nilai ini memang dirancang untuk publik; keamanan ditegakkan oleh
Row Level Security di `supabase-schema.sql`, bukan oleh kerahasiaan kunci.

### 3.4 Moderasi

Secara default `anon` **tidak boleh** mengubah status audit — jadi tidak ada
pengunjung yang bisa menyetujui audit miliknya sendiri. Untuk demo lomba,
buka komentar blok `demo moderation` pada file SQL, jalankan, lalu tutup
kembali setelah presentasi. Untuk produksi, gunakan Supabase Auth atau
Edge Function seperti dicatat di file SQL.

---

## Status fitur menurut konfigurasi

| Kondisi | Perilaku |
|---|---|
| `backend-config.js` kosong | Mode lokal. Audit hanya di perangkat pengirim. Aplikasi tetap berjalan penuh. |
| `backend-config.js` terisi | Audit dikirim ke Supabase, dimuat admin, terlihat semua pengunjung. |
| Supabase tidak dapat dihubungi | Audit tetap tersimpan lokal; tombol menampilkan `Tersimpan lokal (server gagal)`. |

Foto bukti **tidak** diunggah ke server. Alasan: ukuran base64 dan pertimbangan
privasi. Foto tetap berada di perangkat pengirim, hanya fakta audit yang dibagikan.

---

## Checklist sebelum submit

- [ ] `git push` berhasil, repo publik dapat dibuka tanpa login
- [ ] URL Netlify aktif dan memakai HTTPS
- [ ] `backend-config.js` terisi, audit uji terlihat dari browser lain
- [ ] URL demo + repo dicantumkan pada bagian **Demo dan Repository** di `README.md`
- [ ] Nama tiga anggota tim dan asal sekolah sudah diisi pada `README.md`
- [ ] Screenshot desktop dan mobile ditaruh di `docs/screenshots/`
