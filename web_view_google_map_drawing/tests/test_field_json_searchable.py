# -*- coding: utf-8 -*-
"""
Test suite for SearchableJson field with custom JSON operators.

This module tests the custom JSON field implementation including:
- JsonValue wrapper class for hashable JSON values (json_eq, json_ne)
- JsonContainsValue wrapper class for containment checks (json_contains, json_not_contains)
- Custom operators: json_eq, json_ne, json_contains, json_not_contains
- Domain optimization functionality (conversion to standard 'in'/'not in' operators)
- SQL generation for PostgreSQL JSONB operations (@> operator)
- Error handling for edge cases

Test Structure:
1. TestJsonValue - Tests for JsonValue wrapper class
2. TestJsonContainsValue - Tests for JsonContainsValue wrapper class
3. TestDomainOptimization - Tests for domain optimization functions
4. TestSearchableJsonField - Tests for SQL generation
5. TestEdgeCases - Edge cases and error handling

Integration tests (end-to-end ORM search against a real JSONB column) live in:
  web_view_google_map_drawing/example/contacts_area/tests/test_searchable_json_integration.py
They require the contacts_area module to be installed.
"""
from unittest.mock import Mock

from odoo.tests.common import TransactionCase
from odoo.tools import SQL
from odoo.orm.domains import DomainCondition
from odoo.tools.misc import OrderedSet

from ..models.fields import SearchableJson, JsonValue, JsonContainsValue, _json_equal_optimization, _json_contains_optimization


class TestJsonValue(TransactionCase):
    """Test suite for JsonValue wrapper class."""

    def test_json_value_basic_creation(self):
        """Test basic JsonValue creation with dict."""
        value = {"type": "Point", "coordinates": [0, 0]}
        json_val = JsonValue(value)

        self.assertEqual(json_val.value, value)
        self.assertIsInstance(json_val, JsonValue)
        self.assertIsInstance(json_val._hash, int)

    def test_json_value_hash_consistency(self):
        """Test that identical JSON structures produce the same hash."""
        val1 = JsonValue({"type": "Point", "coordinates": [0, 0]})
        val2 = JsonValue({"type": "Point", "coordinates": [0, 0]})

        self.assertEqual(hash(val1), hash(val2))

    def test_json_value_hash_key_order_independence(self):
        """Test that different key ordering produces the same hash."""
        val1 = JsonValue({"type": "Point", "coordinates": [0, 0]})
        val2 = JsonValue({"coordinates": [0, 0], "type": "Point"})

        self.assertEqual(hash(val1), hash(val2))

    def test_json_value_equality(self):
        """Test JsonValue equality comparison."""
        val1 = JsonValue({"type": "Point"})
        val2 = JsonValue({"type": "Point"})
        val3 = JsonValue({"type": "Polygon"})

        self.assertEqual(val1, val2)
        self.assertNotEqual(val1, val3)

    def test_json_value_equality_with_non_json_value(self):
        """Test that JsonValue is not equal to non-JsonValue objects."""
        val1 = JsonValue({"type": "Point"})

        self.assertNotEqual(val1, {"type": "Point"})
        self.assertNotEqual(val1, "test")
        self.assertNotEqual(val1, None)

    def test_json_value_in_set(self):
        """Test that JsonValue can be used in sets."""
        val1 = JsonValue({"type": "Point"})
        val2 = JsonValue({"type": "Point"})
        val3 = JsonValue({"type": "Polygon"})

        value_set = {val1, val2, val3}
        # Should only have 2 elements (val1 and val2 are equal)
        self.assertEqual(len(value_set), 2)

    def test_json_value_with_list(self):
        """Test JsonValue with list values."""
        val1 = JsonValue([1, 2, 3])
        val2 = JsonValue([1, 2, 3])

        self.assertEqual(val1, val2)
        self.assertEqual(hash(val1), hash(val2))

    def test_json_value_with_nested_structure(self):
        """Test JsonValue with complex nested structures."""
        complex_value = {
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[0, 0], [1, 1], [0, 1], [0, 0]]]
            },
            "properties": {"name": "Test"}
        }
        val1 = JsonValue(complex_value)
        val2 = JsonValue(complex_value.copy())

        self.assertEqual(val1, val2)
        self.assertEqual(hash(val1), hash(val2))

    def test_json_value_error_on_non_serializable(self):
        """Test that JsonValue raises error for non-serializable values."""
        # datetime objects are not JSON serializable
        from datetime import datetime

        with self.assertRaises(ValueError) as context:
            JsonValue({"date": datetime.now()})

        self.assertIn("Cannot create JsonValue", str(context.exception))


class TestJsonContainsValue(TransactionCase):
    """Test suite for JsonContainsValue wrapper class."""

    def test_json_contains_value_basic_creation(self):
        """Test basic JsonContainsValue creation with dict."""
        value = {"type": "Point", "coordinates": [0, 0]}
        json_val = JsonContainsValue(value)

        self.assertEqual(json_val.value, value)
        self.assertIsInstance(json_val, JsonContainsValue)
        self.assertIsInstance(json_val._hash, int)

    def test_json_contains_value_hash_consistency(self):
        """Test that identical JSON structures produce the same hash."""
        val1 = JsonContainsValue({"type": "Point", "coordinates": [0, 0]})
        val2 = JsonContainsValue({"type": "Point", "coordinates": [0, 0]})

        self.assertEqual(hash(val1), hash(val2))

    def test_json_contains_value_equality(self):
        """Test JsonContainsValue equality comparison."""
        val1 = JsonContainsValue({"type": "Point"})
        val2 = JsonContainsValue({"type": "Point"})
        val3 = JsonContainsValue({"type": "Polygon"})

        self.assertEqual(val1, val2)
        self.assertNotEqual(val1, val3)

    def test_json_contains_value_in_set(self):
        """Test that JsonContainsValue can be used in sets."""
        val1 = JsonContainsValue({"type": "Point"})
        val2 = JsonContainsValue({"type": "Point"})
        val3 = JsonContainsValue({"type": "Polygon"})

        value_set = {val1, val2, val3}
        # Should only have 2 elements (val1 and val2 are equal)
        self.assertEqual(len(value_set), 2)


class TestDomainOptimization(TransactionCase):
    """Test suite for domain optimization functions."""

    def test_json_eq_optimization(self):
        """Test json_eq operator optimization to 'in' operator."""
        condition = DomainCondition('geojson', 'json_eq', {'type': 'Point'})
        mock_model = Mock()

        result = _json_equal_optimization(condition, mock_model)

        self.assertEqual(result.operator, 'in')
        self.assertIsInstance(result.value, OrderedSet)
        self.assertEqual(len(result.value), 1)

        # Check that value is wrapped in JsonValue
        wrapped_value = list(result.value)[0]
        self.assertIsInstance(wrapped_value, JsonValue)
        self.assertEqual(wrapped_value.value, {'type': 'Point'})

    def test_json_ne_optimization(self):
        """Test json_ne operator optimization to 'not in' operator."""
        condition = DomainCondition('geojson', 'json_ne', {'type': 'Point'})
        mock_model = Mock()

        result = _json_equal_optimization(condition, mock_model)

        self.assertEqual(result.operator, 'not in')
        self.assertIsInstance(result.value, OrderedSet)

    def test_json_contains_optimization(self):
        """Test json_contains operator optimization to 'in' operator with JsonContainsValue wrapper."""
        condition = DomainCondition('geojson', 'json_contains', {'type': 'Point'})
        mock_model = Mock()

        result = _json_contains_optimization(condition, mock_model)

        self.assertEqual(result.operator, 'in')
        self.assertIsInstance(result.value, OrderedSet)
        self.assertEqual(len(result.value), 1)

        # Check that value is wrapped in JsonContainsValue
        wrapped_value = list(result.value)[0]
        self.assertIsInstance(wrapped_value, JsonContainsValue)
        self.assertEqual(wrapped_value.value, {'type': 'Point'})

    def test_json_not_contains_optimization(self):
        """Test json_not_contains operator optimization to 'not in' operator with JsonContainsValue wrapper."""
        condition = DomainCondition('geojson', 'json_not_contains', {'type': 'Point'})
        mock_model = Mock()

        result = _json_contains_optimization(condition, mock_model)

        self.assertEqual(result.operator, 'not in')
        self.assertIsInstance(result.value, OrderedSet)
        self.assertEqual(len(result.value), 1)

        # Check that value is wrapped in JsonContainsValue
        wrapped_value = list(result.value)[0]
        self.assertIsInstance(wrapped_value, JsonContainsValue)
        self.assertEqual(wrapped_value.value, {'type': 'Point'})


class TestSearchableJsonField(TransactionCase):
    """Test suite for SearchableJson field SQL generation."""

    def setUp(self):
        super().setUp()
        self.field = SearchableJson()
        self.mock_model = Mock()
        self.mock_model._field_to_sql = Mock(return_value=SQL("test_table.geojson"))
        self.mock_query = Mock()

    def test_json_eq_sql_generation_with_wrapped_value(self):
        """Test SQL generation for 'in' operator with wrapped JsonValue."""
        wrapped_value = JsonValue({'type': 'Point'})
        values = OrderedSet([wrapped_value])

        result = self.field._condition_to_sql(
            'geojson', 'in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)
        # Check that SQL contains the field and JSON value
        sql_str = str(result)
        self.assertIn('test_table.geojson', sql_str)

    def test_json_ne_sql_generation_with_wrapped_value(self):
        """Test SQL generation for 'not in' operator with wrapped JsonValue."""
        wrapped_value = JsonValue({'type': 'Point'})
        values = OrderedSet([wrapped_value])

        result = self.field._condition_to_sql(
            'geojson', 'not in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)
        sql_str = str(result)
        self.assertIn('test_table.geojson', sql_str)
        # NULL rows must be included in negation results (NULL != value = NULL, not TRUE)
        self.assertIn('IS NULL', sql_str)

    def test_json_contains_sql_generation(self):
        """Test SQL generation for 'in' operator with JsonContainsValue wrapper."""
        wrapped_value = JsonContainsValue({'type': 'Point'})
        values = OrderedSet([wrapped_value])

        result = self.field._condition_to_sql(
            'geojson', 'in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)
        sql_str = str(result)
        self.assertIn('@>', sql_str)
        self.assertIn('::jsonb', sql_str)

    def test_json_not_contains_sql_generation(self):
        """Test SQL generation for 'not in' operator with JsonContainsValue wrapper."""
        wrapped_value = JsonContainsValue({'type': 'Point'})
        values = OrderedSet([wrapped_value])

        result = self.field._condition_to_sql(
            'geojson', 'not in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)
        sql_str = str(result)
        self.assertIn('NOT', sql_str)
        self.assertIn('@>', sql_str)
        self.assertIn('::jsonb', sql_str)
        # NULL rows must be included: NULL @> value = NULL, not FALSE
        self.assertIn('IS NULL', sql_str)

    def test_regular_value_not_in_includes_null_check(self):
        """Test that 'not in' with a plain (non-wrapped) value generates an IS NULL guard."""
        values = OrderedSet(['test_string'])

        result = self.field._condition_to_sql(
            'geojson', 'not in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)
        sql_str = str(result)
        # NULL rows must be included: NULL != value = NULL, not TRUE
        self.assertIn('IS NULL', sql_str)

    def test_empty_in_operator_returns_false(self):
        """Test that empty 'in' operator returns SQL FALSE."""
        values = OrderedSet()

        result = self.field._condition_to_sql(
            'geojson', 'in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)
        sql_str = str(result)
        # SQL object's __str__() wraps the SQL in "SQL('...')"
        self.assertIn('FALSE', sql_str)

    def test_empty_not_in_operator_returns_true(self):
        """Test that empty 'not in' operator returns SQL TRUE."""
        values = OrderedSet()

        result = self.field._condition_to_sql(
            'geojson', 'not in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)
        sql_str = str(result)
        # SQL object's __str__() wraps the SQL in "SQL('...')"
        self.assertIn('TRUE', sql_str)

    def test_multiple_values_in_operator(self):
        """Test SQL generation for 'in' with multiple values."""
        val1 = JsonValue({'type': 'Point'})
        val2 = JsonValue({'type': 'Polygon'})
        values = OrderedSet([val1, val2])

        result = self.field._condition_to_sql(
            'geojson', 'in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)
        sql_str = str(result)
        # Should contain OR for multiple conditions
        self.assertIn('OR', sql_str)

    def test_multiple_values_not_in_operator(self):
        """Test SQL generation for 'not in' with multiple values."""
        val1 = JsonValue({'type': 'Point'})
        val2 = JsonValue({'type': 'Polygon'})
        values = OrderedSet([val1, val2])

        result = self.field._condition_to_sql(
            'geojson', 'not in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)
        sql_str = str(result)
        # Should contain AND for multiple conditions
        self.assertIn('AND', sql_str)

    def test_error_handling_for_non_serializable_in_sql(self):
        """Test that non-serializable values raise proper error in SQL generation."""
        from datetime import datetime

        # This should raise an error during JsonContainsValue creation
        with self.assertRaises(ValueError) as context:
            JsonContainsValue({'date': datetime.now()})

        self.assertIn("Cannot create JsonContainsValue", str(context.exception))

    def test_regular_value_without_json_marker(self):
        """Test SQL generation with regular values (not wrapped)."""
        values = OrderedSet(['test_string'])

        result = self.field._condition_to_sql(
            'geojson', 'in', values, self.mock_model, 'test_table', self.mock_query
        )

        self.assertIsInstance(result, SQL)


class TestEdgeCases(TransactionCase):
    """Test edge cases and error conditions."""

    def test_null_json_value(self):
        """Test handling of null/None JSON values."""
        json_val = JsonValue(None)
        self.assertEqual(json_val.value, None)

    def test_empty_dict_json_value(self):
        """Test handling of empty dictionary."""
        json_val = JsonValue({})
        self.assertEqual(json_val.value, {})

    def test_empty_list_json_value(self):
        """Test handling of empty list."""
        json_val = JsonValue([])
        self.assertEqual(json_val.value, [])

    def test_deeply_nested_structure(self):
        """Test handling of deeply nested JSON structures."""
        nested = {
            "level1": {
                "level2": {
                    "level3": {
                        "level4": ["value"]
                    }
                }
            }
        }

        json_val = JsonValue(nested)
        self.assertIsNotNone(json_val)
        self.assertEqual(json_val.value, nested)

    def test_special_characters_in_json(self):
        """Test handling of special characters in JSON strings."""
        special_chars = {
            "name": "Test's \"special\" chars: <>&",
            "unicode": "=🗺️ Map emoji"
        }

        json_val = JsonValue(special_chars)
        self.assertEqual(json_val.value, special_chars)

    def test_numeric_keys_handling(self):
        """Test handling of numeric values."""
        numeric_data = {
            "count": 42,
            "decimal": 3.14159,
            "negative": -10
        }

        json_val = JsonValue(numeric_data)
        self.assertEqual(json_val.value, numeric_data)

    def test_boolean_values(self):
        """Test handling of boolean values in JSON."""
        bool_data = {
            "is_active": True,
            "is_deleted": False
        }

        json_val = JsonValue(bool_data)
        self.assertEqual(json_val.value, bool_data)

    def test_misapplied_custom_operator_raises_error(self):
        """Test that custom operators raise ValueError when they bypass optimization."""
        field = SearchableJson()
        mock_model = Mock()
        mock_model._field_to_sql = Mock(return_value=SQL("test_table.geojson"))
        mock_query = Mock()

        for operator in ('json_eq', 'json_ne', 'json_contains', 'json_not_contains'):
            with self.assertRaises(ValueError) as context:
                field._condition_to_sql(
                    'geojson', operator, 'value', mock_model, 'test_table', mock_query
                )
            self.assertIn(
                'only supported on SearchableJson fields',
                str(context.exception),
            )
