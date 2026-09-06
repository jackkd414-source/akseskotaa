import { getAccessibleRoute } from './accessible-routing.js';

const CAVEAT = 'Kondisi jalur belum terverifikasi.';

// Local metric projection measures distance to segments, not just route vertices.
function distanceToPolyline(point, coordinates) {
  const radians = Math.PI / 180;
  const scale = 6371008.8 * radians;
  const project = ([lat, lng]) => [(lng - point[1]) * scale * Math.cos(point[0] * radians), (lat - point[0]) * scale];
  let nearest = Infinity;
  for (let i = 1; i < coordinates.length; i++) {
    const [ax, ay] = project(coordinates[i - 1]);
    const [bx, by] = project(coordinates[i]);
    const dx = bx - ax, dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    nearest = Math.min(nearest, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return nearest;
}

function matchCount(venue, preferences) {
  return preferences.filter(preference => preference === 'business'
    ? venue.isBusiness === true
    : venue.category === preference || venue.attributes?.[preference] === true).length;
}

/** Rencana rute per jenis fasilitas: satu rute sendiri utk SETIAP preferensi yang dicentang.
 *  (Rampa, jalur taktil, toilet, usaha — masing-masing punya rute singgahnya sendiri.)
 *  Coordinates are [lat, lng]; the injected router receives venue objects in via.
 *  Facility proximity is only a routing heuristic, never an accessibility guarantee. */
export const FACILITY_LABELS = {
  wheelchair_ramp: 'Rampa',
  tactile_paving: 'Jalur taktil',
  accessible_restroom: 'Toilet aksesibel',
  business: 'Usaha'
};

function matchesPreference(venue, preference) {
  return preference === 'business'
    ? venue.isBusiness === true
    : venue.category === preference || venue.attributes?.[preference] === true;
}

export async function planFacilityRoutes({ origin, destination, profile = 'wheelchair', venues = [], preferences = [], maxDetourRatio = 0.25, router = getAccessibleRoute }) {
  const direct = await router(origin, destination, profile, { via: [] });
  const endpoint = [destination.lat, destination.lng];
  const requested = [...new Set(preferences)].filter(p => FACILITY_LABELS[p]);
  const options = [];
  const notes = [];
  for (const preference of requested) {
    const label = FACILITY_LABELS[preference];
    const matched = venues
      .filter(v => matchesPreference(v, preference))
      .map(v => ({ venue: v, near: distanceToPolyline([v.lat, v.lng], direct.coordinates) }))
      .filter(({ venue }) => distanceToPolyline([venue.lat, venue.lng], [origin, origin]) > 30
        && distanceToPolyline([venue.lat, venue.lng], [endpoint, endpoint]) > 30);
    const onRoute = matched.some(({ near }) => near <= 30);
    const candidates = matched
      .filter(({ near }) => near > 30 && near <= 250)
      .sort((a, b) => a.near - b.near)
      .slice(0, 3);
    let found = null, tooFar = false;
    for (const { venue } of candidates) {
      if (options.some(o => o.venue.id === venue.id)) continue;
      try {
        const route = await router(origin, destination, profile, { via: [venue] });
        if (Number.isFinite(route.distanceKm)
          && route.distanceKm <= direct.distanceKm * (1 + maxDetourRatio)
          && distanceToPolyline([venue.lat, venue.lng], route.coordinates) <= 60) {
          found = { preference, label, venue, route };
          break; // satu rute per jenis fasilitas
        }
        tooFar = true;
      } catch { /* kandidat gagal → coba berikutnya */ }
    }
    if (found) options.push(found);
    else if (onRoute) notes.push({ preference, label, status: 'onroute' });
    else if (tooFar || candidates.length) notes.push({ preference, label, status: 'far' });
    else notes.push({ preference, label, status: 'none' });
  }
  const reason = options.length
    ? `${options.length} rute fasilitas tersedia sesuai pilihanmu. ${CAVEAT}`
    : `Tidak ada fasilitas pilihan yang memenuhi syarat di sekitar rute. ${CAVEAT}`;
  return { direct, options, notes, reason };
}

/** @deprecated dipertahankan utk kompatibilitas; pakai planFacilityRoutes. */
export async function planFacilityRoute({ origin, destination, profile = 'wheelchair', venues = [], preferences = [], maxDetourRatio = 0.25, router = getAccessibleRoute }) {
  // Deliberately outside the optional-alternative catch: baseline errors propagate.
  const direct = await router(origin, destination, profile, { via: [] });
  const requested = [...new Set(preferences)];
  const endpoint = [destination.lat, destination.lng];
  const candidates = venues.map(venue => ({ venue, matches: matchCount(venue, requested) }))
    .filter(({ venue, matches }) => {
      const point = [venue.lat, venue.lng];
      return matches > 0
        && distanceToPolyline(point, direct.coordinates) <= 250
        && distanceToPolyline(point, [origin, origin]) > 30
        && distanceToPolyline(point, [endpoint, endpoint]) > 30;
    })
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 2);

  let best = null;
  for (const candidate of candidates) {
    try {
      const alternative = await router(origin, destination, profile, { via: [candidate.venue] });
      if (Number.isFinite(alternative.distanceKm) && alternative.distanceKm >= 0
        && alternative.distanceKm <= direct.distanceKm * (1 + maxDetourRatio)
        && distanceToPolyline([candidate.venue.lat, candidate.venue.lng], alternative.coordinates) <= 60
        && (!best || candidate.matches > best.matches
          || (candidate.matches === best.matches && alternative.distanceKm < best.route.distanceKm))) {
        best = { ...candidate, route: alternative };
      }
    } catch {
      // A failed optional waypoint must not discard a usable direct route.
    }
  }
  if (best) {
    const facilities = [best.venue];
    return { direct, preferred: { ...best.route, facilities }, facilities, reason: `Ada rute singgah fasilitas pilihan. ${CAVEAT}` };
  }
  const reason = candidates.length
    ? 'Alternatif singgah melebihi batas jarak. Dipakai rute langsung.'
    : 'Tidak ada fasilitas pilihan di sekitar rute. Dipakai rute langsung.';
  return { direct, preferred: null, facilities: [], reason: `${reason} ${CAVEAT}` };
}
