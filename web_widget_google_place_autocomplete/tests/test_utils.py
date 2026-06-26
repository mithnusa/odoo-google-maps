"""
Tests for utility functions in models/utils.py.

Covers safe_literal_eval and validate_component_list in isolation —
no ORM records needed, just direct function calls.

Run with:
    odoo-bin -i web_widget_google_place_autocomplete --test-enable --stop-after-init
"""

from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase

from odoo.addons.web_widget_google_place_autocomplete.models.utils import (
    safe_literal_eval,
    validate_component_list,
)


class TestSafeLiteralEval(TransactionCase):
    """Tests for safe_literal_eval."""

    # ------------------------------------------------------------------ #
    # Empty / falsy input                                                  #
    # ------------------------------------------------------------------ #

    def test_none_no_type_returns_none(self):
        self.assertIsNone(safe_literal_eval(None, 'Field'))

    def test_empty_string_no_type_returns_none(self):
        self.assertIsNone(safe_literal_eval('', 'Field'))

    def test_false_no_type_returns_none(self):
        self.assertIsNone(safe_literal_eval(False, 'Field'))

    def test_none_with_list_type_returns_empty_list(self):
        self.assertEqual(safe_literal_eval(None, 'Field', list), [])

    def test_empty_string_with_list_type_returns_empty_list(self):
        self.assertEqual(safe_literal_eval('', 'Field', list), [])

    def test_none_with_dict_type_returns_empty_dict(self):
        self.assertEqual(safe_literal_eval(None, 'Field', dict), {})

    def test_none_with_str_type_returns_empty_string(self):
        self.assertEqual(safe_literal_eval(None, 'Field', str), '')

    # ------------------------------------------------------------------ #
    # Valid input — no expected type                                       #
    # ------------------------------------------------------------------ #

    def test_valid_list_is_parsed(self):
        result = safe_literal_eval("['locality', 'route']", 'Field')
        self.assertEqual(result, ['locality', 'route'])

    def test_valid_dict_is_parsed(self):
        result = safe_literal_eval("{'types': ['address']}", 'Field')
        self.assertEqual(result, {'types': ['address']})

    def test_valid_string_literal_is_parsed(self):
        self.assertEqual(
            safe_literal_eval("'displayName'", 'Field'), 'displayName'
        )

    def test_valid_integer_literal_is_parsed(self):
        self.assertEqual(safe_literal_eval('42', 'Field'), 42)

    def test_valid_tuple_is_parsed(self):
        self.assertEqual(safe_literal_eval("('a', 'b')", 'Field'), ('a', 'b'))

    # ------------------------------------------------------------------ #
    # Valid input — with expected type                                     #
    # ------------------------------------------------------------------ #

    def test_list_matches_expected_list_type(self):
        result = safe_literal_eval("['a', 'b']", 'Field', list)
        self.assertEqual(result, ['a', 'b'])

    def test_dict_matches_expected_dict_type(self):
        result = safe_literal_eval("{'k': 'v'}", 'Field', dict)
        self.assertEqual(result, {'k': 'v'})

    def test_string_matches_expected_str_type(self):
        result = safe_literal_eval("'hello'", 'Field', str)
        self.assertEqual(result, 'hello')

    # ------------------------------------------------------------------ #
    # Type mismatch                                                        #
    # ------------------------------------------------------------------ #

    def test_dict_when_list_expected_raises(self):
        with self.assertRaises(ValidationError):
            safe_literal_eval("{'a': 1}", 'Field', list)

    def test_string_when_list_expected_raises(self):
        with self.assertRaises(ValidationError):
            safe_literal_eval("'hello'", 'Field', list)

    def test_integer_when_list_expected_raises(self):
        with self.assertRaises(ValidationError):
            safe_literal_eval('42', 'Field', list)

    def test_list_when_dict_expected_raises(self):
        with self.assertRaises(ValidationError):
            safe_literal_eval("['a']", 'Field', dict)

    def test_integer_when_str_expected_raises(self):
        with self.assertRaises(ValidationError):
            safe_literal_eval('42', 'Field', str)

    def test_list_when_str_expected_raises(self):
        with self.assertRaises(ValidationError):
            safe_literal_eval("['a']", 'Field', str)

    # ------------------------------------------------------------------ #
    # Invalid syntax / non-literal expressions                             #
    # ------------------------------------------------------------------ #

    def test_unclosed_bracket_raises(self):
        with self.assertRaises(ValidationError):
            safe_literal_eval('[locality', 'Field')

    def test_bare_variable_name_raises(self):
        """A plain identifier is not a literal and must be rejected."""
        with self.assertRaises(ValidationError):
            safe_literal_eval('locality', 'Field')

    def test_arithmetic_expression_raises(self):
        with self.assertRaises(ValidationError):
            safe_literal_eval('1 + 1', 'Field')

    def test_function_call_raises(self):
        """Function calls are not literals and must be rejected."""
        with self.assertRaises(ValidationError):
            safe_literal_eval('list()', 'Field')

    def test_import_expression_raises(self):
        """ast.literal_eval must reject arbitrary code — no RCE vector."""
        with self.assertRaises(ValidationError):
            safe_literal_eval("__import__('os')", 'Field')

    def test_attribute_access_raises(self):
        with self.assertRaises(ValidationError):
            safe_literal_eval('os.path', 'Field')

    # ------------------------------------------------------------------ #
    # Error message content                                                #
    # ------------------------------------------------------------------ #

    def test_field_name_appears_in_type_error_message(self):
        with self.assertRaises(ValidationError) as ctx:
            safe_literal_eval('42', 'My Address Component', list)
        self.assertIn('My Address Component', str(ctx.exception))

    def test_field_name_appears_in_syntax_error_message(self):
        with self.assertRaises(ValidationError) as ctx:
            safe_literal_eval('[bad', 'My Address Component')
        self.assertIn('My Address Component', str(ctx.exception))


class TestValidateComponentList(TransactionCase):
    """Tests for validate_component_list."""

    # ------------------------------------------------------------------ #
    # Valid input                                                          #
    # ------------------------------------------------------------------ #

    def test_single_item_list_passes(self):
        validate_component_list("['locality']", 'Field')

    def test_two_item_list_passes(self):
        validate_component_list("['street_number', 'route']", 'Field')

    def test_three_item_list_passes(self):
        validate_component_list(
            "['administrative_area_level_1', 'administrative_area_level_2', 'locality']",
            'Field',
        )

    def test_single_char_string_item_passes(self):
        validate_component_list("['a']", 'Field')

    # ------------------------------------------------------------------ #
    # Empty / falsy input                                                  #
    # ------------------------------------------------------------------ #

    def test_none_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list(None, 'Field')

    def test_empty_string_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list('', 'Field')

    def test_false_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list(False, 'Field')

    def test_empty_list_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list('[]', 'Field')

    # ------------------------------------------------------------------ #
    # Wrong top-level type                                                 #
    # ------------------------------------------------------------------ #

    def test_integer_literal_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list('42', 'Field')

    def test_dict_literal_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list("{'key': 'value'}", 'Field')

    def test_string_literal_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list("'locality'", 'Field')

    def test_tuple_literal_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list("('a', 'b')", 'Field')

    # ------------------------------------------------------------------ #
    # List with invalid items                                              #
    # ------------------------------------------------------------------ #

    def test_list_with_integer_item_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list('[1, 2]', 'Field')

    def test_list_of_integers_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list('[42]', 'Field')

    def test_list_with_mixed_str_and_int_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list("['locality', 123]", 'Field')

    def test_list_with_empty_string_item_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list("['locality', '']", 'Field')

    def test_list_with_only_empty_string_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list("['']", 'Field')

    def test_list_with_none_item_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list('[None]', 'Field')

    def test_list_with_bool_item_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list('[True]', 'Field')

    def test_list_with_nested_list_item_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list("[['a']]", 'Field')

    # ------------------------------------------------------------------ #
    # Invalid syntax                                                       #
    # ------------------------------------------------------------------ #

    def test_unclosed_bracket_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list('[locality', 'Field')

    def test_bare_word_raises(self):
        with self.assertRaises(ValidationError):
            validate_component_list('locality', 'Field')

    # ------------------------------------------------------------------ #
    # Error message content                                                #
    # ------------------------------------------------------------------ #

    def test_field_name_in_empty_error(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_component_list(None, 'Google Address Component')
        self.assertIn('Google Address Component', str(ctx.exception))

    def test_field_name_in_invalid_type_error(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_component_list('[1, 2]', 'Google Address Component')
        self.assertIn('Google Address Component', str(ctx.exception))
