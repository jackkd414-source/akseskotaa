# AksesKota

> Platform web pemetaan aksesibilitas perkotaan untuk membantu penyandang disabilitas, lansia, orang tua dengan stroller, dan warga dengan kebutuhan mobilitas menemukan rampa, lift, toilet aksesibel, serta jalur taktil di Jakarta.

AksesKota dibuat untuk kategori Web Development SMA/MA/SMK ITechno Cup 2026 dengan tema **“Adaptive Innovation for a Future-Ready Digital Society”** dan subtema **“Smart Sustainable Digital Solution for Inclusive Society”**.

## Daftar Isi

- [Demo dan Repository](#demo-dan-repository)
- [Penjelasan Aplikasi](#penjelasan-aplikasi)
- [Kesesuaian Tema dan SDG](#kesesuaian-tema-dan-sdg)
- [Teknologi yang Digunakan](#teknologi-yang-digunakan)
- [Fitur Utama](#fitur-utama)
- [Fitur Usaha Aksesibel](#fitur-usaha-aksesibel)
- [Sumber dan Validitas Data](#sumber-dan-validitas-data)
- [Cara Instalasi](#cara-instalasi)
- [Cara Penggunaan](#cara-penggunaan)
- [Struktur dan Arsitektur](#struktur-dan-arsitektur)
- [Privasi dan Keamanan](#privasi-dan-keamanan)
- [Penggunaan AI](#penggunaan-ai)
- [Kepatuhan Guidebook](#kepatuhan-guidebook-itechno-cup-2026)
- [Rencana Pengembangan](#rencana-pengembangan)

---

## Demo dan Repository

| Item | Tautan |
|---|---|
| Live demo | `Tambahkan URL deployment HTTPS` |
| GitHub repository | `Tambahkan URL repository publik` |
| Video demo (opsional) | `Tambahkan jika tersedia` |

> Kedua tautan pertama wajib dilengkapi sebelum pengumpulan penyisihan karena guidebook meminta repository GitHub dan website yang sudah di-hosting (hlm. 9 dan 12).
>
> Langkah lengkap untuk push ke GitHub, deploy ke Netlify, dan mengaktifkan backend audit bersama tersedia pada [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Penjelasan Aplikasi

### Latar Belakang

Informasi kondisi fasilitas aksesibilitas di Indonesia masih tersebar dan dapat berubah tanpa pembaruan yang cepat. Pengguna sering baru mengetahui apakah sebuah lokasi memiliki rampa, lift yang berfungsi, toilet aksesibel, atau jalur taktil setelah tiba di tempat tujuan.

AksesKota mengurangi ketidakpastian tersebut melalui:

1. **Peta data terbuka** dari OpenStreetMap (OSM) melalui Overpass API.
2. **Audit komunitas singkat** berbasis checklist, rating, foto opsional, dan penjelasan opsional.
3. **Moderasi lokal** untuk menyetujui atau menolak audit sebelum poin diberikan.
4. **Akses informasi perjalanan** berupa pencarian, filter, geolokasi, petunjuk arah, dan tautan Street View.

### Tujuan

- Memudahkan pencarian fasilitas publik yang memiliki atribut aksesibilitas.
- Membantu pengguna merencanakan perjalanan dengan informasi awal yang lebih baik.
- Mendorong kontribusi masyarakat untuk memperbarui kondisi fasilitas.
- Menunjukkan pemanfaatan web dan data terbuka untuk kota yang lebih inklusif.

### Batasan Produk Saat Ini

Versi kompetisi adalah aplikasi web statis tanpa proses build. Terdapat dua mode operasi:

| Mode | Kondisi | Perilaku |
|---|---|---|
| Lokal | `js/backend-config.js` kosong (default) | Audit, foto, poin, dan override admin disimpan di `localStorage` perangkat pengirim. |
| Bersama | `js/backend-config.js` diisi kredensial Supabase | Audit dikirim ke database bersama sehingga terlihat oleh semua pengunjung; keputusan moderasi disinkronkan. |

Foto bukti **tidak pernah** diunggah ke server pada kedua mode — hanya fakta audit yang dibagikan. Ini keputusan privasi yang disengaja.

Yang masih belum tersedia: autentikasi admin sisi server, akun pengguna tersinkron lintas perangkat, dan verifikasi resmi terhadap kondisi fisik lokasi. Langkah pengaktifan mode bersama didokumentasikan pada [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Kesesuaian Tema dan SDG

| Elemen guidebook | Implementasi AksesKota |
|---|---|
| Solusi digital inovatif, responsif, aplikatif | Peta interaktif multi-page, audit komunitas, moderasi, dan desain responsif |
| Masyarakat inklusif | Informasi ditujukan untuk pengguna dengan kebutuhan mobilitas dan aksesibilitas |
| **SDG 9 — Industri, Inovasi, dan Infrastruktur** | Pemanfaatan OSM, Overpass, navigasi web, dan data fasilitas infrastruktur |
| **SDG 11 — Kota dan Komunitas Berkelanjutan** | Mendukung mobilitas, layanan publik, dan kehidupan kota yang lebih inklusif |
| **SDG 8 — Pekerjaan Layak dan Pertumbuhan Ekonomi** | Fitur usaha kecil aksesibel: pendaftaran usaha, badge aksesibilitas, leaderboard, dan review komunitas untuk mendorong inklusivitas ekonomi lokal |

Fokus terkuat AksesKota adalah **SDG 9 dan SDG 11**. SDG 8 merupakan dampak pendukung, bukan fitur ekonomi yang sudah diimplementasikan.

---

## Teknologi yang Digunakan

### Frontend

| Teknologi | Peruntukan |
|---|---|
| HTML5 | Struktur halaman semantik dan elemen formulir native |
| CSS3 | Design tokens, Grid/Flexbox, responsive layout, focus state, high contrast, reduced-motion preference |
| JavaScript ES Modules | Data loading, peta, audit, moderasi, local state, dan interaksi |
| `localStorage` | Cache OSM, audit, foto terkompresi, poin, override admin lokal, dan preferensi tema |

### Library

| Library | Versi | Peruntukan |
|---|---:|---|
| Leaflet | 1.9.4 | Render peta, marker, layer, geolokasi, dan garis rute |
| Leaflet.markercluster | 1.5.3 | Pengelompokan marker pada area padat |
| Google Fonts | Space Grotesk, Plus Jakarta Sans, DM Sans | Tipografi antarmuka dengan heading geometris dan body elegan |

Library dimuat melalui CDN dan didefinisikan peruntukannya sesuai ketentuan guidebook.

### API dan Layanan Eksternal

| Layanan | Peruntukan | API key |
|---|---|---|
| OpenStreetMap Tiles | Tile peta | Tidak |
| Overpass API | Mengambil elemen OSM dengan tag aksesibilitas eksplisit | Tidak |
| Valhalla public demo server | Rute pedestrian dengan profil kursi roda (`wheelchair=true`), penghindaran tangga, dan batas kemiringan berdasarkan data OSM | Tidak |
| OSRM public demo server | Integrasi lama; tidak lagi dipakai oleh rute utama | Tidak |
| Google Maps URL | Membuka Street View berdasarkan koordinat di tab baru | Tidak |

Aplikasi tidak menggunakan Google Places API.

---

## Fitur Utama

### 1. Peta Aksesibilitas

- Peta penuh berbasis Leaflet dan OpenStreetMap.
- Filter chip kategori (Semua, Usaha, Rampa, Lift, Toilet, Taktil).
- Marker clustering.
- Detail atribut dengan tiga kondisi: tersedia, tidak tersedia, dan belum diketahui.
- Geolokasi pengguna dengan tombol crosshair floating di pojok kanan atas.
- Rute khusus kursi roda melalui Valhalla/OpenStreetMap: profil pedestrian dengan `wheelchair=true`, menghindari tangga (`use_steps=0`), membatasi tingkat kesulitan, dan membatasi kemiringan maksimum 8% ketika tag tersedia.
- Mode pembanding jalan kaki umum.
- Ringkasan jarak/waktu, garis rute, petunjuk langkah, sumber engine, dan peringatan kualitas data.
- Tombol Street View yang selalu membuka Google Maps pada tab baru.

### 2. Data OSM Real dan Snapshot

- Query real-time Overpass untuk Jakarta.
- Hanya mengambil tag eksplisit yang relevan; `wheelchair=yes` umum tidak otomatis diklaim sebagai rampa.
- Cache browser selama satu jam.
- Snapshot OSM nyata terakhir sebagai fallback ketika endpoint Overpass timeout.
- Timestamp snapshot ditampilkan kepada pengguna.

### 3. Audit Kondisi Lokasi

- Checklist fasilitas tanpa kewajiban mengetik.
- Rating 1–5.
- Foto opsional: JPG, PNG, atau WebP, maksimal 5 MB.
- Foto dikompresi di browser menjadi JPEG maksimal 1280 px sebelum disimpan.
- Penjelasan opsional maksimal 500 karakter.
- Audit baru berstatus `pending` dan harus dimoderasi.

### 4. Admin Lokal dan Moderasi

- Tambah lokasi manual.
- Edit/rename lokasi, alamat, kategori, koordinat, dan atribut.
- Soft-delete lokasi tanpa mengubah data OSM asli.
- Approve/reject audit beserta catatan moderator.
- Preview foto dan penjelasan audit.
- Activity log lokal.
- Import/export backup JSON.

> Admin ini sengaja disebut **admin lokal**. Karena belum ada backend dan autentikasi, halaman ini tidak boleh dianggap sebagai kontrol akses production.

### 5. Gamifikasi

- Audit yang disetujui memperoleh 10 poin.
- Progress lencana dihitung dari audit yang disetujui.
- Leaderboard versi proof of concept masih menggunakan data contoh statis untuk peserta lain; hanya entri “Anda” berasal dari audit lokal yang disetujui.

### 6. Aksesibilitas Antarmuka

- Skip link.
- Focus state yang terlihat.
- Navigasi dan kontrol berbasis elemen HTML native.
- Mode kontras tinggi dengan teks yang dapat dibaca di seluruh komponen UI (section, kartu, tabel, form, select/option, badge, peta interaktif, sidebar peta dengan semua konten, detail sheet, rute navigasi, tombol peta, angka cluster marker, angka/peringkat/step-num, leaderboard, admin, tombol aksi).
- Pilihan ukuran teks.
- Dukungan `prefers-reduced-motion`.
- Label ARIA pada kontrol penting.
- Target sentuh minimum pada kontrol utama.

### 7. Desain Visual Premium

- **Navbar Chrome-tab style** — Logo AksesKota di ujung kiri layar, navigasi pusat (Beranda, Peta, Audit, Komunitas, Usaha, Tentang) di tengah dalam container rounded-pill, dan mode gelap/terang (ikon bulan) + badge pengguna di ujung kanan. Navbar mengikuti scroll (non-sticky).
- **Gradient typography** — Heading h1 menggunakan gradient tiga warna (gelap → hijau → amber), heading h2 menggunakan gradient dua warna (gelap → hijau tua), step numbers dan angka statistik menggunakan gradient hijau.
- **Background unik** — Dot grid pattern subtle (24px spacing) dengan gradient blobs hijau di kiri atas dan amber di kanan bawah. Pattern tetap fixed saat scrolling.
- **Glassmorphism** — Topbar dan map cards menggunakan backdrop blur untuk efek kaca premium.
- **Micro-interactions** — Tombol card lift-on-hover, panel dengan gradient accent line on hover, team cards dengan shine sweep effect, trust row dots dengan pulse animation.
- **Chrome-tab panels** — Panel dan step cards dengan border-radius besar (20px), gradient accent lines, dan shadow depth yang terstruktur.
- **Warna lebih kaya** — Palette lebih beragam dengan hijau, amber, biru, ungu, dan gradient multi-warna pada footer, badges, dan elemen dekoratif.
- **Dark mode premium** — Ikon bulan untuk toggle, high-contrast mode dengan gradient badges, glowing shadows, dan yellow accent yang konsisten di seluruh komponen termasuk navbar, tombol keluar, dan user badge.
- **Animated hamburger menu** — Tombol 3 garis hijau dengan transisi morphing ke ikon X saat dibuka. Di mobile, navbar menggunakan `justify-content:space-between` dengan hamburger di pojok kanan atas.
- **Custom scrollbar** — Scrollbar yang styled sesuai tema untuk estetika yang konsisten.
- **Reduced motion respect** — Semua animasi nonaktif untuk pengguna yang memilih reduced motion.
- **Halaman Tentang kaya konten** — 7 section (Masalah, Solusi, Koridor MRT, Teknologi, SDG, Komitmen, Tim) dengan stat counters, problem cards, corridor timeline visual, tech stack cards, SDG badges, commitment grid, CTA gradient.
- **Peta tanpa search bar** — Peta difokuskan pada filter kategori dan floating button lokasi (crosshair SVG) di pojok kanan atas.

Implementasi mengikuti praktik aksesibilitas web, tetapi **belum diklaim tersertifikasi WCAG 2.1** karena audit formal dengan screen reader dan alat otomatis belum selesai.

---

## Fitur Usaha Aksesibel

### 8. Usaha Kecil Aksesibel

Platform baru untuk usaha kecil mendapatkan visibilitas aksesibilitas dan berkompetisi dalam meningkatkan layanan inklusif.

- **Pendaftaran usaha** — Usaha kecil dapat mendaftarkan diri di `business.html` dengan mengisi nama, alamat lengkap, kategori, dan kontak pemilik.
- **Tanda badge usaha** — Setiap usaha terdaftar mendapatkan badge visual (💎 Platinum, 🥇 Emas, 🥈 Perak, 🥉 Perunggu) berdasarkan skor aksesibilitas. Badge ditampilkan di:
  - Peta (marker dengan ikon 🏪)
  - Detail sheet lokasi di peta
  - Leaderboard komunitas
- **Filter usaha di peta** — Chip filter "🏪 Usaha" di sidebar peta untuk menampilkan hanya lokasi usaha terdaftar.
- **Review aksesibilitas** — Usaha menerima review dari komunitas berupa rating 1–5 dan checklist fasilitas (rampa, lift, toilet, jalur taktil, rambu).
- **Skor aksesibilitas** — Dihitung dari:
  - Rating rata-rata review (bobot 60%)
  - Ketersediaan fasilitas aksesibel (bobot 40%)
- **Tren perkembangan** — Membandingkan skor awal dengan skor terkini untuk menunjukkan apakah usaha sedang berkembang.
- **Leaderboard usaha** — Dua kategori peringkat:
  - **Skor Tertinggi** — Usaha dengan aksesibilitas terbaik.
  - **Paling Berkembang** — Usaha dengan peningkatan skor terbesar.
- **Halaman usaha (`business.html`)** — Tiga tab:
  - Leaderboard lengkap dengan badge dan statistik.
  - Review terbaru dengan detail rating dan fasilitas.
  - Form pendaftaran usaha baru.
- **Admin panel usaha** — View "Usaha terdaftar" di admin untuk melihat daftar usaha, badge, skor, dan status verifikasi.
- **Sidebar komunitas** — Mini leaderboard usaha ditampilkan di halaman komunitas dengan tautan ke halaman utama.

### Sistem Badge Usaha

| Badge | Skor Minimum | Keterangan |
|---|---|---|
| 💎 Platinum | 85+ | Aksesibilitas kelas dunia |
| 🥇 Emas | 70+ | Sangat aksesibel |
| 🥈 Perak | 50+ | Cukup aksesibel |
| 🥉 Perunggu | <50 | Mulai meningkatkan akses |

Badge dihitung otomatis berdasarkan skor yang diperbarui setiap kali usaha menerima review baru.

### Data Seed

Untuk keperluan demo kompetisi, tersedia data contoh 6 usaha dengan skor dan riwayat:

- Toko Kaki Sehat Blok M (Skor 88, Platinum, 📈 Berkembang)
- Kopi Akses Senayan (Skor 72, Emas, 📈 Berkembang)
- Laundry Kilat Tebet (Skor 62, Perak, 📈 Berkembang)
- Apotek Sehat Bersama (Skor 55, Perak, 📈 Berkembang)
- Warung Nenek Fatmawati (Skor 38, Perunggu, ➡️ Stabil)
- Bengkel Motor Jaya (Skor 30, Perunggu, ➡️ Stabil)

---

## Sumber dan Validitas Data

Data peta berasal dari kontribusi publik OpenStreetMap di bawah Open Database License (ODbL). “Data real” berarti elemen berasal dari basis data OSM, bukan berarti kondisi fisiknya dijamin 100% benar atau terkini.

- `✓` berarti tag OSM menyatakan atribut tersedia.
- `×` berarti tag OSM secara eksplisit menyatakan tidak tersedia.
- `?` berarti atribut belum dicatat.
- Kondisi lift, rampa, toilet, dan jalur taktil tetap perlu dikonfirmasi di lokasi.
- Override admin lokal tidak menulis perubahan kembali ke OSM.

Attribution OpenStreetMap tetap ditampilkan pada peta.

---

## Cara Instalasi

### Prasyarat

- Browser modern: Chrome, Edge, Firefox, atau Safari.
- Python atau static web server lain.
- Koneksi internet untuk tile peta, Overpass, OSRM, dan Street View. Snapshot OSM lokal tetap tersedia ketika Overpass gagal.

### Menjalankan Lokal

```bash
git clone https://github.com/OWNER/akseskota.git
cd akseskota
python -m http.server 8000
```

Buka:

```text
http://localhost:8000
```

Tidak ada build step atau package installation untuk aplikasi.

> Ganti `OWNER` dengan organisasi/akun GitHub tim sebelum pengumpulan.

### Deploy Netlify/Vercel

Deploy folder proyek sebagai static site tanpa build command. Setelah deploy, uji seluruh URL dan layanan eksternal pada domain HTTPS.

---

## Cara Penggunaan

### Navigasi

- **Logo AksesKota** di ujung kiri — klik untuk kembali ke beranda.
- **Navigasi pusat** — Beranda, Peta, Audit, Komunitas, Usaha, Tentang (dan Admin/Keluar jika sudah login).
- **Ikon bulan** di ujung kanan — buka panel aksesibilitas (kontras tinggi + ukuran teks).
- **Badge pengguna** — menampilkan role dan nama di sebelah kiri ikon bulan.
- **Hamburger menu** (mobile) — 3 garis hijau di pojok kanan atas, morphing ke X saat dibuka.
- Navbar mengikuti scroll (non-sticky) — navbar akan menghilang saat pengguna scroll ke bawah.

### Menjelajahi Peta

1. Buka `map.html` melalui navigasi **Peta**.
2. Gunakan filter chip kategori untuk mempersempit hasil.
3. Pilih marker untuk melihat sumber, atribut, dan timestamp.
4. Gunakan tombol lokasi (crosshair) untuk menampilkan posisi Anda.
5. Gunakan **Petunjuk arah**, **Audit lokasi**, atau **Buka 3D Street View di tab baru**.

### Mengirim Audit

1. Pilih lokasi dari peta atau `audit.html`.
2. Tandai fasilitas dan pilih rating.
3. Opsional: unggah foto dan isi penjelasan.
4. Kirim audit. Status awalnya adalah **Menunggu**.
5. Poin diberikan setelah admin menyetujui audit.

### Moderasi Lokal

1. Buka `admin.html` langsung.
2. Pilih **Moderasi audit**.
3. Periksa checklist, rating, foto, dan penjelasan.
4. Tambahkan catatan moderator lalu setujui atau tolak.

### Mendaftarkan Usaha

1. Buka `business.html` melalui navigasi **Usaha**.
2. Pilih tab **Daftarkan Usaha**.
3. Isi nama usaha, alamat lengkap, kategori, dan kontak pemilik.
4. Submit form. Usaha akan muncul di leaderboard dan peta dengan badge.

### Melihat Leaderboard Usaha

1. Buka `business.html` atau kunjungi halaman **Komunitas**.
2. Lihat peringkat usaha berdasarkan skor aksesibilitas.
3. Beralih antara tab **Skor Tertinggi** dan **Paling Berkembang**.

### Membaca Halaman Tentang

1. Buka `about.html` melalui navigasi **Tentang**.
2. Lihat stat counters di bagian atas (30M+ penyandang disabilitas, 30 detik audit, 100% gratis).
3. Scroll untuk melihat 7 section: Masalah, Solusi, Koridor MRT (dengan visual timeline), Teknologi (6 tech cards), SDG (3 tujuan berkelanjutan), Komitmen, dan Tim.
4. Klik tombol CTA di bagian bawah untuk langsung ke peta atau audit.

---

## Struktur dan Arsitektur

```text
akseskota/
├── index.html                 # Landing page
├── map.html                   # Explore map
├── audit.html                 # Form audit
├── community.html             # Poin dan leaderboard
├── business.html              # Usaha aksesibel (leaderboard, review, daftar)
├── about.html                 # Misi dan teknologi
├── admin.html                 # Admin lokal
├── login.html                 # Login pengguna/admin
├── css/
│   ├── modern.css             # UI publik
│   └── admin.css              # UI admin
├── js/
│   ├── core.js                # Shared shell dan venue loader
│   ├── osm-api.js             # Overpass parser/cache/fallback
│   ├── map-page.js            # Peta, filter, rute, Street View, badge usaha
│   ├── audit-page.js          # Audit, foto, kompresi
│   ├── community-page.js      # Poin, leaderboard, mini leaderboard usaha
│   ├── business-page.js       # Halaman usaha: leaderboard, review, registrasi
│   ├── business-store.js      # Data store usaha, review, skor, leaderboard
│   ├── gamification.js        # Poin, lencana, leaderboard kontributor
│   ├── user-store.js          # Autentikasi pengguna (localStorage)
│   ├── login.js               # UI login dan registrasi
│   ├── admin-store.js         # Local admin persistence
│   ├── admin-page.js          # Admin UI, moderasi, dan manajemen usaha
│   └── accessibility.js       # Fitur aksesibilitas antarmuka
└── data/
    ├── osm-snapshot.json      # Snapshot OSM nyata terakhir
    └── locations.json         # Data lokasi statis (fallback)
```

Arsitektur menggunakan halaman terpisah sesuai konteks tugas. Semua halaman berbagi data melalui ES Modules dan `localStorage`.

---

## Privasi dan Keamanan

- Tidak ada akun, password, analytics, atau backend pada versi ini.
- Geolokasi hanya diminta setelah aksi pengguna dan tidak disimpan.
- Foto audit dan teks disimpan di `localStorage` perangkat yang sama; tidak diunggah ke server.
- Foto divalidasi berdasarkan MIME type dan ukuran, lalu dikompresi.
- Teks dinamis yang ditampilkan admin di-escape untuk mengurangi risiko HTML injection.
- Perubahan lokasi OSM menggunakan override lokal/non-destruktif.
- Pengguna dapat menghapus data browser atau memakai export backup admin.

Keterbatasan keamanan:

- `admin.html` tidak memiliki autentikasi atau otorisasi server.
- `localStorage` bukan penyimpanan yang cocok untuk data sensitif atau sistem multi-user.
- Untuk production diperlukan backend, database, role-based access control, rate limiting, sanitasi server, object storage, consent, dan kebijakan retensi foto.

---

## Penggunaan AI

AI digunakan sebagai alat bantu dalam proses desain, penulisan kode, debugging, pengujian, dan dokumentasi. Penggunaan tersebut tidak menggantikan tanggung jawab tim:

- Tim wajib memahami dan mampu menjelaskan kode saat presentasi.
- Output AI ditinjau dan diuji sebelum digunakan.
- Tidak ada fitur AI yang memproses data pengguna di dalam aplikasi.
- Data pribadi, password, atau kredensial tidak dikirim melalui aplikasi.
- Aset, library, data, dan layanan pihak ketiga harus tetap mematuhi lisensinya.

Bagian ini mendukung prinsip penggunaan AI yang etis, perlindungan data, privasi, keamanan, dan hak cipta pada guidebook halaman 8.

---

## Kepatuhan Guidebook ITechno Cup 2026

Audit ini merujuk pada file **WeDevelopment Guidebook (SMA/SMK) ITechno Cup 2026**, 23 halaman.

| Ketentuan | Status proyek | Bukti / tindakan |
|---|---|---|
| Relevan dengan minimal satu subtema/SDG | Sesuai | Fokus SDG 9 dan 11; lihat guidebook hlm. 3–5 |
| Tim terdiri dari 3 siswa aktif SMA/MA/SMK | Perlu verifikasi administratif | Kartu pelajar dan komposisi tim tidak dapat dibuktikan dari source code; guidebook hlm. 7 |
| Maksimal satu karya per tim | Perlu konfirmasi tim | Tidak dapat diverifikasi dari repository; guidebook hlm. 7 |
| Karya orisinal, belum komersial, belum pernah menang | Perlu deklarasi tim | Tidak dapat diverifikasi teknis; guidebook hlm. 7 |
| Tidak memakai template instan WordPress/Wix | Sesuai secara teknis | Aplikasi dibuat dengan HTML/CSS/JS; guidebook hlm. 7 |
| Library/framework boleh dipakai jika dijelaskan | Sesuai | Leaflet dan markercluster dijelaskan di README; guidebook hlm. 7 |
| AI boleh digunakan secara etis dan aman | Sesuai dengan catatan | Penggunaan dan batasan AI/privasi dijelaskan; guidebook hlm. 8 |
| Repository GitHub + hosted URL | Belum dapat diverifikasi | Remote Git dan URL hosting belum tercantum; guidebook hlm. 9 dan 12 |
| README berisi penjelasan, teknologi, fitur, instalasi, penggunaan | Sesuai | Seluruh bagian tersedia; guidebook hlm. 9 |
| README mengikuti template resmi | Perlu pemeriksaan akhir | Guidebook merujuk template eksternal yang tidak disertakan di PDF; hlm. 12 |
| Deadline penyisihan | Wajib dipenuhi | Minggu, 6 September 2026 pukul 23.59 WIB; hlm. 12 |
| Final dan live demo | Persiapan diperlukan | Sabtu, 20 September 2026 via Zoom/Google Meeting; hlm. 13 |
| Bebas plagiarisme/hak cipta | Perlu deklarasi dan audit aset | Pelanggaran dapat menyebabkan diskualifikasi; guidebook hlm. 17 |

### Kesimpulan Kepatuhan

Tidak ditemukan pelanggaran teknis langsung pada implementasi saat ini. Namun status **belum bisa dinyatakan 100% patuh** sampai tim menyelesaikan pemeriksaan administratif dan submission berikut:

- memastikan tepat tiga siswa aktif beserta kartu pelajar;
- memastikan hanya satu karya dikirim;
- menandatangani deklarasi orisinalitas, riwayat publikasi, dan riwayat kompetisi;
- mengganti URL clone placeholder;
- menambahkan tautan repository GitHub dan deployment aktif;
- membandingkan README ini dengan template README resmi dari panitia;
- memastikan semua anggota memahami kode dan penggunaan AI;
- mengaudit lisensi aset serta menjaga attribution OSM.

### Kriteria Penilaian Penyisihan

| Kriteria | Bobot | Fokus persiapan AksesKota |
|---|---:|---|
| Kesesuaian tema dan subtema | 20% | Perkuat bukti dampak SDG 9/11 |
| Inovasi dan orisinalitas | 20% | Jelaskan pembeda audit cepat + moderasi + data OSM |
| Fungsionalitas | 20% | Uji endpoint failure, audit, admin, dan mobile |
| UI/UX dan responsivitas | 15% | Lakukan usability serta accessibility testing |
| Implementasi teknologi | 15% | Rapikan source, keamanan dasar, dan dokumentasi arsitektur |
| Dokumentasi dan repository | 10% | Screenshot, deployment, commit history, setup terverifikasi |

Sumber: guidebook hlm. 14–15.

---

## Rencana Pengembangan

### Prioritas sebelum pengumpulan

1. **Repository dan deployment** — buat repository GitHub bersih, isi remote URL, deploy HTTPS, lalu uji semua halaman.
2. **Hapus kode/data legacy** — pindahkan atau hapus SPA lama dan `locations.json` demo agar juri tidak bingung menentukan implementasi aktif.
3. **Hilangkan data leaderboard contoh** — gunakan data kontribusi nyata atau tampilkan empty state; jangan campur data contoh dengan klaim real.
4. **Screenshot dokumentasi** — tambahkan screenshot desktop/mobile untuk landing, peta, audit, dan admin seperti saran guidebook hlm. 10.
5. **Audit aksesibilitas** — jalankan Lighthouse, axe, keyboard-only test, NVDA/VoiceOver, contrast check, dan dokumentasikan hasil.
6. **Test matrix** — Chrome, Edge, Firefox, Android viewport, offline/endpoint timeout, geolocation denied, storage full, serta upload tidak valid.
7. **Lisensi dan attribution** — tambahkan file `LICENSE`/`THIRD_PARTY_NOTICES.md` yang sesuai dan catat Leaflet, markercluster, OSM/ODbL, OSRM, Google Fonts, serta Google Maps.
8. **Deklarasi tim** — isi nama/peran tiga anggota dan checklist administrasi yang belum dapat diverifikasi.

### Prioritas teknis berikutnya

1. Backend dan database nyata untuk sinkronisasi audit.
2. Login serta role pengguna, moderator, dan admin.
3. Object storage privat untuk foto; consent, metadata stripping, retention, dan deletion policy.
4. Moderasi multi-user dengan audit log server-side.
5. Tingkatkan rute aksesibel dengan data audit lokal, permukaan, lebar jalur, curb, lift aktif, dan validasi kemiringan; engine saat ini sudah memakai profil kursi roda Valhalla tetapi kualitasnya tetap bergantung pada kelengkapan tag OSM.
6. Verifikasi lokasi berjenjang: OSM, audit komunitas, bukti foto, timestamp, dan confidence score.
7. Pelaporan fasilitas rusak serta status sementara/masa berlaku audit.
8. PWA/service worker untuk offline-first dan instalasi mobile.
9. Sinkronisasi kontribusi terverifikasi kembali ke OpenStreetMap sesuai kebijakan OSM.
10. Dashboard dampak berbasis data nyata, tanpa statistik atau testimoni rekaan.
11. Automated tests untuk parser OSM, CRUD admin, moderasi, sanitasi, dan alur audit.
12. Monitoring uptime layanan eksternal dan fallback endpoint yang terukur.
13. Grafik tren skor usaha dari waktu ke waktu pada halaman detail usaha.
14. Workflow verifikasi usaha oleh admin (approve/reject pendaftaran usaha).
15. Laporan/export PDF ringkasan aksesibilitas untuk usaha terdaftar.
16. Halaman profil usaha detail dengan riwayat review lengkap dan perbandingan usaha sejenis.

### Persiapan babak final

- Pitch deck berisi masalah, solusi, tujuan, teknologi, dampak, dan demo; guidebook hlm. 10–11.
- Demo offline/fallback untuk mengantisipasi Overpass atau koneksi bermasalah.
- Latihan presentasi 10 menit dan sesi tanya jawab 10 menit; guidebook hlm. 11.
- Semua anggota harus dapat menjelaskan arsitektur, alasan teknologi, keamanan, skalabilitas, dan batasan produk; kriteria final hlm. 16–17.

---

## Jadwal Penting

| Tahap | Jadwal |
|---|---|
| Deadline penyisihan | 6 September 2026, 23.59 WIB |
| Babak final online | 20 September 2026, 08.30 WIB–selesai |
| Pengumuman saat closing | 28 September 2026 |

Sumber: guidebook hlm. 11–13.

---

## Tim

Kompetisi kategori SMA/MA/SMK wajib diikuti tiga orang per tim. Lengkapi bagian ini sebelum submission.

| Nama | Peran | Status siswa |
|---|---|---|
| Keigan Lukas Bukit | Developer | `Lengkapi` |
| Arcel Magabe Naingollan | Developer | `Lengkapi` |
| Chico Yadi Bayuargo | Developer | `Lengkapi` |

---

## Lisensi dan Attribution

- Data dan tile: © OpenStreetMap contributors, ODbL.
- Leaflet 1.9.4 dan Leaflet.markercluster 1.5.3 digunakan sesuai lisensi masing-masing.
- OSRM public service hanya digunakan untuk proof of concept dan tidak direkomendasikan sebagai backend production.
- Street View dibuka melalui URL Google Maps; ketersediaan panorama bergantung pada cakupan Google.

Tambahkan lisensi source code tim dan `THIRD_PARTY_NOTICES.md` sebelum pengumpulan final.

---

**AksesKota — navigasi kota tanpa batasan.**
