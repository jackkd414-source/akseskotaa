# AksesKota — Navigasi Kota Tanpa Batasan

> Platform web pemetaan aksesibilitas urban yang membantu penyandang disabilitas, lansia, dan orang tua dengan stroller menemukan infrastruktur ramah akses di Jakarta dan Bekasi — lengkap dengan data real dari OpenStreetMap, rute khusus kursi roda, audit komunitas, dan manajemen usaha aksesibel.

**AksesKota** dibuat untuk kompetisi **WeDevelopment SMA/SMK ITechno Cup 2026** dengan tema *"Adaptive Innovation for a Future-Ready Digital Society"* dan subtema *"Smart Sustainable Digital Solution for Inclusive Society"*.

---

## Daftar Isi

- [Penjelasan Aplikasi](#penjelasan-aplikasi)
- [Kesesuaian Tema dan SDG](#kesesuaian-tema-dan-sdg)
- [Teknologi yang Digunakan](#teknologi-yang-digunakan)
- [Fitur Utama](#fitur-utama)
- [Cara Instalasi](#cara-instalasi)
- [Cara Penggunaan](#cara-penggunaan)
- [Struktur Proyek](#struktur-proyek)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Privasi dan Keamanan](#privasi-dan-keamanan)
- [Penggunaan AI](#penggunaan-ai)
- [Tim](#tim)
- [Lisensi dan Attribution](#lisensi-dan-attribution)

---

## Penjelasan Aplikasi

### Latar Belakang

Indonesia punya lebih dari 30 juta penyandang disabilitas (BPS 2024). Tapi informasi soal infrastruktur aksesibel — rampa kursi roda, toilet ramah difabel, jalur taktil — masih tersebar, usang, atau bahkan nggak ada sama sekali. Pengguna kursi roda sering baru tahu apakah sebuah tempat bisa diakses setelah sampai di lokasi.

Masalah ini makin parah karena:

- Belum ada database terpusat soal infrastruktur aksesibel di kota-kota besar Indonesia.
- Survei aksesibilitas manual mahal dan nggak scalable.
- Infrastruktur yang sudah ada sering rusak tanpa mekanisme pelaporan yang jelas.

### Tujuan AksesKota

AksesKota (gabungan kata *Akses* + *Kota*) menjawab masalah ini lewat tiga pendekatan:

1. **Data real dari OpenStreetMap** — Mengambil data fasilitas aksesibel secara otomatis lewat Overpass API. Saat ini sudah memetakan **560 lokasi** di koridor Jakarta–Bekasi.

2. **Audit komunitas** — Warga bisa melaporkan kondisi fasilitas lewat formulir singkat berbasis checklist, rating 1–5, foto opsional, dan penjelasan singkat. Semua audit dimoderasi admin sebelum tayang.

3. **Usaha aksesibel** — Usaha kecil bisa mendaftar, mendapat review dari komunitas, dan bersaing di leaderboard berdasarkan skor aksesibilitas. Ini mendorong inklusivitas ekonomi lokal.

4. **Rute khusus kursi roda** — Pengguna bisa membandingkan rute langsung vs rute yang melewati fasilitas aksesibel (rampa, toilet, usaha) lewat Valhalla routing engine.

---

## Kesesuaian Tema dan SDG

| SDG | Hubungan dengan AksesKota |
|-----|--------------------------|
| **SDG 8 — Pekerjaan Layak dan Pertumbuhan Ekonomi** | Fitur usaha aksesibel: pendaftaran usaha, badge aksesibilitas, leaderboard, dan review komunitas untuk mendorong inklusivitas ekonomi lokal. Usaha kecil yang ramah akses mendapat visibilitas lebih. |
| **SDG 9 — Industri, Inovasi, dan Infrastruktur** | Pemanfaatan data terbuka OpenStreetMap, Overpass API, dan Valhalla routing untuk memetakan infrastruktur aksesibel secara otomatis. Arsitektur web ringan (tanpa framework berat) yang bisa jalan di smartphone murah. |
| **SDG 11 — Kota dan Komunitas Berkelanjutan** | Memetakan infrastruktur mobilitas bebas hambatan di hub transit dan ruang komersial Jakarta–Bekasi. Membantu warga merencanakan rute yang bisa diakses dan mengidentifikasi kesenjangan infrastruktur. |

---

## Teknologi yang Digunakan

### Backend

| Komponen | Teknologi | Keterangan |
|----------|-----------|------------|
| Server | Node.js 18+ (zero-dependency) | Cuma pakai module bawaan Node: `http`, `fs`, `path`, `crypto`, `node:sqlite` |
| Database | SQLite (node:sqlite) | Tabel: users, sessions, audits, businesses, business_reviews, custom_locations, location_overrides. Fallback otomatis ke JSON file kalau `node:sqlite` nggak tersedia |
| Sesi | Cookie HttpOnly | Session token random, TTL 7 hari, `SameSite=Lax` |
| Upload | File-based | Foto audit disimpan di `server-data/uploads/`, divalidasi MIME type + ukuran |

### Frontend

| Teknologi | Peruntukan |
|-----------|------------|
| HTML5 | markup semantik |
| CSS3 | Design tokens, Grid/Flexbox, responsive, high contrast, reduced-motion |
| JavaScript ES Modules | tanpa bundler, tanpa framework — murni vanilla JS |

### Library (via CDN + local vendor)

| Library | Versi | Ukuran | Fungsi |
|---------|-------|--------|--------|
| Leaflet.js | 1.9.4 | ~42 KB gzipped | Render peta, marker, layer, geolokasi |
| Leaflet.markercluster | 1.5.3 | ~4 KB gzipped | Pengelompokan marker di area padat |

### API Eksternal (semua tanpa API key)

| Layanan | Fungsi |
|---------|--------|
| OpenStreetMap Tiles | Tile peta |
| Overpass API | Query data fasilitas aksesibel dari OSM |
| Valhalla (OSM demo) | Routing pedestrian dengan profil kursi roda |
| Nominatim | Reverse geocoding (nama lokasi dari koordinat) |
| Google Maps Street View | Buka panorama 360 di tab baru |

---

## Fitur Utama

### 1. Peta Aksesibilitas Interaktif

Peta penuh berbasis Leaflet dengan 560 lokasi dari OpenStreetMap.

**Cara pakai:**
1. Buka halaman **Peta** dari navigasi.
2. Gunakan chip filter di sidebar untuk mempersempit: Semua, Rampa, Toilet, Taktil, Usaha.
3. Klik marker untuk lihat detail — nama, alamat, atribut aksesibilitas (tersedia/tidak/belum diketahui), sumber data, dan timestamp.
4. Ketik nama lokasi di kolom pencarian untuk cari cepat.
5. Tekan tombol **Lokasi saya** (crosshair) untuk melihat posisi Anda.

**Yang bikin beda:** Data bukan dummy. Semua lokasi diambil langsung dari database OpenStreetMap lewat Overpass API, lalu di-cache selama 1 jam. Kalau Overpass down, ada snapshot lokal sebagai fallback.

### 2. Rute Khusus Aksesibilitas

Bukan cuma lihat titik di peta — AksesKota bisa merencanakan rute dari titik A ke titik B dengan pertimbangan aksesibilitas.

**Cara pakai:**
1. Di peta, klik **Petunjuk arah** di detail sheet lokasi.
2. Atau gunakan panel perjalanan: pilih asal (Lokasi saya / pilih dari daftar / klik di peta), lalu pilih tujuan.
3. Pilih profil: **Kursi roda** (hindari tangga, pakai rampa/sidewalk) atau **Jalan kaki**.
4. Pilih fasilitas yang ingin dilewati: rampa, toilet, usaha.
5. Pilih batas tambahan jarak: 10%, 25%, atau 50% dari rute langsung.
6. Klik **Bandingkan rute**.

**Yang terjadi di balik layar:**
- Sistem meminta rute langsung dari Valhalla (profil `pedestrian`, `type: wheelchair`, `use_steps: 0`).
- Lalu mencari fasilitas aksesibel dalam koridor 250 meter dari garis rute.
- Menguji maksimal 2 alternatif yang melewati satu fasilitas.
- Kalau nggak ada alternatif yang masuk batas, rute langsung ditampilkan dengan peringatan "kondisi belum terverifikasi."

**Penting:** Ini rekomendasi lewat titik fasilitas, bukan jaminan bahwa pintu masuk bisa dicapai. Kualitas data tergantung kelengkapan tag OSM.

### 3. Audit Komunitas

Warga bisa melaporkan kondisi fasilitas aksesibel.

**Cara pakai:**
1. Buka halaman **Audit** dari navigasi, atau klik **Audit lokasi** di detail sheet peta.
2. Login atau buat akun dulu (wajib — audit tanpa akun nggak diterima server).
3. Pilih lokasi dari daftar.
4. Centang fasilitas yang tersedia: Rampa, Toilet, Jalur taktil, Rambu.
5. Beri rating 1–5.
6. (Opsional) Upload foto JPG/PNG/WebP maks 5 MB — otomatis dikompresi di browser.
7. (Opsional) Tulis penjelasan singkat (maks 500 karakter).
8. Klik **Kirim Audit**.

**Status audit:** Pending → Admin review → Disetujui / Ditolak. Poin (10 per audit) baru diberikan setelah disetujui admin.

### 4. Panel Admin

Dashboard untuk mengelola seluruh data aplikasi.

**Kredensial admin (demo/kompetisi):**
- Email: `channkeiko916@gmail.com`
- Kata sandi: `Nainggolan`
- Kode akses: `AKSES2026`

**Cara akses:**
1. Buka `admin.html` atau klik **Admin** di navigasi (hanya muncul kalau sudah login sebagai admin).
2. Login dengan email, kata sandi, dan kode akses admin di atas.

**Yang bisa dilakukan admin:**

| Menu | Fungsi |
|------|--------|
| **Ringkasan** | Statistik: jumlah lokasi aktif, usaha terdaftar, audit menunggu, audit disetujui. Aksi cepat: tambah lokasi, cek audit, segarkan cache OSM. |
| **Lokasi** | Lihat, edit, hapus semua lokasi (OSM + custom). Filter berdasarkan nama/alamat/ID dan kategori. Tambah lokasi baru lewat form atau langsung dari peta. |
| **Usulan lokasi** | Review lokasi baru yang diusulkan pengguna atau admin. Setujui untuk menayangkan di peta publik, tolak untuk menyembunyikan. |
| **Moderasi audit** | Lihat audit berdasarkan status: Menunggu, Disetujui, Ditolak, Semua. Preview foto bukti, baca penjelasan, beri catatan moderator, lalu setujui atau tolak. |
| **Usaha terdaftar** | Verifikasi atau hapus usaha. Cari berdasarkan nama/pemilik/email. Filter: semua, aksesibel saja, belum diverifikasi. |
| **Leaderboard** | Kelola peringkat kontribusi komunitas. Cari dan hapus kontributor (audit mereka ditandai ditolak). |
| **Aktivitas** | Log semua aktivitas moderasi admin. |

**Menambah lokasi dari peta:**
1. Klik **Tambah lokasi** di admin panel atau tombol **Tambah lokasi** di peta.
2. Klik titik di peta (kursor jadi crosshair).
3. Isi nama, alamat, pilih kategori (bisa multi-select), koordinat terisi otomatis.
4. Klik **Kirim**. Lokasi masuk antrean usulan — tampil di peta publik setelah disetujui admin.

### 5. Usaha Aksesibel

Platform untuk usaha kecil mendapat visibilitas dan bersaing berdasarkan aksesibilitas.

**Cara pakai (pengusaha):**
1. Buka halaman **Usaha** dari navigasi.
2. Pilih tab **Daftarkan Usaha**.
3. Isi: nama usaha, alamat lengkap, kategori, nama pemilik, email, deskripsi, lokasi di peta, dan layanan yang tersedia (kursi roda, tuna netra, bahasa isyarat, lansia).
4. **Koordinat lokasi (opsional)** — isi latitude/longitude manual atau tekan **"Pakai lokasi saya"** untuk mengisi otomatis dari GPS. Keduanya boleh dikosongkan.
5. Submit. Usaha muncul di peta dan leaderboard.

**Sistem skor & badge:**

| Badge | Skor minimum | Keterangan |
|-------|-------------|------------|
| Platinum | 85+ | Aksesibilitas kelas dunia |
| Emas | 70+ | Sangat aksesibel |
| Perak | 50+ | Cukup aksesibel |
| Perunggu | <50 | Mulai meningkatkan akses |

Skor dihitung dari: rating rata-rata review (60%) + ketersediaan fasilitas (40%). Badge diperbarui otomatis setiap kali usaha menerima review baru.

**Leaderboard usaha:**
- **Skor Tertinggi** — Usaha dengan aksesibilitas terbaik.
- **Paling Berkembang** — Usaha dengan peningkatan skor terbesar.

### 6. Login dan Akun

Sistem akun memastikan setiap audit terhubung ke kontributor yang bertanggung jawab.

**Cara pakai:**
1. Buka **login.html** atau klik **Masuk** di navigasi.
2. **Register:** Isi nama (min 2 karakter), email, kata sandi (min 6 karakter). Akun langsung aktif.
3. **Login:** Masukkan email dan kata sandi.
4. **Admin login:** Masukkan email, kata sandi, dan kode akses admin (default: `AKSES2026`).
5. **Logout:** Klik tombol **Keluar** di navigasi atau di halaman audit.

Sesi disimpan via cookie HttpOnly selama 7 hari. Password di-hash dengan SHA-256 + salt.

### 7. Aksesibilitas Antarmuka (WCAG)

AksesKota sendiri harus bisa diakses oleh pengguna yang dilayaninya.

**Fitur yang tersedia:**
- **Skip link** — "Lewati ke konten" untuk screen reader.
- **Focus state terlihat** — Outline 3px solid pada semua elemen interaktif.
- **Kontras tinggi** — Toggle untuk latar gelap + teks putih.
- **Ukuran teks** — 3 level: Normal, Besar, Sangat besar.
- **Kurangi animasi** — Mematikan semua transisi dan motion.
- **Navigasi keyboard** — Semua fungsi bisa diakses tanpa mouse.
- **ARIA labels** — Label pada kontrol penting untuk screen reader.
- **Touch target** — Minimal 44px pada kontrol utama.
- **`prefers-reduced-motion`** — Otomatis mendeteksi preferensi sistem.

### 8. Desain Visual

- **Navbar** — Logo di kiri, navigasi tengah (pill container), aksesibilitas + akun di kanan.
- **Mobile responsive** — Hamburger menu, bottom sheet, touch-friendly.
- **Mode gelap/terang** — Toggle via panel aksesibilitas.
- **Desain tanpa emoji** — Semua ikon pakai teks atau CSS, bukan emoji unicode (agar konsisten lintas platform).

---

## Cara Instalasi

### Prasyarat

- **Node.js 20+** — Download dari https://nodejs.org (Node 22+ memakai SQLite bawaan; versi lebih lama otomatis memakai penyimpanan JSON)
- **Browser modern** — Chrome, Edge, Firefox, atau Safari
- **Koneksi internet** — Untuk tile peta, Overpass, Valhalla, dan Street View

### Mode 1 — Menjalankan di Lokal (data permanen)

```bash
# 1. Clone repository
git clone https://github.com/jackkd414-source/akseskotaa.git
cd akseskotaa

# 2. Jalankan server (backend + file statis)
node backend/server.js

# 3. Buka browser
# http://localhost:8080
```

**Windows:** Klik dua kali `start-server.bat` atau `start.bat`.

**Port lain:**
```bash
PORT=3000 node backend/server.js
```

**Kode admin default:** `AKSES2026`
Ganti lewat environment variable:
```bash
ADMIN_CODE=rahasia123 node backend/server.js
```

Server akan membuat folder `server-data/` secara otomatis untuk menyimpan database SQLite dan file upload. Data di mode ini tersimpan permanen di komputer/VM Anda.

### Mode 2 — Deploy ke Vercel (hosting online)

Repositori ini sudah dikonfigurasi dual-mode: file statis (HTML/CSS/JS) dilayani CDN Vercel, sedangkan API dipindah ke fungsi serverless lewat folder `api/` + `vercel.json`. Satu kode backend (`backend/server.js`) dipakai bersama oleh server lokal dan Vercel — tidak perlu menulis ulang apa pun.

1. Push repository ini ke GitHub.
2. Di https://vercel.com/new → **Import** repository → **Deploy**.
3. (Opsional) Tambah Environment Variable `ADMIN_CODE` untuk mengganti kode admin.
4. **Aktifkan penyimpanan permanen (Vercel Blob)** supaya akun, audit, dan usaha tidak hilang saat redeploy/cold start:
   - Buka dashboard project di vercel.com → tab **Storage** → **Create Database** → pilih **Blob**.
   - Pilih project ini → **Connect**. Vercel otomatis menambahkan env variable `BLOB_READ_WRITE_TOKEN`.
   - Deploy ulang sekali (atau buka **Settings → Environment Variables** → pastikan `BLOB_READ_WRITE_TOKEN` ada → **Redeploy**).
   - Setelah itu seluruh data tersimpan di Blob dan bertahan selamanya. Tanpa token ini, backend otomatis memakai penyimpanan sementara `/tmp` (data hilang saat instance dingin — hanya untuk uji coba).

---

## Cara Penggunaan

### Navigasi

- **Logo AksesKota** (pojok kiri) — Kembali ke beranda.
- **Navigasi tengah** — Beranda, Peta, Audit, Komunitas, Usaha, Tentang.
- **Admin** — Muncul di navigasi setelah login sebagai admin.
- **Masuk** — Muncul kalau belum login.
- **Keluar** — Muncul kalau sudah login.
- **Aksesibilitas** — Buka panel pengaturan tampilan.
- **Mobile:** Hamburger menu (3 garis) di pojok kanan atas.

### Menjelajahi Peta

1. Buka halaman **Peta**.
2. Peta otomatis memuat 560 lokasi dari OpenStreetMap.
3. Gunakan chip filter untuk mempersempit: Rampa, Toilet, Taktil, Usaha.
4. Ketik nama lokasi di kolom pencarian.
5. Klik marker untuk lihat detail: nama, alamat, atribut, rating, sumber data.
6. Tekan **Lokasi saya** untuk menampilkan posisi Anda.

### Mengirim Audit

1. Login dulu (wajib).
2. Buka halaman **Audit** atau klik **Audit lokasi** di detail peta.
3. Pilih lokasi dari daftar.
4. Centang fasilitas yang tersedia.
5. Beri rating 1–5.
6. (Opsional) Upload foto dan tulis penjelasan.
7. Klik **Kirim Audit**.
8. Audit masuk status "Menunggu" — poin diberikan setelah admin menyetujui.

### Mencari Rute

1. Di peta, pilih lokasi tujuan → klik **Petunjuk arah**.
2. Atau gunakan panel perjalanan:
   - Pilih asal: Lokasi saya / daftar lokasi / klik di peta.
   - Pilih tujuan.
   - Pilih profil: Kursi roda atau Jalan kaki.
   - Pilih fasilitas yang ingin dilewati.
   - Pilih batas tambahan jarak.
3. Klik **Bandingkan rute**.
4. Lihat perbandingan: jarak, waktu, fasilitas yang dilewati.

### Mengelola sebagai Admin

1. Buka `admin.html`.
2. Login dengan email, kata sandi, dan kode akses.
3. Gunakan sidebar untuk navigasi: Ringkasan, Lokasi, Usulan lokasi, Moderasi audit, Usaha terdaftar, Leaderboard, Aktivitas.
4. **Moderasi audit:** Klik tab status → lihat detail → beri catatan → Setujui/Tolak.
5. **Kelola lokasi:** Tambah/Edit/Hapus langsung dari tabel atau dari peta.
6. **Kelola usaha:** Verifikasi atau hapus usaha yang terdaftar.
7. **Kelola leaderboard:** Hapus kontributor yang melanggar aturan.

### Mendaftarkan Usaha

1. Buka halaman **Usaha**.
2. Pilih tab **Daftarkan Usaha**.
3. Isi formulir: nama, alamat, kategori, kontak, deskripsi, lokasi di peta, layanan.
4. Submit. Usaha langsung muncul di peta dan leaderboard.

---

## Struktur Proyek

```
AksesKota/
├── index.html                 # Beranda
├── map.html                   # Peta interaktif
├── audit.html                 # Form audit
├── community.html             # Poin dan leaderboard kontributor
├── business.html              # Usaha aksesibel (leaderboard, review, daftar)
├── about.html                 # Tentang AksesKota
├── admin.html                 # Panel admin
├── login.html                 # Login dan registrasi
├── api/index.js               # Entry serverless Vercel (memanggil backend/server.js)
├── backend/server.js          # Server Node.js zero-dependency (dipakai lokal + Vercel)
├── package.json               # Metadata + engines Node untuk Vercel
├── vercel.json                # Rewrites /api/* → fungsi serverless
├── start.bat / start.sh       # Launcher (Node.js, Windows/Unix)
├── start-server.bat / .sh     # Launcher (Node.js only, rekomendasi)
├── css/
│   ├── tokens.css             # Design tokens (warna, tipografi, spasi)
│   ├── base.css               # Reset & primitif
│   ├── shell.css              # Topbar, nav, panel aksesibilitas
│   ├── components.css         # Kartu, tabel, form, tombol, badge
│   ├── admin.css              # Penyesuaian khusus admin
│   └── trip.css               # Panel perjalanan/rute
├── js/
│   ├── core.js                # Shell bersama, venue loader, aksesibilitas
│   ├── api.js                 # API client (fetch + cookie)
│   ├── osm-api.js             # Overpass parser, cache, fallback
│   ├── map-page.js            # Peta, filter, rute, Street View
│   ├── accessible-routing.js  # Valhalla routing adapter
│   ├── facility-routing.js    # Perencana rute berbasis fasilitas
│   ├── map-network.js         # Geocoding, search, debounce
│   ├── city-scope.js          # Filter batas kota Jakarta/Bekasi
│   ├── audit-page.js          # Form audit, foto, kompresi
│   ├── community-page.js      # Leaderboard kontributor
│   ├── business-page.js       # Leaderboard usaha, review, registrasi
│   ├── business-store.js      # Data store usaha (legacy)
│   ├── admin-page.js          # Admin UI: moderasi, lokasi, usaha, leaderboard
│   ├── admin-store.js         # Admin persistence (legacy)
│   ├── login.js               # Login dan registrasi
│   └── user-store.js          # Wrapper API untuk autentikasi
├── data/
│   ├── osm-snapshot.json      # 560 lokasi OSM (fallback saat Overpass down)
│   ├── city-boundaries.json   # Batas 8 kota/kabupaten Jakarta-Bekasi
│   └── seed-users.json        # Data awal pengguna
├── vendor/
│   ├── leaflet/               # Leaflet 1.9.4 (lokal, bukan CDN)
│   └── markercluster/         # MarkerCluster 1.5.3 (lokal)
├── server-data/               # Runtime: database SQLite + upload foto
└── README.md                  # Dokumentasi ini
```

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│  ┌───────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │  8 halaman │ │  16 modul│ │  CSS (6 file)      │ │
│  │  HTML/CSS  │ │  JS ES   │ │  Design tokens +   │ │
│  │            │ │  Modules │ │  responsive        │ │
│  └───────────┘ └──────────┘ └────────────────────┘ │
├─────────────────────────────────────────────────────┤
│                  Server Node.js (port 8080)          │
│  ┌──────────────────────────────────────────────┐   │
│  │  API Router (20+ endpoints)                  │   │
│  │  Auth: register/login/logout/admin/login     │   │
│  │  CRUD: audits/businesses/locations/leaderboard│   │
│  │  Static file server (HTML/CSS/JS/images)     │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Database: SQLite (node:sqlite)              │   │
│  │  + JSON fallback (kalau node:sqlite tidak ada)│   │
│  │  Tabel: users, sessions, audits, businesses, │   │
│  │  business_reviews, custom_locations,          │   │
│  │  location_overrides                           │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│               Layanan Eksternal (Publik)             │
│  Overpass API │ Valhalla │ Nominatim │ OSM Tiles     │
│  (tanpa API key, semua gratis)                       │
└─────────────────────────────────────────────────────┘
```

**Alur data audit:**
```
User submit audit → Server simpan (status: pending) → Admin review
  → Disetujui: poin +10, masuk leaderboard, usaha di lokasi dpt review
  → Ditolak: audit ditandai rejected, tidak masuk leaderboard
```

**Alur usaha aksesibel:**
```
Pengusaha daftar → Usaha muncul di peta + leaderboard
  → Komunitas audit lokasi usaha → Admin approve
  → Review masuk ke usaha → Skor & badge diperbarui otomatis
```

---

## Privasi dan Keamanan

- **Password di-hash** dengan SHA-256 + salt (`akseskota::` + password). Tidak disimpan plain text.
- **Sesi via cookie HttpOnly** — Tidak bisa diakses oleh JavaScript di browser. TTL 7 hari.
- **Foto audit** disimpan di server (`server-data/uploads/`), divalidasi berdasarkan MIME type (JPG/PNG/WebP) dan ukuran maks 5 MB. Tidak pernah dikirim ke layanan pihak ketiga.
- **Geolokasi** hanya diminta setelah aksi pengguna (klik tombol), tidak disimpan di server.
- **Admin gate** — Semua endpoint `/api/admin/*` memeriksa session cookie + role admin. Kode akses bisa diubah lewat env `ADMIN_CODE`.
- **XSS protection** — Teks dinamis di-escape sebelum ditampilkan ke DOM.
- **Path traversal** — Static file server memastikan path tidak keluar dari root proyek.
- **Payload limit** — Request body dibatasi 8 MB.

**Yang belum ada (batasan jujur):**
- Rate limiting belum diterapkan.
- Audit log server-side belum ada.
- Object storage untuk foto belum terpisah.
- Belum ada HTTPS (tergantung deployment).

---

## Penggunaan AI

AI digunakan sebagai alat bantu selama pengembangan untuk:

- **Perancangan arsitektur** — Menentukan struktur database, endpoint API, dan pemisahan modul.
- **Penulisan kode** — Membantu menulis kode JavaScript, CSS, dan SQL.
- **Debugging** — Menganalisis error dan menemukan bug.
- **Dokumentasi** — Menulis README dan komentar kode.

**Yang AI tidak lakukan:**
- AI tidak memproses data pengguna di dalam aplikasi.
- Tidak ada fitur AI yang berjalan di production.
- Semua kode ditinjau dan diuji oleh tim sebelum digunakan.
- Data pribadi, password, dan kredensial tidak pernah dikirim melalui AI.

Tim bertanggung jawab penuh atas semua kode yang dihasilkan. Seluruh anggota tim memahami dan bisa menjelaskan setiap bagian kode saat presentasi.

---

## Tim

| Nama | Peran |
|------|-------|
| Keigan Lukas Bukit | Frontend Developer & UI/UX Designer |
| Arcel Magabe Nainggolan | Backend Developer & API Integration |
| Chico Yadi Bayuargo | Accessibility Specialist & Documentation |

---

## Lisensi dan Attribution

- **Data dan tile:** © OpenStreetMap contributors, licensed under Open Database License (ODbL).
- **Leaflet 1.9.4:** BSD-2-Clause License.
- **Leaflet.markercluster 1.5.3:** MIT License.
- **Source code:** Milik tim AksesKota, ITechno Cup 2026.
- **Street View:** Dibuka via URL Google Maps (bukan integrasi API).

---

**AksesKota — Navigasi Kota Tanpa Batasan**

*Mendukung SDG 8 · SDG 9 · SDG 11*

*ITechno Cup 2026*
