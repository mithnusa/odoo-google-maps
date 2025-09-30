from odoo import fields
from odoo.tools import SQL
from odoo.orm.domains import CONDITION_OPERATORS, operator_optimization, DomainCondition
from odoo.tools.misc import OrderedSet
import json

# Register new operators
CONDITION_OPERATORS.update(['json_eq', 'json_ne', 'json_contains', 'json_not_contains'])


class SearchableJson(fields.Json):
    """ Extended JSON Field with search capability """

    def _condition_to_sql(self, field_expr: str, operator: str, value, model, alias: str, query) -> SQL:
        """Convert domain conditions to SQL for JSON fields"""
        sql_field = model._field_to_sql(alias, field_expr, query)

        # Handle the 'in'/'not in' operators that come from optimization
        if operator in ('in', 'not in'):
            conditions = []
            for v in value:
                if hasattr(v, '_json_marker'):  # Our special marker
                    # This is a JSON value that was wrapped
                    original_value = v.value
                    json_value = json.dumps(original_value, sort_keys=True, separators=(',', ':'))
                    if operator == 'in':
                        conditions.append(SQL("%s = %s", sql_field, json_value))
                    else:
                        conditions.append(SQL("(%s IS NULL OR %s != %s)", sql_field, sql_field, json_value))
                else:
                    # Regular value
                    if operator == 'in':
                        conditions.append(SQL("%s = %s", sql_field, json.dumps(v)))
                    else:
                        conditions.append(SQL("%s != %s", sql_field, json.dumps(v)))

            if not conditions:
                return SQL("FALSE") if operator == 'in' else SQL("TRUE")

            if operator == 'in':
                return SQL("(%s)", SQL(" OR ".join(["%s"] * len(conditions)), *conditions))
            else:
                return SQL("(%s)", SQL(" AND ".join(["%s"] * len(conditions)), *conditions))

        # PostgreSQL operators (already standard)
        elif operator == '@>':
            json_value = json.dumps(value)
            return SQL("%s @> %s::jsonb", sql_field, json_value)

        # Fall back to parent
        return super()._condition_to_sql(field_expr, operator, value, model, alias, query)


# Wrapper class for JSON values to make them hashable
class JsonValue:
    def __init__(self, value):
        self.value = value
        self._json_marker = True
        self._hash = hash(json.dumps(value, sort_keys=True, separators=(',', ':')))

    def __hash__(self):
        return self._hash

    def __eq__(self, other):
        if not isinstance(other, JsonValue):
            return False
        return self.value == other.value


# Convert our custom operators to standard 'in'/'not in' with wrapped values
@operator_optimization(['json_eq', 'json_ne'])
def _json_equal_optimization(condition, model):
    """Convert json_eq/json_ne to in/not in with wrapped values"""
    if condition.operator == 'json_eq':
        operator = 'in'
    else:  # json_ne
        operator = 'not in'

    # Wrap the value to make it hashable
    wrapped_value = JsonValue(condition.value)
    value = OrderedSet([wrapped_value])

    return DomainCondition(condition.field_expr, operator, value)

@operator_optimization(['json_contains', 'json_not_contains'])  
def _json_contains_optimization(condition, model):
    """Convert json_contains to @> operator (which is standard for PostgreSQL)"""
    if condition.operator == 'json_contains':
        return DomainCondition(condition.field_expr, '@>', condition.value)
    else:  # json_not_contains
        # Convert to a custom domain that gets handled by _condition_to_sql
        return condition  # Keep as-is, handle in _condition_to_sql