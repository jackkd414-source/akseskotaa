"""Snapshot refresh must enforce city geometry even when the server returns extras."""
import importlib.util
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

class CityRefreshTests(unittest.TestCase):
    def test_selected_area_query_and_point_filter(self):
        spec = importlib.util.spec_from_file_location('refresh_osm', ROOT / 'scripts' / 'refresh_osm.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(hasattr(module, 'prepare_snapshot'), 'Refresh has no geographic validation')
        boundaries = json.loads((ROOT / 'data' / 'city-boundaries.json').read_text(encoding='utf-8'))
        elements = [
            {'type':'node','id':1,'lat':-6.2245133,'lon':106.9798267,'tags':{'name':'Fixture Kranji','wheelchair':'yes'}},
            {'type':'node','id':2,'lat':-6.2618245,'lon':107.0837982,'tags':{'name':'Fixture Cibitung','wheelchair':'yes'}},
            {'type':'node','id':3,'lat':-6.2245133,'lon':106.9798267,'tags':{'highway':'elevator'}},
        ]
        source={'elements':elements + [elements[0]],'osm3s':{'timestamp_osm_base':'fixture timestamp'}}
        result = module.prepare_snapshot(source, boundaries, 'https://example.invalid/test')
        self.assertEqual([e['id'] for e in result['elements']], [1])
        self.assertEqual(result['elements'][0]['akseskota_city']['name'], 'Kota Bekasi')
        self.assertEqual(len(source['elements']),4,'Input evidence should not be mutated')
        self.assertEqual(result['akseskota_coverage']['scope_id'],boundaries['scope_id'])
        self.assertEqual(result['akseskota_coverage']['selection'],'administrative-city-polygons')
        query=module.build_query(boundaries)
        self.assertIn('map_to_area->.cities',query)
        self.assertIn('14509733',query)
        self.assertNotIn('14765575',query)
        for bad in [{'remark':'runtime timeout','elements':elements},{'elements':[]},{'elements':[elements[1]]}]:
            with self.assertRaises(ValueError):module.prepare_snapshot(bad,boundaries,'fixture')

if __name__=='__main__':unittest.main()
