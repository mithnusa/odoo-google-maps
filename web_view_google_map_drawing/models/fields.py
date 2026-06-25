"""
Custom JSON field with advanced search capabilities for Google Maps Drawing module.

Extends Odoo's standard JSON field with GeoJSON-specific domain operators backed
by PostgreSQL JSONB operators. NULL handling: Python False/None maps to SQL NULL.

Supported operators:
    json_eq / json_ne           -- exact JSONB equality / inequality
    json_contains               -- field @> value  (field contains sub-object)
    json_not_contains           -- NOT (field @> value)
"""

import json

from odoo import fields
from odoo.tools import SQL
from odoo.orm.domains import (
    CONDITION_OPERATORS,
    operator_optimization,
    DomainCondition,
)
from odoo.tools.misc import OrderedSet

# Odoo 19 has no public API for registering custom domain operators.
# Mutating this internal set is the only available extension point.
# Re-verify this is still a plain set on each major Odoo version upgrade.
CONDITION_OPERATORS.update(
    ["json_eq", "json_ne", "json_contains", "json_not_contains"]
)


# ---------------------------------------------------------------------------
# Wrapper types — make JSON values hashable for Odoo's OrderedSet optimizer
# ---------------------------------------------------------------------------


class _JsonWrappedValue:
    """Base for JSON value wrappers that need to participate in domain optimization."""

    __slots__ = ("value", "_hash")

    def __init__(self, value):
        self.value = value
        try:
            self._hash = hash(
                json.dumps(value, sort_keys=True, separators=(",", ":"))
            )
        except (TypeError, ValueError) as e:
            raise ValueError(
                f"Domain value is not JSON-serializable: {e}"
            ) from e

    def __hash__(self):
        return self._hash

    def __eq__(self, other):
        # type().__name__ comparison is intentional: when this module is loaded via two
        # Python import paths (dual-import), `type(self) is type(other)` can be False for
        # semantically identical classes. Name-based comparison preserves correct
        # OrderedSet deduplication. Do NOT replace with isinstance or type() identity.
        if type(self).__name__ != type(other).__name__ or not hasattr(
            other, "value"
        ):
            return NotImplemented
        return self.value == other.value

    def __repr__(self):
        return f"{type(self).__name__}({self.value!r})"


class JsonValue(_JsonWrappedValue):
    """Wraps a value for json_eq / json_ne (exact JSONB equality)."""

    __slots__ = ()


class JsonContainsValue(_JsonWrappedValue):
    """Wraps a value for json_contains / json_not_contains (JSONB @> operator)."""

    __slots__ = ()


# ---------------------------------------------------------------------------
# Field
# ---------------------------------------------------------------------------


class SearchableJson(fields.Json):
    """
    JSON field that supports custom GeoJSON domain operators.

    See module docstring for supported operators and NULL handling.
    """

    def _condition_to_sql(
        self, field_expr: str, operator: str, value, model, alias: str, query
    ) -> SQL:
        sql_field = model._field_to_sql(alias, field_expr, query)

        # Intercept in/not in entirely: parent fields.Json uses text comparison,
        # but this field requires JSONB semantics for all value types.
        if operator in ("in", "not in"):
            return self._build_json_in_sql(sql_field, operator, value)

        # Custom operators must be rewritten to in/not in by operator_optimization before
        # reaching here. If they arrive unrewritten, the registration failed.
        if operator in (
            "json_eq",
            "json_ne",
            "json_contains",
            "json_not_contains",
        ):
            raise AssertionError(
                f"Operator '{operator}' reached _condition_to_sql without being rewritten "
                "— operator_optimization registration may have failed."
            )

        return super()._condition_to_sql(
            field_expr, operator, value, model, alias, query
        )

    def _build_json_in_sql(self, sql_field: SQL, operator: str, values) -> SQL:
        conditions = [
            self._single_value_to_sql(sql_field, operator, v) for v in values
        ]

        if not conditions:
            return SQL("FALSE") if operator == "in" else SQL("TRUE")

        joiner = " OR " if operator == "in" else " AND "
        return SQL(
            "(%s)", SQL(joiner.join(["%s"] * len(conditions)), *conditions)
        )

    def _single_value_to_sql(self, sql_field: SQL, operator: str, v) -> SQL:
        # type().__name__ dispatch is intentional — see _JsonWrappedValue.__eq__ for
        # rationale. Do NOT replace with isinstance: dual-import creates distinct class
        # objects for the same logical type, making isinstance unreliable here.
        vname = type(v).__name__
        if vname == "JsonContainsValue" and hasattr(v, "value"):
            return self._containment_sql(sql_field, operator, v.value)
        if vname == "JsonValue" and hasattr(v, "value"):
            return self._equality_sql(sql_field, operator, v.value)

        # Plain value from standard Odoo operators (e.g. != False → not in [False])
        if v is False or v is None:
            return (
                SQL("%s IS NULL", sql_field)
                if operator == "in"
                else SQL("%s IS NOT NULL", sql_field)
            )

        return self._equality_sql(sql_field, operator, v)

    def _equality_sql(self, sql_field: SQL, operator: str, value) -> SQL:
        """Generate SQL for exact JSONB equality using ::jsonb cast on both sides."""
        try:
            json_str = json.dumps(value, sort_keys=True, separators=(",", ":"))
        except (TypeError, ValueError) as e:
            raise ValueError(
                f"Cannot serialize JSON value for comparison: {e}"
            ) from e

        if operator == "in":
            return SQL("%s::jsonb = %s::jsonb", sql_field, json_str)
        # Include NULL rows in != results (NULL != anything is NULL, not TRUE)
        return SQL(
            "(%s IS NULL OR %s::jsonb != %s::jsonb)",
            sql_field,
            sql_field,
            json_str,
        )

    def _containment_sql(self, sql_field: SQL, operator: str, value) -> SQL:
        """Generate SQL for JSONB @> containment check."""
        try:
            json_str = json.dumps(value, sort_keys=True)
        except (TypeError, ValueError) as e:
            raise ValueError(
                f"Cannot serialize JSON value for containment check: {e}"
            ) from e

        if operator == "in":
            return SQL("%s @> %s::jsonb", sql_field, json_str)
        # NULL @> value = NULL (not FALSE) — include NULL rows in NOT-contains results
        return SQL(
            "(%s IS NULL OR NOT (%s @> %s::jsonb))",
            sql_field,
            sql_field,
            json_str,
        )


# ---------------------------------------------------------------------------
# Domain optimizations — rewrite custom operators to in/not in with wrapped values
# ---------------------------------------------------------------------------


@operator_optimization(["json_eq", "json_ne"])
def _json_equal_optimization(condition, model):
    operator = "in" if condition.operator == "json_eq" else "not in"
    return DomainCondition(
        condition.field_expr,
        operator,
        OrderedSet([JsonValue(condition.value)]),
    )


@operator_optimization(["json_contains", "json_not_contains"])
def _json_contains_optimization(condition, model):
    operator = "in" if condition.operator == "json_contains" else "not in"
    return DomainCondition(
        condition.field_expr,
        operator,
        OrderedSet([JsonContainsValue(condition.value)]),
    )
