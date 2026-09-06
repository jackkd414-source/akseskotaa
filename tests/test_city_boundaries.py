"""Boundary conversion tests use deliberately synthetic geometry, not place evidence."""
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class BoundaryConversionTests(unittest.TestCase):
    def test_joins_reversed_segments_without_inventing_bbox_polygon(self):
        script = ROOT / 'scripts' / 'city_boundaries.py'
        self.assertTrue(script.exists(), 'Missing administrative boundary converter')
        spec = importlib.util.spec_from_file_location('city_boundaries', script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        # Concave closed outline: [2, 1.5] is in the bbox but outside the polygon.
        segments = [ [[0,0],[3,0],[3,1]], [[0,0],[0,3],[1,3]], [[1,3],[1,1],[3,1]] ]
        rings = module.stitch_rings(segments)
        self.assertEqual(len(rings), 1)
        self.assertEqual(rings[0][0], rings[0][-1])
        feature = {'geometry': {'type':'MultiPolygon', 'coordinates':[[rings[0]]]}}
        self.assertTrue(module.contains(feature, 0.5, 0.5))
        self.assertFalse(module.contains(feature, 1.5, 2))
        self.assertTrue(module.contains(feature, 0, 1))  # outer boundary included
        with self.assertRaises(ValueError):
            module.stitch_rings([[[0,0],[1,1]]])

if __name__ == '__main__':
    unittest.main()
