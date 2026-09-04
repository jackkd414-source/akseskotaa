/**
 * AksesKota — Shared Audit Backend (Supabase REST)
 *
 * Purpose: make community audits visible to EVERY visitor, not just the
 * browser that submitted them. Without this, "platform komunitas" is only
 * true for one device.
 *
 * Design notes:
 * - Uses plain fetch against Supabase's REST endpoint. No SDK, no build step,
 *   so the project stays a dependency-free static site.
 * - Every function degrades gracefully: if the backend is not configured or
 *   unreachable, callers fall back to localStorage and the UI still works.
 * - Photos are NOT uploaded. Base64 images would blow past row limits and
 *   raise real privacy questions; only the audit facts are shared.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isBackendConfigured } from './backend-config.js';

const TABLE = 'audits';
const TIMEOUT_MS = 12000;

function headers(extra = {}) {
    return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...extra
    };
}

async function request(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: headers(options.headers),
        signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Backend ${response.status}: ${body.slice(0, 160)}`);
    }
    return response.status === 204 ? null : response.json();
}

/** Row shape in Supabase -> shape the rest of the app already understands. */
function fromRow(row) {
    return {
        id: row.id,
        locationId: row.location_id,
        locationName: row.location_name,
        rating: row.rating,
        features: row.features || [],
        explanation: row.explanation || '',
        status: row.status || 'pending',
        moderationNote: row.moderation_note || '',
        moderatedAt: row.moderated_at || null,
        timestamp: row.created_at,
        image: null,
        remote: true
    };
}

function toRow(audit) {
    return {
        id: audit.id,
        location_id: audit.locationId,
        location_name: audit.locationName,
        rating: audit.rating,
        features: audit.features || [],
        explanation: audit.explanation || '',
        status: audit.status || 'pending',
        created_at: audit.timestamp || new Date().toISOString()
    };
}

export { isBackendConfigured };

/**
 * Fetch every shared audit, newest first.
 * @returns {Promise<Array<Object>>} empty array when backend is off/unreachable
 */
export async function fetchRemoteAudits() {
    if (!isBackendConfigured()) return [];
    try {
        const rows = await request(`${TABLE}?select=*&order=created_at.desc&limit=500`);
        return (rows || []).map(fromRow);
    } catch (error) {
        console.warn('[AksesKota] Gagal memuat audit bersama:', error.message);
        return [];
    }
}

/**
 * Publish one audit so other visitors can see it.
 * @returns {Promise<{ok: boolean, error?: string, skipped?: boolean}>}
 */
export async function pushRemoteAudit(audit) {
    if (!isBackendConfigured()) return { ok: false, skipped: true };
    try {
        await request(TABLE, {
            method: 'POST',
            headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
            body: JSON.stringify(toRow(audit))
        });
        return { ok: true };
    } catch (error) {
        console.warn('[AksesKota] Gagal mengirim audit ke server:', error.message);
        return { ok: false, error: error.message };
    }
}

/**
 * Apply a moderation decision to the shared copy.
 * @returns {Promise<{ok: boolean, error?: string, skipped?: boolean}>}
 */
export async function pushRemoteModeration(id, status, note = '') {
    if (!isBackendConfigured()) return { ok: false, skipped: true };
    try {
        await request(`${TABLE}?id=eq.${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({
                status,
                moderation_note: note,
                moderated_at: new Date().toISOString()
            })
        });
        return { ok: true };
    } catch (error) {
        console.warn('[AksesKota] Gagal menyimpan moderasi ke server:', error.message);
        return { ok: false, error: error.message };
    }
}

/**
 * Merge shared audits with this device's audits.
 * Remote wins on conflict (it carries the moderator's decision), while
 * local-only rows are kept so an offline submission is never lost.
 */
export function mergeAudits(localAudits = [], remoteAudits = []) {
    const merged = new Map();
    localAudits.forEach(a => { if (a?.id) merged.set(a.id, a); });
    remoteAudits.forEach(r => {
        const local = merged.get(r.id);
        merged.set(r.id, local ? { ...local, ...r, image: local.image ?? null } : r);
    });
    return [...merged.values()].sort(
        (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    );
}
