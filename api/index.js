/**
 * AksesKota — entrypoint serverless untuk Vercel.
 *
 * Logika API + database dipakai BERSAMA dengan mode lokal:
 *   - Lokal  : node backend/server.js   (menjalankan HTTP server sendiri)
 *   - Vercel : api/index.js  ->  require('../backend/server.js')
 *
 * Vercel hanya mengeksekusi file di folder /api. Semua permintaan /api/*
 * di-route ke fungsi ini lewat "rewrites" di vercel.json, sedangkan file
 * statis (html/css/js/gambar) tetap dilayani CDN Vercel secara normal.
 */
'use strict';

module.exports = require('../backend/server.js');
