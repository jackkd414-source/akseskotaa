"""Refresh OSM locations in the five Jakarta cities and Kota Bekasi only.
Run from project root: python scripts/refresh_osm.py
Uses actual administrative relations plus a point-in-polygon guard. No field
verification is implied. Failed/partial/empty responses preserve the snapshot.
"""
import copy
import json
import pathlib
import urllib.parse
import urllib.request

from city_boundaries import CITY_NAMES, SCOPE_ID, city_for_point

ROOT = pathlib.Path(__file__).resolve().parents[1]
SELECTORS = ['["ramp"="wheelchair"]', '["ramp:wheelchair"="yes"]',
             '["highway"="ramp"]["wheelchair"="yes"]',
             '["amenity"="toilets"]["wheelchair"="yes"]',
             '["toilets:wheelchair"="yes"]', '["tactile_paving"="yes"]',
             '["wheelchair"~"^(yes|designated)$"]']
ENDPOINTS = ['https://overpass-api.de/api/interpreter',
             'https://overpass.kumi.systems/api/interpreter',
             'https://overpass.private.coffee/api/interpreter']


def validate_scope(boundaries):
    features = boundaries.get('features', [])
    if boundaries.get('scope_id') != SCOPE_ID or len(features) != len(CITY_NAMES) or {f['properties']['relation_id'] for f in features} != set(CITY_NAMES):
        raise ValueError('Incomplete selected-city boundary file')
    return boundaries


def build_query(boundaries):
    validate_scope(boundaries)
    ids = ','.join(str(f['properties']['relation_id']) for f in boundaries['features'])
    return '[out:json][timeout:90];relation(id:' + ids + ');map_to_area->.cities;(' + ''.join('nwr' + selector + '(area.cities);' for selector in SELECTORS) + ');out center tags;'


def prepare_snapshot(data, boundaries, endpoint):
    validate_scope(boundaries)
    if data.get('remark') or not isinstance(data.get('elements'), list):
        raise ValueError('Partial or invalid Overpass response; existing snapshot preserved')
    if not data['elements']:
        raise ValueError('Empty response; existing snapshot preserved')
    unique = {}
    counts = {}
    for element in data['elements']:
        tags = element.get('tags', {})
        if tags.get('highway') == 'elevator' or tags.get('elevator') in ('yes', 'designated'):
            continue
        if element.get('type') not in ('node', 'way', 'relation') or not isinstance(element.get('id'), int):
            raise ValueError('Invalid OSM identity in response')
        position = element if 'lat' in element else element.get('center', {})
        city = city_for_point(boundaries, position.get('lat'), position.get('lon'))
        if not city:
            continue
        row = copy.deepcopy(element)
        row['akseskota_city'] = {'name': city['name'], 'relation_id': city['relation_id']}
        unique[(element['type'], element['id'])] = row
    if not unique:
        raise ValueError('No supported locations inside selected cities; existing snapshot preserved')
    for row in unique.values():
        name = row['akseskota_city']['name']
        counts[name] = counts.get(name, 0) + 1
    result = copy.deepcopy(data)
    result['elements'] = list(unique.values())
    result['akseskota_coverage'] = {
        'scope_id': SCOPE_ID,
        'selection': 'administrative-city-polygons',
        'description': boundaries['description'],
        'city_relations': [{'name': f['properties']['name'], 'relation_id': f['properties']['relation_id']} for f in boundaries['features']],
        'boundary_timestamp': boundaries.get('source_timestamp'),
        'position_rule': 'OSM node coordinates; center coordinate for ways/relations. No city inference from names or address strings.',
        'excluded_categories': ['elevator'],
        'counts_by_city': counts,
        'query': build_query(boundaries),
        'endpoint': endpoint,
    }
    return result


def main():
    boundaries = json.loads((ROOT / 'data' / 'city-boundaries.json').read_text(encoding='utf-8'))
    query = build_query(boundaries)
    errors = []
    for endpoint in ENDPOINTS:
        try:
            request = urllib.request.Request(endpoint + '?data=' + urllib.parse.quote(query), headers={'Accept': 'application/json', 'User-Agent': 'AksesKota/1.0 city-scoped snapshot refresh'})
            with urllib.request.urlopen(request, timeout=120) as response:
                data = json.load(response)
            snapshot = prepare_snapshot(data, boundaries, endpoint)
            output = ROOT / 'data' / 'osm-snapshot.json'
            pending = output.with_suffix('.pending.json')
            pending.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            pending.replace(output)
            print(json.dumps({'endpoint': endpoint, 'locations': len(snapshot['elements']), 'bytes': output.stat().st_size, 'timestamp': snapshot.get('osm3s', {}).get('timestamp_osm_base'), 'cities': snapshot['akseskota_coverage']['counts_by_city']}))
            return
        except Exception as exc:
            errors.append(str(exc))
            print(endpoint, str(exc), flush=True)
    raise SystemExit('All providers failed; existing snapshot preserved. ' + str(errors))


if __name__ == '__main__':
    main()
