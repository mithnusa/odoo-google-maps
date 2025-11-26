"""
Custom JSON field with advanced search capabilities for Google Map Drawing module.

This module extends Odoo's standard JSON field to support GeoJSON-specific
search operations using PostgreSQL's JSONB operators. It provides custom
domain operators for efficient JSON field querying in the web_view_google_map_drawing module.
"""
import json

from odoo import fields
from odoo.tools import SQL
from odoo.orm.domains import CONDITION_OPERATORS, operator_optimization, DomainCondition
from odoo.tools.misc import OrderedSet

# Register new operators for JSON field searching
CONDITION_OPERATORS.update(['json_eq', 'json_ne', 'json_contains', 'json_not_contains'])


class SearchableJson(fields.Json):
    """
    Extended JSON Field with advanced search capabilities for GeoJSON data.

    This field extends Odoo's standard JSON field to support custom operators
    optimized for PostgreSQL JSONB columns, enabling efficient querying of
    complex JSON structures like GeoJSON geometries.

    Supported custom operators:
        - json_eq: Exact JSON equality comparison (converted to 'in' operator)
        - json_ne: JSON inequality comparison (converted to 'not in' operator)
        - json_contains: Check if JSON field contains a sub-object (uses PostgreSQL @>)
        - json_not_contains: Check if JSON field does NOT contain a sub-object

    These operators are automatically optimized through Odoo's domain optimization
    system, allowing multiple conditions to be combined efficiently.

    Example usage in domain:
        [('geojson', 'json_eq', {'type': 'Point'})]
        [('geojson', 'json_contains', {'geometry': {'type': 'Polygon'}})]
    """

    def _condition_to_sql(self, field_expr: str, operator: str, value, model, alias: str, query) -> SQL:
        """Convert domain conditions to SQL for JSON fields"""
        sql_field = model._field_to_sql(alias, field_expr, query)

        # Handle the 'in'/'not in' operators that come from optimization
        if operator in ('in', 'not in'):
            conditions = []
            for v in value:
                if hasattr(v, '_json_contains_marker'):  # JsonContainsValue wrapper
                    # This is a containment check - use PostgreSQL @> operator
                    original_value = v.value
                    try:
                        json_value = json.dumps(original_value)
                    except (TypeError, ValueError) as e:
                        raise ValueError(f"Cannot serialize JSON value for containment check: {e}") from e

                    if operator == 'in':
                        # json_contains: field contains the value
                        conditions.append(SQL("%s @> %s::jsonb", sql_field, json_value))
                    else:
                        # json_not_contains: field does NOT contain the value
                        conditions.append(SQL("NOT (%s @> %s::jsonb)", sql_field, json_value))
                elif hasattr(v, '_json_marker'):  # JsonValue wrapper
                    # This is a JSON equality check
                    original_value = v.value
                    # Use compact JSON with sorted keys for consistent comparison
                    # separators=(',', ':') removes whitespace for stable string matching
                    try:
                        json_value = json.dumps(original_value, sort_keys=True, separators=(',', ':'))
                    except (TypeError, ValueError) as e:
                        raise ValueError(f"Cannot serialize JSON value for comparison: {e}") from e

                    if operator == 'in':
                        conditions.append(SQL("%s = %s", sql_field, json_value))
                    else:
                        # Use OR with IS NULL to handle null fields correctly
                        conditions.append(SQL("(%s IS NULL OR %s != %s)", sql_field, sql_field, json_value))
                else:
                    # Regular value (not wrapped)
                    try:
                        json_str = json.dumps(v)
                    except (TypeError, ValueError) as e:
                        raise ValueError(f"Cannot serialize value for comparison: {e}") from e

                    if operator == 'in':
                        conditions.append(SQL("%s = %s", sql_field, json_str))
                    else:
                        conditions.append(SQL("%s != %s", sql_field, json_str))

            if not conditions:
                return SQL("FALSE") if operator == 'in' else SQL("TRUE")

            if operator == 'in':
                return SQL("(%s)", SQL(" OR ".join(["%s"] * len(conditions)), *conditions))
            else:
                return SQL("(%s)", SQL(" AND ".join(["%s"] * len(conditions)), *conditions))

        # Fall back to parent for any other operators
        return super()._condition_to_sql(field_expr, operator, value, model, alias, query)


# Wrapper class for JSON values to make them hashable
class JsonValue:
    """
    Wrapper class to make JSON values hashable for domain optimization.

    Odoo's domain optimization uses sets (OrderedSet) to collect values for 'in'/'not in'
    operators. Since JSON objects (dicts/lists) are not hashable in Python, this wrapper
    provides the necessary __hash__ and __eq__ methods to enable set operations.

    The hash is computed from a stable JSON string representation with sorted keys
    and compact formatting to ensure that structurally identical JSON values produce
    the same hash, regardless of key ordering or whitespace.

    Attributes:
        value: The original JSON-serializable Python value (dict, list, etc.)
        _json_marker (bool): Marker attribute to identify wrapped values in SQL generation
        _hash (int): Pre-computed hash value for performance

    Example:
        >>> v1 = JsonValue({"type": "Point", "coordinates": [0, 0]})
        >>> v2 = JsonValue({"coordinates": [0, 0], "type": "Point"})
        >>> v1 == v2  # True - same structure despite different key order
        >>> hash(v1) == hash(v2)  # True - same hash
        >>> {v1, v2}  # {JsonValue(...)} - only one element in set
    """
    def __init__(self, value):
        self.value = value
        self._json_marker = True
        # Use compact JSON representation with sorted keys for stable hashing
        try:
            self._hash = hash(json.dumps(value, sort_keys=True, separators=(',', ':')))
        except (TypeError, ValueError) as e:
            raise ValueError(f"Cannot create JsonValue from non-serializable value: {e}") from e

    def __hash__(self):
        return self._hash

    def __eq__(self, other):
        if not isinstance(other, JsonValue):
            return False
        return self.value == other.value


class JsonContainsValue:
    """
    Wrapper class for JSON containment check values.

    This wrapper marks values that should be used with PostgreSQL's @> (contains)
    operator instead of exact equality. It's used to pass containment check values
    through the domain optimization system.

    Attributes:
        value: The JSON value to check for containment
        _json_contains_marker (bool): Marker to identify this as a containment check
        _hash (int): Pre-computed hash value for performance
    """
    def __init__(self, value):
        self.value = value
        self._json_contains_marker = True
        try:
            self._hash = hash(json.dumps(value, sort_keys=True, separators=(',', ':')))
        except (TypeError, ValueError) as e:
            raise ValueError(f"Cannot create JsonContainsValue from non-serializable value: {e}") from e

    def __hash__(self):
        return self._hash

    def __eq__(self, other):
        if not isinstance(other, JsonContainsValue):
            return False
        return self.value == other.value


# Convert our custom operators to standard 'in'/'not in' with wrapped values
@operator_optimization(['json_eq', 'json_ne'])
def _json_equal_optimization(condition, model):
    """
    Optimize json_eq/json_ne operators to standard in/not in operators.

    This optimization function is called by Odoo's domain optimizer to transform
    custom JSON equality operators into standard 'in'/'not in' operators. This
    allows multiple json_eq conditions to be combined into a single SQL IN clause.

    The transformation wraps JSON values in JsonValue objects to make them hashable,
    enabling Odoo's optimizer to collect multiple values into OrderedSets for
    efficient SQL generation.

    Transformations:
        [('geojson', 'json_eq', {...})]  ->  [('geojson', 'in', [JsonValue({...})])]
        [('geojson', 'json_ne', {...})]  ->  [('geojson', 'not in', [JsonValue({...})])]

    Multiple conditions are automatically combined by Odoo:
        [('geojson', 'json_eq', val1), ('geojson', 'json_eq', val2)]
        -> [('geojson', 'in', [JsonValue(val1), JsonValue(val2)])]

    Args:
        condition (DomainCondition): Domain condition with json_eq or json_ne operator
        model: Odoo model class (unused but required by decorator signature)

    Returns:
        DomainCondition: New condition with 'in' or 'not in' operator and wrapped value
    """
    if condition.operator == 'json_eq':
        operator = 'in'
    else:  # json_ne
        operator = 'not in'

    # Wrap the value to make it hashable for OrderedSet operations
    wrapped_value = JsonValue(condition.value)
    value = OrderedSet([wrapped_value])

    return DomainCondition(condition.field_expr, operator, value)

@operator_optimization(['json_contains', 'json_not_contains'])
def _json_contains_optimization(condition, model):
    """
    Optimize json_contains/json_not_contains to standard in/not in operators.

    This optimization function transforms JSON containment operators into standard
    'in'/'not in' operators with wrapped values. The wrapping allows _condition_to_sql
    to detect containment checks and generate the appropriate PostgreSQL @> operator.

    Transformations:
        [('geojson', 'json_contains', {'type': 'Point'})]
        -> [('geojson', 'in', [JsonContainsValue({'type': 'Point'})])]
        -> SQL: geojson @> '{"type":"Point"}'::jsonb

        [('geojson', 'json_not_contains', {'type': 'Point'})]
        -> [('geojson', 'not in', [JsonContainsValue({'type': 'Point'})])]
        -> SQL: NOT (geojson @> '{"type":"Point"}'::jsonb)

    Args:
        condition (DomainCondition): Domain condition with json_contains or json_not_contains
        model: Odoo model class (unused but required by decorator signature)

    Returns:
        DomainCondition: Condition with 'in' or 'not in' operator and wrapped value
    """
    if condition.operator == 'json_contains':
        operator = 'in'
    else:  # json_not_contains
        operator = 'not in'

    # Wrap the value to mark it as a containment check
    wrapped_value = JsonContainsValue(condition.value)
    value = OrderedSet([wrapped_value])

    return DomainCondition(condition.field_expr, operator, value)
