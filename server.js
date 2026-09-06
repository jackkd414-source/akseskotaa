#!/usr/bin/env node
/**
 * AksesKota server — production-ready local/VM server.
 * Zero dependency (Node >= 18). Database: SQLite (node:sqlite) with JSON fallback.
 *
 * Endpoints:
 *   POST /api/register            {name,email,password}
 *   POST /api/login               {email,password}
 *   POST /api/admin/login         {email,password,code}
 *   POST /api/logout
 *   GET  /api/me
 *   GET  /api/audits              (approved: public; own pending: auth)
 *   POST /api/audits              {locationId,locationName,contributorName,rating,features,explanation,image?}
 *   GET  /api/leaderboard
 *   GET  /api/businesses          (leaderboard + reviews summary)
 *   POST /api/businesses          {name,address,category,ownerName,ownerEmail,description,locationId}
 *   GET  /api/admin/audits        (admin)
 *   POST /api/admin/audits/:id    {status,note}          (admin)
 *   GET  /api/admin/stats         (admin)
 *
 * Static: serves this folder. Uploads (audit photos) stored under server-data/uploads.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'server-data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_JSON = path.join(DATA_DIR, 'akseskota.json');
const SESSION_COOKIE = 'akseskota_session';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_BODY = 8 * 1024 * 1024; // 8 MB (covers base64 photo ~5MB)
const ADMIN_CODE = process.env.ADMIN_CODE || 'AKSES2026';

for (const d of [DATA_DIR, UPLOAD_DIR]) fs.mkdirSync(d, { recursive: true });

/* ---------------- Database (node:sqlite with JSON fallback) ---------------- */

let db = null;            // node:sqlite DatabaseSync
let useJson = false;

function openSqlite() {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const file = path.join(DATA_DIR, 'akseskota.sqlite');
    const d = new DatabaseSync(file);
    for (const col of ["pending INTEGER DEFAULT 0", "contributor_name TEXT DEFAULT ''"]) {
      try { d.exec('ALTER TABLE custom_locations ADD COLUMN ' + col); } catch (e) { /* kolom sudah ada */ }
    }
    try { d.exec("ALTER TABLE businesses ADD COLUMN services TEXT DEFAULT '[]'"); } catch (e) { /* kolom sudah ada */ }
    d.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL, provider TEXT DEFAULT 'email', role TEXT DEFAULT 'user',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audits (
        id TEXT PRIMARY KEY, location_id TEXT NOT NULL, location_name TEXT NOT NULL,
        contributor_name TEXT DEFAULT 'Anonim', user_id TEXT, rating INTEGER NOT NULL,
        features TEXT DEFAULT '[]', explanation TEXT DEFAULT '', image TEXT,
        status TEXT DEFAULT 'pending', moderation_note TEXT DEFAULT '',
        created_at TEXT NOT NULL, moderated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL,
        category TEXT DEFAULT 'general', owner_name TEXT DEFAULT '', owner_email TEXT NOT NULL,
        description TEXT DEFAULT '', location_id TEXT, verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS business_reviews (
        id TEXT PRIMARY KEY, business_id TEXT NOT NULL, location_id TEXT,
        rating INTEGER NOT NULL, features TEXT DEFAULT '[]', reviewer_name TEXT DEFAULT 'Anonim',
        audit_id TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS custom_locations (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT DEFAULT '',
        lat REAL NOT NULL, lng REAL NOT NULL, source TEXT DEFAULT 'Admin lokal',
        categories TEXT DEFAULT '[]', attributes TEXT DEFAULT '{}',
        pending INTEGER DEFAULT 0, contributor_name TEXT DEFAULT '',
        deleted INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS location_overrides (
        osm_id TEXT PRIMARY KEY, name TEXT, address TEXT,
        categories TEXT DEFAULT '[]', attributes TEXT DEFAULT '{}',
        deleted INTEGER DEFAULT 0, updated_at TEXT NOT NULL
      );
    `);
    return d;
  } catch (e) {
    return null;
  }
}

// ---- JSON fallback store ----
let jdata = null;
function loadJson() {
  if (jdata) return jdata;
  try { jdata = JSON.parse(fs.readFileSync(DB_JSON, 'utf8')); } catch { jdata = {}; }
  for (const k of ['users', 'sessions', 'audits', 'businesses', 'business_reviews', 'custom_locations', 'location_overrides']) {
    if (!Array.isArray(jdata[k])) jdata[k] = [];
  }
  return jdata;
}
let jsonTimer = null;
function saveJson() {
  if (jsonTimer) return;
  jsonTimer = setTimeout(() => {
    jsonTimer = null;
    try { fs.writeFileSync(DB_JSON, JSON.stringify(jdata, null, 1)); } catch (e) { console.error('DB write failed:', e.message); }
  }, 120);
}

db = openSqlite();
if (!db) { useJson = true; loadJson(); console.log('[db] node:sqlite unavailable — using JSON store (server-data/akseskota.json)'); }
else console.log('[db] SQLite ready (server-data/akseskota.sqlite)');

/* ---------------- Data access layer ---------------- */

const DB = {
  hash(pw) { return crypto.createHash('sha256').update('akseskota::' + pw).digest('hex'); },
  uid(p) { return `${p}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`; },

  createUser({ name, email, password, role = 'user' }) {
    const user = { id: this.uid('user'), name, email, password: this.hash(password), provider: 'email', role, created_at: new Date().toISOString() };
    if (useJson) { loadJson().users.push(user); saveJson(); }
    else db.prepare('INSERT INTO users (id,name,email,password,provider,role,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(user.id, user.name, user.email, user.password, user.provider, user.role, user.created_at);
    return user;
  },
  findUserByEmail(email) {
    if (useJson) return loadJson().users.find(u => u.email === email) || null;
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
  },
  getUser(id) {
    if (!id) return null;
    if (useJson) return loadJson().users.find(u => u.id === id) || null;
    return db.prepare('SELECT id,name,email,role FROM users WHERE id = ?').get(id) || null;
  },
  createSession(userId, role) {
    const token = crypto.randomBytes(24).toString('hex');
    const expires = Date.now() + SESSION_TTL;
    if (useJson) { loadJson().sessions.push({ token, user_id: userId, role, expires_at: expires }); saveJson(); }
    else db.prepare('INSERT INTO sessions (token,user_id,role,expires_at) VALUES (?,?,?,?)').run(token, userId, role, expires);
    return token;
  },
  getSession(token) {
    if (!token) return null;
    let s;
    if (useJson) s = loadJson().sessions.find(x => x.token === token);
    else s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (!s || s.expires_at < Date.now()) return null;
    return s;
  },
  deleteSession(token) {
    if (useJson) { const d = loadJson(); d.sessions = d.sessions.filter(x => x.token !== token); saveJson(); }
    else db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },

  insertAudit(a) {
    if (useJson) { loadJson().audits.push(a); saveJson(); }
    else db.prepare('INSERT INTO audits (id,location_id,location_name,contributor_name,user_id,rating,features,explanation,image,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(a.id, a.location_id, a.location_name, a.contributor_name, a.user_id, a.rating, JSON.stringify(a.features || []), a.explanation || '', a.image || null, a.status || 'pending', a.created_at);
    return a;
  },
  listAudits() {
    if (useJson) return loadJson().audits.slice();
    return db.prepare('SELECT * FROM audits ORDER BY created_at DESC').all().map(r => ({ ...r, features: JSON.parse(r.features || '[]') }));
  },
  jsonAudits() { // normalized shape for both backends
    return this.listAudits().map(a => ({
      id: a.id, locationId: a.location_id, locationName: a.location_name,
      contributorName: a.contributor_name || 'Anonim', userId: a.user_id, rating: a.rating,
      features: typeof a.features === 'string' ? JSON.parse(a.features || '[]') : (a.features || []),
      explanation: a.explanation || '', image: a.image ? { dataUrl: a.image } : null,
      status: a.status || 'pending', moderationNote: a.moderation_note || '',
      timestamp: a.created_at, moderatedAt: a.moderated_at || null
    }));
  },
  updateAudit(id, fields) {
    const audits = this.jsonAudits();
    const i = audits.findIndex(a => a.id === id);
    if (i < 0) return null;
    const merged = { ...audits[i], ...fields };
    if (useJson) {
      const d = loadJson(); const raw = d.audits.find(x => x.id === id);
      if (raw) Object.assign(raw, {
        status: merged.status, moderation_note: merged.moderationNote, moderated_at: merged.moderatedAt,
        contributor_name: merged.contributorName, rating: merged.rating, features: merged.features, explanation: merged.explanation
      });
      saveJson();
    } else {
      db.prepare('UPDATE audits SET status=?, moderation_note=?, moderated_at=?, contributor_name=?, rating=?, features=?, explanation=? WHERE id=?')
        .run(merged.status, merged.moderationNote || '', merged.moderatedAt || null, merged.contributorName, merged.rating, JSON.stringify(merged.features || []), merged.explanation || '', id);
    }
    return merged;
  },

  insertBusiness(b) {
    if (useJson) { loadJson().businesses.push(b); saveJson(); }
    else db.prepare('INSERT INTO businesses (id,name,address,category,owner_name,owner_email,description,location_id,verified,services,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(b.id, b.name, b.address, b.category, b.owner_name, b.owner_email, b.description, b.location_id, b.verified ? 1 : 0, JSON.stringify(b.services || []), b.created_at);
    return b;
  },
  listBusinesses() {
    if (useJson) return loadJson().businesses.slice();
    return db.prepare('SELECT * FROM businesses ORDER BY created_at DESC').all().map(b => ({ ...b, verified: !!b.verified, services: JSON.parse(b.services || '[]') }));
  },
  insertBusinessReview(r) {
    if (useJson) { loadJson().business_reviews.push(r); saveJson(); }
    else db.prepare('INSERT INTO business_reviews (id,business_id,location_id,rating,features,reviewer_name,audit_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(r.id, r.business_id, r.location_id, r.rating, JSON.stringify(r.features || []), r.reviewer_name, r.audit_id, r.created_at);
    return r;
  },
  listBusinessReviews() {
    if (useJson) return loadJson().business_reviews.slice();
    return db.prepare('SELECT * FROM business_reviews').all().map(r => ({ ...r, features: JSON.parse(r.features || '[]') }));
  },

  /* ---- Admin locations: custom + OSM overrides ---- */
  upsertCustomLocation(loc) {
    const now = new Date().toISOString();
    const row = {
      id: loc.id || this.uid('custom'), name: loc.name, address: loc.address || '',
      lat: Number(loc.lat), lng: Number(loc.lng), source: loc.source || 'Admin lokal',
      categories: JSON.stringify(loc.categories || []), attributes: JSON.stringify(loc.attributes || {}),
      deleted: 0, created_at: loc.created_at || now, updated_at: now
    };
    row.pending = loc.pending ? 1 : 0;
    row.contributor_name = String(loc.contributor_name || '').slice(0, 40);
    if (useJson) {
      const arr = loadJson().custom_locations;
      const i = arr.findIndex(x => x.id === row.id);
      if (i >= 0) arr[i] = { ...arr[i], ...row };
      else arr.push(row);
      saveJson();
    } else {
      db.prepare(`INSERT INTO custom_locations (id,name,address,lat,lng,source,categories,attributes,pending,contributor_name,deleted,created_at,updated_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                  ON CONFLICT(id) DO UPDATE SET name=excluded.name,address=excluded.address,lat=excluded.lat,lng=excluded.lng,
                    source=excluded.source,categories=excluded.categories,attributes=excluded.attributes,
                    pending=excluded.pending,contributor_name=excluded.contributor_name,
                    deleted=excluded.deleted,updated_at=excluded.updated_at`)
        .run(row.id, row.name, row.address, row.lat, row.lng, row.source, row.categories, row.attributes, row.pending, row.contributor_name, row.deleted, row.created_at, row.updated_at);
    }
    return row;
  },
  upsertOverride(osmId, patch) {
    const now = new Date().toISOString();
    const row = {
      osm_id: osmId, name: patch.name ?? null, address: patch.address ?? null,
      categories: JSON.stringify(patch.categories || []), attributes: JSON.stringify(patch.attributes || {}),
      deleted: patch.deleted ? 1 : 0, updated_at: now
    };
    if (useJson) {
      const arr = loadJson().location_overrides;
      const i = arr.findIndex(x => x.osm_id === osmId);
      if (i >= 0) arr[i] = { ...arr[i], ...row, updated_at: now };
      else arr.push(row);
      saveJson();
    } else {
      db.prepare(`INSERT INTO location_overrides (osm_id,name,address,categories,attributes,deleted,updated_at)
                  VALUES (?,?,?,?,?,?,?)
                  ON CONFLICT(osm_id) DO UPDATE SET name=excluded.name,address=excluded.address,
                    categories=excluded.categories,attributes=excluded.attributes,deleted=excluded.deleted,updated_at=excluded.updated_at`)
        .run(row.osm_id, row.name, row.address, row.categories, row.attributes, row.deleted, row.updated_at);
    }
    return row;
  },
  listCustomLocations() {
    const norm = r => ({ ...r, categories: JSON.parse(r.categories || '[]'), attributes: JSON.parse(r.attributes || '{}'), deleted: !!r.deleted, pending: !!r.pending });
    if (useJson) return loadJson().custom_locations.slice().map(norm);
    return db.prepare('SELECT * FROM custom_locations').all().map(norm);
  },
  approveCustomLocation(id) {
    const now = new Date().toISOString();
    if (useJson) { const r = loadJson().custom_locations.find(x => x.id === id); if (r) { r.pending = 0; r.updated_at = now; saveJson(); } }
    else db.prepare('UPDATE custom_locations SET pending=0, updated_at=? WHERE id=?').run(now, id);
  },
  listOverrides() {
    if (useJson) return loadJson().location_overrides.slice();
    return db.prepare('SELECT * FROM location_overrides').all().map(r => ({ ...r, categories: JSON.parse(r.categories || '[]'), attributes: JSON.parse(r.attributes || '{}'), deleted: !!r.deleted }));
  },
  deleteLocation(id) {
    const now = new Date().toISOString();
    if (String(id).startsWith('custom-')) {
      if (useJson) { const d = loadJson(); const r = d.custom_locations.find(x => x.id === id); if (r) { r.deleted = 1; r.updated_at = now; saveJson(); } }
      else db.prepare('UPDATE custom_locations SET deleted=1, updated_at=? WHERE id=?').run(now, id);
    } else {
      // Soft-delete OSM location: hanya balik flag deleted — pertahankan nama/kategori agar bisa dipulihkan admin.
      if (useJson) {
        const arr = loadJson().location_overrides;
        const r = arr.find(x => x.osm_id === id);
        if (r) { r.deleted = 1; r.updated_at = now; }
        else arr.push({ osm_id: id, name: null, address: null, categories: [], attributes: {}, deleted: 1, updated_at: now });
        saveJson();
      } else {
        db.prepare(`INSERT INTO location_overrides (osm_id, deleted, updated_at) VALUES (?, 1, ?)
                    ON CONFLICT(osm_id) DO UPDATE SET deleted=1, updated_at=excluded.updated_at`)
          .run(id, now);
      }
    }
  }
};

/* ---------------- Business logic ---------------- */

function businessStats() {
  const reviews = DB.listBusinessReviews();
  const audits = DB.jsonAudits().filter(a => a.status === 'approved' && a.locationId);
  return DB.listBusinesses().map(b => {
    // Sumber review: business_reviews (audit saat disetujui) + audit approved lain pada lokasi yang sama,
    // jadi usaha yang didaftarkan setelah audit tetap mendapat skor.
    const byReview = reviews.filter(r => r.business_id === b.id).map(r => ({
      rating: r.rating, features: r.features || [], reviewer: r.reviewer_name, auditId: r.audit_id
    }));
    const seen = new Set(byReview.map(r => r.auditId));
    const byAudit = audits.filter(a => a.locationId === b.location_id && !seen.has(a.id))
      .map(a => ({ rating: a.rating, features: a.features || [], reviewer: a.contributorName, auditId: a.id }));
    const mine = [...byReview, ...byAudit];
    const avg = mine.length ? mine.reduce((s, r) => s + (r.rating || 0), 0) / mine.length : 0;
    const features = ['wheelchair_ramp', 'accessible_restroom', 'tactile_paving', 'signage'];
    const fc = {};
    for (const f of features) fc[f] = mine.length ? Math.round(mine.filter(r => (r.features || []).includes(f)).length / mine.length * 100) : 0;
    const coverage = features.reduce((s, f) => s + fc[f], 0) / features.length;
    const score = mine.length ? Math.round((avg / 5) * 60 + (coverage / 100) * 40) : 0;
    let badge = 'bronze';
    if (score >= 85) badge = 'platinum'; else if (score >= 70) badge = 'gold'; else if (score >= 50) badge = 'silver';
    const services = Array.isArray(b.services) ? b.services : [];
    return { id: b.id, name: b.name, address: b.address, category: b.category, locationId: b.location_id, verified: !!b.verified, services, accessible: services.length > 0, score, avgRating: Number(avg.toFixed(1)), reviewCount: mine.length, badgeLevel: badge };
  }).sort((a, b) => b.score - a.score || b.reviewCount - a.reviewCount);
}

/* ---------------- HTTP helpers ---------------- */

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function send(res, code, body, headers = {}) {
  const buf = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(buf);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('Payload too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}
function auth(req) {
  const s = DB.getSession(parseCookies(req)[SESSION_COOKIE]);
  if (!s) return null;
  return { sessionId: s.token, role: s.role, userId: s.user_id };
}
function requireAdmin(req) {
  const a = auth(req);
  return a && a.role === 'admin' ? a : null;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- API router ---------------- */

async function handleApi(req, res, url) {
  const p = url.pathname;
  const method = req.method;

  // ---- Auth ----
  if (p === '/api/register' && method === 'POST') {
    const b = await readBody(req);
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (name.length < 2) return send(res, 400, { ok: false, error: 'Nama harus minimal 2 karakter.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { ok: false, error: 'Format email tidak valid.' });
    if (password.length < 6) return send(res, 400, { ok: false, error: 'Kata sandi minimal 6 karakter.' });
    if (DB.findUserByEmail(email)) return send(res, 409, { ok: false, error: 'Email sudah terdaftar. Silakan masuk.' });
    const user = DB.createUser({ name, email, password });
    const token = DB.createSession(user.id, 'user');
    return send(res, 200, { ok: true, user: { id: user.id, name: user.name, email: user.email, role: 'user' } }, {
      'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`
    });
  }

  if (p === '/api/login' && method === 'POST') {
    const b = await readBody(req);
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const user = DB.findUserByEmail(email);
    if (!user || user.password !== DB.hash(password)) return send(res, 401, { ok: false, error: 'Email atau kata sandi salah.' });
    const token = DB.createSession(user.id, user.role === 'admin' ? 'admin' : 'user');
    return send(res, 200, { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role === 'admin' ? 'admin' : 'user' } }, {
      'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`
    });
  }

  if (p === '/api/admin/login' && method === 'POST') {
    const b = await readBody(req);
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const code = String(b.code || '').trim();
    if (code !== ADMIN_CODE) return send(res, 403, { ok: false, error: 'Kode akses admin salah.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { ok: false, error: 'Format email tidak valid.' });
    if (password.length < 6) return send(res, 400, { ok: false, error: 'Kata sandi admin minimal 6 karakter.' });
    // Admin account is self-provisioned on first admin login (local/demo model).
    let user = DB.findUserByEmail(email);
    if (!user) user = DB.createUser({ name: 'Administrator', email, password, role: 'admin' });
    else if (user.role !== 'admin') { if (useJson) { user.role = 'admin'; saveJson(); } else db.prepare('UPDATE users SET role=? WHERE id=?').run('admin', user.id); user.role = 'admin'; }
    const token = DB.createSession(user.id, 'admin');
    return send(res, 200, { ok: true, user: { id: user.id, name: user.name, email: user.email, role: 'admin' } }, {
      'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`
    });
  }

  if (p === '/api/logout' && method === 'POST') {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) DB.deleteSession(token);
    return send(res, 200, { ok: true }, { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0` });
  }

  if (p === '/api/me' && method === 'GET') {
    const s = DB.getSession(parseCookies(req)[SESSION_COOKIE]);
    if (!s) return send(res, 200, { ok: true, user: null });
    let user = null;
    if (useJson) user = loadJson().users.find(u => u.id === s.user_id) || null;
    else user = db.prepare('SELECT id,name,email,role FROM users WHERE id = ?').get(s.user_id) || null;
    return send(res, 200, { ok: true, user: user ? { id: user.id, name: user.name, email: user.email, role: s.role } : null });
  }

  // ---- Public locations overlay (custom yang sudah disetujui) ----
  if (p === '/api/locations' && method === 'GET') {
    const custom = DB.listCustomLocations().filter(c => !c.deleted && !c.pending);
    return send(res, 200, { ok: true, custom });
  }

  // ---- Usulan lokasi dari pengguna peta (guest boleh) ----
  if (p === '/api/locations/suggest' && method === 'POST') {
    const b = await readBody(req);
    const name = String(b.name || '').trim();
    const lat = Number(b.lat), lng = Number(b.lng);
    const contributorName = String(b.contributorName || '').trim().slice(0, 40);
    if (name.length < 2) return send(res, 400, { ok: false, error: 'Nama lokasi minimal 2 karakter.' });
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return send(res, 400, { ok: false, error: 'Latitude tidak valid.' });
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return send(res, 400, { ok: false, error: 'Longitude tidak valid.' });
    const categories = Array.isArray(b.categories) ? b.categories.filter(c => ['wheelchair_place','wheelchair_ramp','accessible_restroom','tactile_paving'].includes(c)) : [];
    if (!categories.length) return send(res, 400, { ok: false, error: 'Pilih minimal satu kategori.' });
    const sess = DB.getSession(parseCookies(req)[SESSION_COOKIE]);
    const isAdmin = sess && sess.role === 'admin';
    const row = DB.upsertCustomLocation({
      id: null, name: name.slice(0, 120), address: String(b.address || '').slice(0, 200),
      lat, lng, categories, attributes: {}, source: isAdmin ? 'Admin (perlu verifikasi)' : 'Usulan pengguna',
      pending: true, contributor_name: contributorName || (isAdmin ? 'Admin' : '')
    });
    return send(res, 200, { ok: true, id: row.id, pending: true, message: isAdmin ? 'Lokasi tersimpan dan menunggu verifikasi Anda di konsol admin.' : 'Usulan terkirim. Akan tampil setelah admin menyetujui.' });
  }

  // ---- Audits (public read of approved, guest submit) ----
  if (p === '/api/audits' && method === 'GET') {
    const all = DB.jsonAudits();
    const s = DB.getSession(parseCookies(req)[SESSION_COOKIE]);
    const visible = all.filter(a => a.status === 'approved' || (s && (s.role === 'admin' || a.userId === s.user_id)));
    return send(res, 200, { ok: true, audits: visible });
  }

  if (p === '/api/audits' && method === 'POST') {
    const b = await readBody(req);
    const locationId = String(b.locationId || '').slice(0, 80);
    const locationName = String(b.locationName || '').slice(0, 160);
    const contributorName = String(b.contributorName || '').trim().slice(0, 40) || 'Anonim';
    const rating = Number(b.rating);
    const features = Array.isArray(b.features) ? b.features.filter(f => ['wheelchair_ramp', 'accessible_restroom', 'tactile_paving', 'signage'].includes(f)) : [];
    const explanation = String(b.explanation || '').slice(0, 500);
    let image = null;
    if (b.image && typeof b.image === 'object' && typeof b.image.dataUrl === 'string') {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.image.dataUrl);
      if (!m) return send(res, 400, { ok: false, error: 'Format foto tidak didukung.' });
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 5 * 1024 * 1024) return send(res, 400, { ok: false, error: 'Foto maksimum 5 MB.' });
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const fname = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, fname), buf);
      image = `/server-data/uploads/${fname}`;
    }
    if (!locationId || !locationName) return send(res, 400, { ok: false, error: 'Lokasi wajib dipilih.' });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return send(res, 400, { ok: false, error: 'Rating 1-5 wajib diisi.' });

    const sess = DB.getSession(parseCookies(req)[SESSION_COOKIE]);
    if (!sess) return send(res, 401, { ok: false, error: 'Buat akun atau masuk dulu untuk mengirim audit.', requireAuth: true });
    const user = DB.getUser(sess.user_id);
    if (!user) return send(res, 401, { ok: false, error: 'Sesi tidak valid. Masuk ulang.', requireAuth: true });
    const finalName = (user.name || '').trim() || user.email.split('@')[0];
    const audit = {
      id: DB.uid('audit'), location_id: locationId, location_name: locationName,
      contributor_name: finalName, user_id: user.id, rating,
      features, explanation, image, status: 'pending', created_at: new Date().toISOString()
    };
    DB.insertAudit(audit);
    return send(res, 200, { ok: true, id: audit.id });
  }

  if (p === '/api/leaderboard' && method === 'GET') {
    const approved = DB.jsonAudits().filter(a => a.status === 'approved');
    const byKey = new Map();
    for (const a of approved) {
      let key, name;
      if (a.userId) {
        const u = DB.getUser(a.userId);
        if (u) { key = 'u:' + u.id; name = (u.name || '').trim() || u.email.split('@')[0]; }
      }
      if (!key) { key = 'n:' + ((a.contributorName || '').trim() || 'Anonim'); name = a.contributorName || 'Anonim'; }
      const cur = byKey.get(key) || { name, count: 0, points: 0, userId: a.userId || null };
      cur.count++; cur.points += 10;
      byKey.set(key, cur);
    }
    const all = [...byKey.values()].sort((a, b) => b.points - a.points || b.count - a.count);
    const rows = all.slice(0, 20);
    // Simpan juga versi lengkap untuk admin (paginated)
    if (req.headers['x-admin-list'] === '1') {
      return send(res, 200, { ok: true, rows: all, total: all.length });
    }
    return send(res, 200, { ok: true, rows });
  }
  if (p === '/api/admin/leaderboard/remove' && method === 'POST') {
    const a = requireAdmin(req);
    if (!a) return send(res, 403, { ok: false, error: 'Akses admin diperlukan.' });
    const b = await readBody(req);
    const name = String(b.name || '').trim();
    const userId = b.userId ? String(b.userId) : null;
    if (!name && !userId) return send(res, 400, { ok: false, error: 'Nama atau userId wajib.' });
    const all = DB.jsonAudits();
    const target = all.filter(x => {
      if (x.status !== 'approved') return false;
      if (userId) return x.userId === userId;
      return ((x.contributorName || '').trim() || 'Anonim') === name;
    });
    const ids = new Set(target.map(t => t.id));
    if (useJson) { const d = loadJson(); d.audits.forEach(a => { if (ids.has(a.id)) a.status = 'rejected'; }); saveJson(); }
    else { const stmt = db.prepare('UPDATE audits SET status=? WHERE id=?'); for (const id of ids) stmt.run('rejected', id); }
    return send(res, 200, { ok: true, removed: ids.size });
  }

  // ---- Businesses ----
  if (p === '/api/businesses' && method === 'GET') {
    return send(res, 200, { ok: true, businesses: businessStats() });
  }

  if (p === '/api/businesses' && method === 'POST') {
    const b = await readBody(req);
    const name = String(b.name || '').trim();
    const address = String(b.address || '').trim();
    const ownerEmail = String(b.ownerEmail || '').trim().toLowerCase();
    if (name.length < 2) return send(res, 400, { ok: false, error: 'Nama usaha harus minimal 2 karakter.' });
    if (address.length < 5) return send(res, 400, { ok: false, error: 'Alamat usaha harus minimal 5 karakter.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return send(res, 400, { ok: false, error: 'Email pemilik tidak valid.' });
    const locationId = b.locationId ? String(b.locationId).slice(0, 80) : null;
    if (locationId && DB.listBusinesses().some(x => x.location_id === locationId)) {
      return send(res, 409, { ok: false, error: 'Lokasi peta ini sudah dikaitkan ke usaha lain.' });
    }
    const SERVICE_KEYS = ['kursi_roda', 'tuna_netra', 'bahasa_isyarat', 'lansia'];
    const services = Array.isArray(b.services) ? [...new Set(b.services.map(String))].filter(k => SERVICE_KEYS.includes(k)).slice(0, 4) : [];
    const biz = {
      id: DB.uid('business'), name, address, category: String(b.category || 'general').slice(0, 40),
      owner_name: String(b.ownerName || '').trim().slice(0, 80), owner_email: ownerEmail,
      description: String(b.description || '').slice(0, 500), location_id: locationId,
      verified: false, services, accessible: services.length > 0, created_at: new Date().toISOString()
    };
    DB.insertBusiness(biz);
    return send(res, 200, { ok: true, id: biz.id });
  }

  // ---- Admin ----
  if (p.startsWith('/api/admin/')) {
    const a = requireAdmin(req);
    if (!a) return send(res, 403, { ok: false, error: 'Akses admin diperlukan.' });

    if (p === '/api/admin/audits' && method === 'GET') {
      return send(res, 200, { ok: true, audits: DB.jsonAudits() });
    }
    const m = /^\/api\/admin\/audits\/([^/]+)$/.exec(p);
    if (m && method === 'POST') {
      const b = await readBody(req);
      const status = b.status === 'approved' ? 'approved' : b.status === 'rejected' ? 'rejected' : null;
      if (!status) return send(res, 400, { ok: false, error: 'Status tidak valid.' });
      const note = String(b.note || '').slice(0, 300);
      const updated = DB.updateAudit(m[1], { status, moderationNote: note, moderatedAt: new Date().toISOString() });
      if (!updated) return send(res, 404, { ok: false, error: 'Audit tidak ditemukan.' });
      // Approved audit on a business location feeds the business review stream
      if (status === 'approved') {
        const biz = DB.listBusinesses().find(x => x.location_id === updated.locationId);
        if (biz) {
          DB.insertBusinessReview({
            id: DB.uid('brev'), business_id: biz.id, location_id: updated.locationId,
            rating: updated.rating, features: updated.features, reviewer_name: updated.contributorName,
            audit_id: updated.id, created_at: new Date().toISOString()
          });
        }
      }
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/businesses' && method === 'GET') {
      return send(res, 200, { ok: true, businesses: DB.listBusinesses().map(b => ({ id: b.id, name: b.name, address: b.address, category: b.category, location_id: b.location_id, services: b.services || [], accessible: (b.services || []).length > 0, owner_name: b.owner_name, owner_email: b.owner_email, verified: !!b.verified, created_at: b.created_at })) });
    }
    const bizMatch = /^\/api\/admin\/businesses\/([^/]+)$/.exec(p);
    if (bizMatch) {
      const id = decodeURIComponent(bizMatch[1]);
      if (method === 'POST') {
        const b = await readBody(req);
        if (typeof b.verified === 'boolean') {
          if (useJson) { const d = loadJson(); const row = d.businesses.find(x => x.id === id); if (row) { row.verified = b.verified; saveJson(); } }
          else db.prepare('UPDATE businesses SET verified=? WHERE id=?').run(b.verified ? 1 : 0, id);
          return send(res, 200, { ok: true });
        }
        return send(res, 400, { ok: false, error: 'Aksi tidak dikenal.' });
      }
      if (method === 'DELETE') {
        if (useJson) { const d = loadJson(); d.businesses = d.businesses.filter(x => x.id !== id); d.business_reviews = d.business_reviews.filter(r => r.business_id !== id); saveJson(); }
        else { db.prepare('DELETE FROM business_reviews WHERE business_id=?').run(id); db.prepare('DELETE FROM businesses WHERE id=?').run(id); }
        return send(res, 200, { ok: true });
      }
    }
    if (p === '/api/admin/stats' && method === 'GET') {
      const audits = DB.jsonAudits();
      return send(res, 200, {
        ok: true,
        stats: {
          audits: audits.length,
          pending: audits.filter(x => x.status === 'pending').length,
          approved: audits.filter(x => x.status === 'approved').length,
          businesses: DB.listBusinesses().length
        }
      });
    }
  }

    // ---- Admin locations (CRUD + overrides OSM) ----
    if (p === '/api/admin/locations' && method === 'GET') {
      return send(res, 200, { ok: true, custom: DB.listCustomLocations(), overrides: DB.listOverrides() });
    }
    if (p === '/api/admin/locations' && method === 'POST') {
      const b = await readBody(req);
      const name = String(b.name || '').trim();
      const lat = Number(b.lat), lng = Number(b.lng);
      if (name.length < 2) return send(res, 400, { ok: false, error: 'Nama lokasi minimal 2 karakter.' });
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) return send(res, 400, { ok: false, error: 'Latitude tidak valid.' });
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) return send(res, 400, { ok: false, error: 'Longitude tidak valid.' });
      const categories = Array.isArray(b.categories) ? b.categories.filter(c => ['wheelchair_place','wheelchair_ramp','accessible_restroom','tactile_paving'].includes(c)) : [];
      const attributes = {};
      for (const [k, v] of Object.entries(b.attributes || {})) attributes[k] = !!v;
      const isNew = !b.id;
      const row = DB.upsertCustomLocation({
        id: b.id || null, name, address: String(b.address || '').slice(0, 200),
        lat, lng, categories, attributes,
        pending: isNew ? 1 : 0, contributor_name: isNew ? 'Admin' : undefined
      });
      return send(res, 200, { ok: true, id: row.id, pending: isNew });
    }
    const locAdminMatch = /^\/api\/admin\/locations\/([^/]+)\/(approve|reject)$/.exec(p);
    if (locAdminMatch && method === 'POST') {
      const id = decodeURIComponent(locAdminMatch[1]);
      const action = locAdminMatch[2];
      if (action === 'approve') { DB.approveCustomLocation(id); return send(res, 200, { ok: true }); }
      DB.deleteLocation(id);
      return send(res, 200, { ok: true });
    }
    const locMatch = /^\/api\/admin\/locations\/([^/]+)$/.exec(p);
    if (locMatch) {
      const id = decodeURIComponent(locMatch[1]);
      if (method === 'POST') {
        const b = await readBody(req);
        if (String(id).startsWith('custom-')) {
          const existing = DB.listCustomLocations().find(x => x.id === id);
          const row = DB.upsertCustomLocation({ id, name: String(b.name || '').trim(), address: String(b.address || ''), lat: Number(b.lat), lng: Number(b.lng), categories: b.categories || [], attributes: b.attributes || {}, pending: existing?.pending ? 1 : 0, contributor_name: existing?.contributor_name });
          return send(res, 200, { ok: true, id: row.id, pending: !!row.pending });
        }
        // OSM location: simpan override saja
        DB.upsertOverride(id, {
          name: b.name, address: b.address, categories: b.categories || [],
          attributes: b.attributes || {}, deleted: !!b.deleted
        });
        return send(res, 200, { ok: true });
      }
      if (method === 'DELETE') {
        DB.deleteLocation(id);
        return send(res, 200, { ok: true });
      }
    }

  return send(res, 404, { ok: false, error: 'Endpoint tidak ditemukan.' });
}

/* ---------------- Static files ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) return send(res, 403, { ok: false, error: 'Forbidden' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { ok: false, error: 'Not found' });
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };
    if (p.startsWith('/server-data/')) headers['Cache-Control'] = 'no-store'; else headers['Cache-Control'] = 'public, max-age=300';
    if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end(); }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------------- Server ---------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: 'Method not allowed' });
    return serveStatic(req, res, url);
  } catch (e) {
    console.error('[error]', req.method, url.pathname, e.message);
    if (!res.headersSent) return send(res, e.message === 'Payload too large' ? 413 : 500, { ok: false, error: e.message === 'Payload too large' ? 'Ukuran data terlalu besar.' : 'Kesalahan server.' });
  }
});

server.listen(PORT, () => {
  console.log(`AksesKota server berjalan di http://localhost:${PORT}`);
  console.log(`Admin code: ${ADMIN_CODE} (set env ADMIN_CODE untuk mengubah)`);
});
