"""Build exact OSM city polygons from downloaded relation members (stdlib only).
Source: reports/city-scope/boundaries-source.json (out body geom).
No guessed rectangles or geometry simplification. Never changes user records.
"""
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
CITY_NAMES = {
    5802438: 'Jakarta Selatan',
    5802441: 'Jakarta Timur',
    7625977: 'Jakarta Pusat',
    7626001: 'Jakarta Barat',
    7626002: 'Jakarta Utara',
    14509733: 'Kota Bekasi',
}
SCOPE_ID = 'jakarta-mainland-bekasi-city-v1'


def stitch_rings(segments):
    """Join OSM way segments by their actual endpoints; refuse open chains."""
    pending = []
    for segment in segments:
        clean = []
        for point in segment:
            if len(point) != 2 or not all(math.isfinite(n) for n in point):
                raise ValueError('Invalid boundary coordinate')
            point = list(point)
            if not clean or point != clean[-1]:
                clean.append(point)
        if len(clean) < 2:
            raise ValueError('Boundary segment has fewer than two points')
        pending.append(clean)
    rings = []
    while pending:
        ring = pending.pop(0)
        while ring[-1] != ring[0]:
            for i, segment in enumerate(pending):
                if ring[-1] == segment[0]:
                    ring.extend(segment[1:])
                    pending.pop(i)
                    break
                if ring[-1] == segment[-1]:
                    ring.extend(list(reversed(segment))[1:])
                    pending.pop(i)
                    break
            else:
                raise ValueError(f'Unclosed administrative boundary at {ring[-1]}')
        if len(ring) < 4:
            raise ValueError('Degenerate administrative ring')
        rings.append(ring)
    return rings


def in_ring(point, ring):
    """Ray casting. Treat a point on a ring as inside (tiny numeric epsilon)."""
    x, y = point
    inside = False
    for a, b in zip(ring, ring[1:]):
        ax, ay = a
        bx, by = b
        cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
        if abs(cross) <= 1e-12 and min(ax, bx) - 1e-12 <= x <= max(ax, bx) + 1e-12 and min(ay, by) - 1e-12 <= y <= max(ay, by) + 1e-12:
            return True
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            inside = not inside
    return inside


def contains(feature, lat, lon):
    if not isinstance(lat, (float, int)) or not isinstance(lon, (float, int)) or not math.isfinite(lat) or not math.isfinite(lon):
        return False
    point = [lon, lat]
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    return any(in_ring(point, polygon[0]) and not any(in_ring(point, hole) for hole in polygon[1:]) for polygon in polygons)


def city_for_point(boundaries, lat, lon):
    for feature in boundaries['features']:
        bounds = feature['bbox']
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and bounds[0] <= lon <= bounds[2] and bounds[1] <= lat <= bounds[3] and contains(feature, lat, lon):
            return feature['properties']
    return None


def build_boundaries(source, provenance):
    relations = source.get('elements', [])
    if source.get('remark') or {e.get('id') for e in relations} != set(CITY_NAMES):
        raise ValueError('Expected complete geometry for exactly the six selected city relations')
    features = []
    for relation in relations:
        if relation.get('tags', {}).get('admin_level') != '5':
            raise ValueError('City relation has an unexpected administrative level')
        members = relation.get('members', [])
        rings = {}
        for role in ('outer', 'inner'):
            segments = []
            for member in members:
                if member.get('role') != role:
                    continue
                if member.get('type') != 'way' or not member.get('geometry'):
                    raise ValueError('Boundary member is missing geometry')
                segments.append([[p['lon'], p['lat']] for p in member['geometry']])
            rings[role] = stitch_rings(segments)
        if not rings['outer']:
            raise ValueError('City boundary has no outer polygon')
        polygons = [[ring] for ring in rings['outer']]
        for hole in rings['inner']:
            containers = [poly for poly in polygons if in_ring(hole[0], poly[0])]
            if len(containers) != 1:
                raise ValueError('Cannot unambiguously assign boundary hole')
            containers[0].append(hole)
        points = [point for ring in rings['outer'] for point in ring]
        identifier = relation['id']
        features.append({
            'type': 'Feature',
            'properties': {'relation_id': identifier, 'name': CITY_NAMES[identifier], 'osm_name': relation['tags']['name'], 'admin_level': '5', 'source_url': f'https://www.openstreetmap.org/relation/{identifier}'},
            'bbox': [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)],
            'geometry': {'type': 'MultiPolygon', 'coordinates': polygons},
        })
    return {'type': 'FeatureCollection', 'scope_id': SCOPE_ID, 'description': 'Lima kota administratif Jakarta dan Kota Bekasi; tidak termasuk Kepulauan Seribu, Kabupaten Bekasi, atau kota tetangga.', 'source': 'OpenStreetMap via Overpass', 'license': 'ODbL-1.0', 'source_timestamp': source.get('osm3s', {}).get('timestamp_osm_base'), 'source_url': provenance['url'], 'features': features}


def main():
    folder = ROOT / 'reports' / 'city-scope'
    source = json.loads((folder / 'boundaries-source.json').read_text(encoding='utf-8'))
    provenance = json.loads((folder / 'boundaries-provenance.json').read_text(encoding='utf-8'))
    result = build_boundaries(source, provenance)
    output = ROOT / 'data' / 'city-boundaries.json'
    pending = output.with_suffix('.pending.json')
    pending.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    pending.replace(output)
    print(json.dumps({'scope': SCOPE_ID, 'cities': [f['properties']['name'] for f in result['features']], 'rings': sum(len(f['geometry']['coordinates']) for f in result['features']), 'bytes': output.stat().st_size}))

if __name__ == '__main__':
    main()
