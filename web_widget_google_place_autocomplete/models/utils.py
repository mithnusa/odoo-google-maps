import ast
from odoo.exceptions import ValidationError

from odoo.tools.translate import LazyTranslate

_lt = LazyTranslate(__name__, default_lang='en_US')


def safe_literal_eval(text, field_name, expected_type=None):
    """Safely parse AST literal with consistent error handling.

    Args:
        text (str): JSON string to parse
        field_name (str): Human-readable field name for error messages
        expected_type (type, optional): Expected type for validation

    Returns:
        object: Parsed object from AST literal evaluation

    Raises:
        ValidationError: If parsing fails or type validation fails
    """
    if not text:
        return expected_type() if expected_type else None

    try:
        result = ast.literal_eval(text)
        if expected_type and not isinstance(result, expected_type):
            raise ValidationError(
                # pylint: disable-next=prefer-env-translation
                _lt('%s must be a %s.', field_name, expected_type.__name__)
            )
        return result
    except (ValueError, SyntaxError, TypeError) as e:
        raise ValidationError(
            # pylint: disable-next=prefer-env-translation
            _lt(
                '%s must be a valid JSON string.\nTraceback: %s',
                field_name,
                str(e),
            )
        )


def validate_component_list(fetch_fields_text, field_name):
    """Validate Google Places API fetch fields configuration.

    Ensures fetch fields are properly formatted as a list of non-empty strings.
    Used for both place fetch fields and address fetch fields validation.

    Args:
        fetch_fields_text (str): JSON string containing list of fetch fields
        field_name (str): Human-readable field name for error messages

    Raises:
        ValidationError: If fetch fields are invalid or improperly formatted
    """
    if not fetch_fields_text:
        # pylint: disable-next=prefer-env-translation
        raise ValidationError(_lt('%s cannot be empty.', field_name))

    result = safe_literal_eval(fetch_fields_text, field_name, list)
    if not result:
        # pylint: disable-next=prefer-env-translation
        raise ValidationError(_lt('%s cannot be empty.', field_name))

    for item in result:
        if not isinstance(item, str) or not item:
            raise ValidationError(
                # pylint: disable-next=prefer-env-translation
                _lt('%s must be a list of strings.', field_name)
            )
