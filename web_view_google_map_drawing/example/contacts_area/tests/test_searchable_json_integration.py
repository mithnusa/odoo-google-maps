# -*- coding: utf-8 -*-
"""
Integration tests for SearchableJson field using res.partner.area.

These tests require the contacts_area module to be installed. They
verify that the custom JSON operators (json_eq, json_ne, json_contains,
json_not_contains) and standard Odoo operators (=, !=) execute correct SQL
against a real PostgreSQL JSONB column.

Unit tests for the field class, wrapper classes, and domain optimization live in:
  web_view_google_map_drawing/tests/test_field_json_searchable.py
"""

import unittest

from odoo.tests.common import TransactionCase

POINT = {"type": "Point", "coordinates": [106.45, -6.36]}
POINT_OTHER = {"type": "Point", "coordinates": [1.0, 1.0]}
POLYGON = {
    "type": "Polygon",
    "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
}
FEATURE_COLLECTION_EMPTY = {"type": "FeatureCollection", "features": []}
FEATURE_COLLECTION_POINT = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": POINT,
            "properties": {},
        }
    ],
}


class TestSearchableJsonIntegration(TransactionCase):
    """Integration tests for SearchableJson field with res.partner.area model."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        if "res.partner.area" not in cls.env:
            raise unittest.SkipTest("contacts_area module is not installed")
        cls.Model = cls.env["res.partner.area"]

    def _create(self, name, geojson):
        return self.Model.create(
            {"gshape_name": name, "gshape_geojson": geojson}
        )

    def _search(self, extra_ids, *domain_parts):
        """Search restricted to the given record IDs to avoid pre-existing data."""
        return self.Model.search(
            [("id", "in", extra_ids)] + list(domain_parts)
        )

    # -------------------------------------------------------------------------
    # Standard Odoo operators: = False / != False (NULL handling)
    # -------------------------------------------------------------------------

    def test_eq_false_finds_null_records(self):
        """('gshape_geojson', '=', False) must return records where geojson IS NULL."""
        null_rec = self._create("Null GeoJSON", False)
        has_value = self._create("Has GeoJSON", POINT)
        ids = [null_rec.id, has_value.id]

        results = self._search(ids, ("gshape_geojson", "=", False))

        self.assertIn(null_rec, results)
        self.assertNotIn(has_value, results)

    def test_ne_false_excludes_null_records(self):
        """('gshape_geojson', '!=', False) must exclude records where geojson IS NULL."""
        null_rec = self._create("Null GeoJSON", False)
        has_value = self._create("Has GeoJSON", POINT)
        ids = [null_rec.id, has_value.id]

        results = self._search(ids, ("gshape_geojson", "!=", False))

        self.assertNotIn(null_rec, results)
        self.assertIn(has_value, results)

    # -------------------------------------------------------------------------
    # json_eq / json_ne
    # -------------------------------------------------------------------------

    def test_json_eq_finds_exact_match(self):
        """json_eq returns only records whose geojson equals the given value."""
        rec = self._create("Point A", POINT)
        other = self._create("Point B", POINT_OTHER)
        ids = [rec.id, other.id]

        results = self._search(ids, ("gshape_geojson", "json_eq", POINT))

        self.assertIn(rec, results)
        self.assertNotIn(other, results)

    def test_json_ne_excludes_matching_record(self):
        """json_ne excludes the exact match but includes different values."""
        rec = self._create("Point A", POINT)
        other = self._create("Point B", POINT_OTHER)
        ids = [rec.id, other.id]

        results = self._search(ids, ("gshape_geojson", "json_ne", POINT))

        self.assertNotIn(rec, results)
        self.assertIn(other, results)

    def test_json_ne_includes_null_records(self):
        """json_ne must include records with NULL geojson.

        PostgreSQL evaluates NULL != value as NULL (not TRUE), so without an
        explicit IS NULL guard these rows would be silently excluded.
        """
        null_rec = self._create("No GeoJSON", False)
        ids = [null_rec.id]

        results = self._search(ids, ("gshape_geojson", "json_ne", POINT))

        self.assertIn(null_rec, results)

    # -------------------------------------------------------------------------
    # json_contains / json_not_contains
    # -------------------------------------------------------------------------

    def test_json_contains_finds_matching_record(self):
        """json_contains returns records where the field contains the sub-object."""
        rec = self._create("Feature Collection", FEATURE_COLLECTION_POINT)
        other = self._create("Polygon", POLYGON)
        ids = [rec.id, other.id]

        results = self._search(
            ids,
            ("gshape_geojson", "json_contains", {"type": "FeatureCollection"}),
        )

        self.assertIn(rec, results)
        self.assertNotIn(other, results)

    def test_json_not_contains_excludes_matching_record(self):
        """json_not_contains excludes records that do contain the sub-object."""
        rec = self._create("Feature Collection", FEATURE_COLLECTION_POINT)
        other = self._create("Polygon", POLYGON)
        ids = [rec.id, other.id]

        results = self._search(
            ids,
            (
                "gshape_geojson",
                "json_not_contains",
                {"type": "FeatureCollection"},
            ),
        )

        self.assertNotIn(rec, results)
        self.assertIn(other, results)

    def test_json_not_contains_includes_null_records(self):
        """json_not_contains must include records with NULL geojson.

        PostgreSQL evaluates NULL @> value as NULL (not FALSE), so without an
        explicit IS NULL guard these rows would be silently excluded.
        """
        null_rec = self._create("No GeoJSON", False)
        ids = [null_rec.id]

        results = self._search(
            ids, ("gshape_geojson", "json_not_contains", {"type": "Point"})
        )

        self.assertIn(null_rec, results)

    def test_json_contains_nested_structure(self):
        """json_contains works for nested JSON sub-objects."""
        nested = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [106.45, -6.36],
                    },
                    "properties": {"category": "landmark"},
                }
            ],
        }
        rec = self._create("Nested", nested)
        ids = [rec.id]

        results = self._search(
            ids,
            (
                "gshape_geojson",
                "json_contains",
                {"features": [{"properties": {"category": "landmark"}}]},
            ),
        )

        self.assertIn(rec, results)

    # -------------------------------------------------------------------------
    # Multi-record filtering
    # -------------------------------------------------------------------------

    def test_multiple_records_filtered_by_type(self):
        """Each json_contains query returns only the records with the matching type."""
        point_rec = self._create("Point", POINT)
        polygon_rec = self._create("Polygon", POLYGON)
        collection_rec = self._create("Collection", FEATURE_COLLECTION_EMPTY)
        ids = [point_rec.id, polygon_rec.id, collection_rec.id]

        point_results = self._search(
            ids, ("gshape_geojson", "json_contains", {"type": "Point"})
        )
        self.assertEqual(point_results, point_rec)

        polygon_results = self._search(
            ids, ("gshape_geojson", "json_contains", {"type": "Polygon"})
        )
        self.assertEqual(polygon_results, polygon_rec)

        collection_results = self._search(
            ids,
            ("gshape_geojson", "json_contains", {"type": "FeatureCollection"}),
        )
        self.assertEqual(collection_results, collection_rec)

    # -------------------------------------------------------------------------
    # Edge cases
    # -------------------------------------------------------------------------

    def test_json_eq_key_order_independent(self):
        """json_eq must match regardless of JSON key insertion order.

        _equality_sql uses ::jsonb cast on both sides; PostgreSQL normalizes key
        order inside JSONB, so {'b': 2, 'a': 1} must equal {'a': 1, 'b': 2}.
        """
        stored = {"coordinates": [106.45, -6.36], "type": "Point"}
        rec = self._create("Reversed Keys", stored)
        ids = [rec.id]

        results = self._search(ids, ("gshape_geojson", "json_eq", POINT))

        self.assertIn(rec, results)

    def test_json_eq_false_does_not_find_null_records(self):
        """json_eq False finds rows storing JSON boolean false, NOT NULL rows.

        ('field', '=', False) maps to IS NULL.
        ('field', 'json_eq', False) maps to field::jsonb = 'false'::jsonb.
        These are semantically different — this test documents and protects that boundary.
        """
        null_rec = self._create("Null GeoJSON", False)
        ids = [null_rec.id]

        results = self._search(ids, ("gshape_geojson", "json_eq", False))

        self.assertNotIn(null_rec, results)

    def test_json_contains_empty_dict_matches_all_non_null(self):
        """json_contains with {} matches every non-NULL row (JSONB containment of empty object).

        In PostgreSQL, any_jsonb @> '{}'::jsonb is TRUE for all non-NULL values.
        """
        rec = self._create("Point", POINT)
        null_rec = self._create("Null GeoJSON", False)
        ids = [rec.id, null_rec.id]

        results = self._search(ids, ("gshape_geojson", "json_contains", {}))

        self.assertIn(rec, results)
        self.assertNotIn(null_rec, results)
