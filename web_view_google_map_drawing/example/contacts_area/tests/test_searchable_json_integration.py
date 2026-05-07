# -*- coding: utf-8 -*-
"""
Integration tests for SearchableJson field using res.partner.area.

These tests require the contacts_area module to be installed (which provides
res.partner.area, a concrete model inheriting google.drawing.shape). They
verify that the custom JSON operators (json_eq, json_ne, json_contains,
json_not_contains) execute correct SQL against a real PostgreSQL JSONB column.

Unit tests for the field class, wrapper classes, and domain optimization live in:
  web_view_google_map_drawing/tests/test_field_json_searchable.py
"""
from odoo.tests.common import TransactionCase


class TestSearchableJsonIntegration(TransactionCase):
    """Integration tests for SearchableJson field with res.partner.area model."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.test_model = cls.env['res.partner.area']

    def test_create_and_search_feature_collection(self):
        """Test creating a record with FeatureCollection and searching for it."""
        feature_collection = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [106.45, -6.36]
                    },
                    "properties": {}
                }
            ]
        }

        record = self.test_model.create({
            'gshape_name': 'Test FeatureCollection',
            'gshape_geojson': feature_collection,
        })

        results = self.test_model.search([
            ('gshape_geojson', 'json_contains', {'type': 'FeatureCollection'})
        ])

        self.assertIn(record, results)

    def test_search_exact_match(self):
        """Test exact match search with json_eq operator."""
        simple_geojson = {
            "type": "Point",
            "coordinates": [106.45, -6.36]
        }

        record = self.test_model.create({
            'gshape_name': 'Test Point',
            'gshape_geojson': simple_geojson,
        })

        results = self.test_model.search([
            ('gshape_geojson', 'json_eq', simple_geojson)
        ])

        self.assertIn(record, results)

    def test_search_not_contains(self):
        """Test json_not_contains operator."""
        polygon_collection = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
                    },
                    "properties": {}
                }
            ]
        }

        record = self.test_model.create({
            'gshape_name': 'Test Polygon',
            'gshape_geojson': polygon_collection,
        })

        # Polygon record has no top-level type: Point, so it should be returned
        results = self.test_model.search([
            ('gshape_geojson', 'json_not_contains', {'type': 'Point'})
        ])

        self.assertIn(record, results)

    def test_complex_feature_collection_search(self):
        """Test searching within FeatureCollection with multiple features."""
        multi_feature = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [106.45, -6.36]},
                    "properties": {"name": "Point 1"}
                },
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [106.46, -6.37]},
                    "properties": {"name": "Point 2"}
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[106.45, -6.36], [106.46, -6.37]]
                    },
                    "properties": {"name": "Line 1"}
                }
            ]
        }

        record = self.test_model.create({
            'gshape_name': 'Multi-Feature Collection',
            'gshape_geojson': multi_feature,
        })

        results = self.test_model.search([
            ('gshape_geojson', 'json_contains', {'type': 'FeatureCollection'})
        ])

        self.assertIn(record, results)

    def test_multiple_records_filtering(self):
        """Test filtering across multiple records with different GeoJSON types."""
        point_record = self.test_model.create({
            'gshape_name': 'Simple Point',
            'gshape_geojson': {"type": "Point", "coordinates": [0, 0]},
        })

        polygon_record = self.test_model.create({
            'gshape_name': 'Simple Polygon',
            'gshape_geojson': {
                "type": "Polygon",
                "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
            },
        })

        collection_record = self.test_model.create({
            'gshape_name': 'Feature Collection',
            'gshape_geojson': {"type": "FeatureCollection", "features": []},
        })

        point_results = self.test_model.search([
            ('gshape_geojson', 'json_contains', {'type': 'Point'})
        ])
        self.assertIn(point_record, point_results)
        self.assertNotIn(collection_record, point_results)

        polygon_results = self.test_model.search([
            ('gshape_geojson', 'json_contains', {'type': 'Polygon'})
        ])
        self.assertIn(polygon_record, polygon_results)
        self.assertNotIn(point_record, polygon_results)

        collection_results = self.test_model.search([
            ('gshape_geojson', 'json_contains', {'type': 'FeatureCollection'})
        ])
        self.assertIn(collection_record, collection_results)
        self.assertNotIn(point_record, collection_results)

    def test_nested_structure_containment(self):
        """Test containment check with nested structures."""
        nested_geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [106.45, -6.36]},
                    "properties": {"category": "landmark"}
                }
            ]
        }

        record = self.test_model.create({
            'gshape_name': 'Nested Structure',
            'gshape_geojson': nested_geojson,
        })

        results = self.test_model.search([
            ('gshape_geojson', 'json_contains', {
                'features': [{'properties': {'category': 'landmark'}}]
            })
        ])

        self.assertIn(record, results)

    def test_json_ne_operator(self):
        """Test json_ne (not equal) operator."""
        point1 = self.test_model.create({
            'gshape_name': 'Point 1',
            'gshape_geojson': {"type": "Point", "coordinates": [0, 0]},
        })

        point2 = self.test_model.create({
            'gshape_name': 'Point 2',
            'gshape_geojson': {"type": "Point", "coordinates": [1, 1]},
        })

        results = self.test_model.search([
            ('gshape_geojson', 'json_ne', {"type": "Point", "coordinates": [0, 0]})
        ])

        self.assertNotIn(point1, results)
        self.assertIn(point2, results)
