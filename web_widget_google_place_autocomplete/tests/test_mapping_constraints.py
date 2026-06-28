"""
Tests for all @api.constrains and models.Constraint rules across:

  - google.places.mapping             (_check_mappings, _check_field_mappings)
  - google.places.mapping.address.line (_check_gplace_component,
                                        _check_component_handling_mode_compatibility,
                                        UNIQUE(mapping_id, field_id))
  - google.places.mapping.other.line  (_check_gplace_component,
                                        UNIQUE(mapping_id, field_id))

Run with:
    odoo-bin -i web_widget_google_place_autocomplete --test-enable --stop-after-init
"""

from odoo import Command
from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase
from odoo.tools import mute_logger


# ---------------------------------------------------------------------------
# Shared base
# ---------------------------------------------------------------------------


class MappingConstraintBase(TransactionCase):
    """Create the minimum shared fixtures used by all constraint test classes."""

    def setUp(self):
        super().setUp()
        self.partner_model = self.env['ir.model'].search(
            [('model', '=', 'res.partner')], limit=1
        )
        F = self.env['ir.model.fields']
        base = [('model_id', '=', self.partner_model.id)]
        self.f_name = F.search(base + [('name', '=', 'name')], limit=1)
        self.f_street = F.search(base + [('name', '=', 'street')], limit=1)
        self.f_city = F.search(base + [('name', '=', 'city')], limit=1)
        self.f_zip = F.search(base + [('name', '=', 'zip')], limit=1)
        self.f_country = F.search(
            base + [('name', '=', 'country_id')], limit=1
        )
        self.f_state = F.search(base + [('name', '=', 'state_id')], limit=1)

        self.mapping = self.env['google.places.mapping'].create(
            {
                'code': 'test_constraint',
                'mode': 'address',
                'model_id': self.partner_model.id,
                'gplace_address_fetch_fields': "['addressComponents', 'location']",
            }
        )

    def _addr_line(self, **kw):
        vals = {
            'mapping_id': self.mapping.id,
            'field_id': self.f_street.id,
            'gplace_component': "['locality']",
            'handling_mode': 'direct',
        }
        vals.update(kw)
        return self.env['google.places.mapping.address.line'].create(vals)

    def _other_line(self, **kw):
        vals = {
            'mapping_id': self.mapping.id,
            'field_id': self.f_street.id,
            'gplace_component': "'displayName'",
        }
        vals.update(kw)
        return self.env['google.places.mapping.other.line'].create(vals)


# ---------------------------------------------------------------------------
# Address line — _check_gplace_component
# ---------------------------------------------------------------------------


class TestAddressLineGplaceComponent(MappingConstraintBase):
    """validate_component_list is called on gplace_component; tests all branches."""

    def test_single_valid_component_passes(self):
        self._addr_line(gplace_component="['locality']")

    def test_multiple_valid_components_passes(self):
        self._addr_line(
            gplace_component="['street_number', 'route']",
            handling_mode='concat',
        )

    def test_invalid_syntax_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component='[locality')

    def test_bare_word_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component='locality')

    def test_integer_literal_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component='42')

    def test_string_literal_raises(self):
        """A plain string is not a list and must be rejected."""
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component="'locality'")

    def test_dict_literal_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component="{'locality': 'city'}")

    def test_empty_list_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component='[]')

    def test_list_with_integer_item_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component='[1, 2]')

    def test_list_with_empty_string_item_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component="['locality', '']")

    def test_list_with_none_item_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component='[None]')

    def test_list_with_mixed_types_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(gplace_component="['locality', 123]")

    def test_updating_to_invalid_component_raises(self):
        """Constraint also fires on write, not just create."""
        line = self._addr_line(gplace_component="['locality']")
        with self.assertRaises(ValidationError):
            line.write({'gplace_component': '[]'})

    def test_updating_to_valid_component_passes(self):
        line = self._addr_line(gplace_component="['locality']")
        line.write({'gplace_component': "['administrative_area_level_1']"})
        self.assertEqual(
            line.gplace_component, "['administrative_area_level_1']"
        )


# ---------------------------------------------------------------------------
# Address line — _check_component_handling_mode_compatibility
# ---------------------------------------------------------------------------


class TestAddressLineHandlingMode(MappingConstraintBase):
    """Validate that handling_mode is enforced against component count."""

    # direct ----------------------------------------------------------------

    def test_direct_with_one_component_passes(self):
        self._addr_line(
            gplace_component="['locality']",
            handling_mode='direct',
        )

    def test_direct_with_two_components_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(
                gplace_component="['locality', 'administrative_area_level_2']",
                handling_mode='direct',
            )

    def test_direct_with_three_components_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(
                gplace_component="['a', 'b', 'c']",
                handling_mode='direct',
            )

    # fallback --------------------------------------------------------------

    def test_fallback_with_two_components_passes(self):
        self._addr_line(
            gplace_component="['locality', 'administrative_area_level_2']",
            handling_mode='fallback',
        )

    def test_fallback_with_three_components_passes(self):
        self._addr_line(
            gplace_component="['a', 'b', 'c']",
            handling_mode='fallback',
        )

    def test_fallback_with_one_component_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(
                gplace_component="['locality']",
                handling_mode='fallback',
            )

    # concat ----------------------------------------------------------------

    def test_concat_with_two_components_passes(self):
        self._addr_line(
            gplace_component="['street_number', 'route']",
            handling_mode='concat',
        )

    def test_concat_with_three_components_passes(self):
        self._addr_line(
            gplace_component="['a', 'b', 'c']",
            handling_mode='concat',
        )

    def test_concat_with_one_component_raises(self):
        with self.assertRaises(ValidationError):
            self._addr_line(
                gplace_component="['locality']",
                handling_mode='concat',
            )

    # write triggers constraint ---------------------------------------------

    def test_changing_mode_to_direct_with_two_components_raises(self):
        """Constraint fires on write when handling_mode changes."""
        line = self._addr_line(
            gplace_component="['locality', 'administrative_area_level_2']",
            handling_mode='fallback',
        )
        with self.assertRaises(ValidationError):
            line.write({'handling_mode': 'direct'})

    def test_changing_mode_to_fallback_with_one_component_raises(self):
        line = self._addr_line(
            gplace_component="['locality']",
            handling_mode='direct',
        )
        with self.assertRaises(ValidationError):
            line.write({'handling_mode': 'fallback'})

    def test_invalid_component_skips_mode_check(self):
        """Invalid gplace_component is caught by _check_gplace_component;
        _check_component_handling_mode_compatibility silently skips."""
        with self.assertRaises(ValidationError):
            self._addr_line(
                gplace_component='[invalid',
                handling_mode='direct',
            )


# ---------------------------------------------------------------------------
# Address line — UNIQUE(mapping_id, field_id)
# ---------------------------------------------------------------------------


class TestAddressLineUniqueConstraint(MappingConstraintBase):

    def test_duplicate_field_in_same_mapping_raises(self):
        # models.Constraint raises psycopg2 UniqueViolation, not ValidationError.
        # savepoint(flush=False) rolls back the cursor error state before re-raising.
        self._addr_line(field_id=self.f_street.id)
        with mute_logger('odoo.sql_db'), self.assertRaises(Exception):
            with self.env.cr.savepoint(flush=False):
                self._addr_line(field_id=self.f_street.id)

    def test_different_fields_in_same_mapping_passes(self):
        self._addr_line(field_id=self.f_street.id)
        self._addr_line(field_id=self.f_city.id)

    def test_same_field_in_different_mappings_passes(self):
        mapping2 = self.env['google.places.mapping'].create(
            {
                'code': 'test_constraint_2',
                'mode': 'address',
                'model_id': self.partner_model.id,
                'gplace_address_fetch_fields': "['addressComponents']",
            }
        )
        self._addr_line(field_id=self.f_street.id)
        self.env['google.places.mapping.address.line'].create(
            {
                'mapping_id': mapping2.id,
                'field_id': self.f_street.id,
                'gplace_component': "['locality']",
                'handling_mode': 'direct',
            }
        )


# ---------------------------------------------------------------------------
# Other line — _check_gplace_component
# ---------------------------------------------------------------------------


class TestOtherLineGplaceComponent(MappingConstraintBase):
    """For other lines gplace_component must be a non-empty string literal."""

    def test_valid_string_literal_passes(self):
        self._other_line(gplace_component="'displayName'")

    def test_another_valid_string_literal_passes(self):
        self._other_line(gplace_component="'internationalPhoneNumber'")

    def test_invalid_syntax_raises(self):
        with self.assertRaises(ValidationError):
            self._other_line(gplace_component='displayName')

    def test_integer_literal_raises(self):
        with self.assertRaises(ValidationError):
            self._other_line(gplace_component='42')

    def test_list_literal_raises(self):
        """A list is not a valid single component key."""
        with self.assertRaises(ValidationError):
            self._other_line(gplace_component="['displayName']")

    def test_dict_literal_raises(self):
        with self.assertRaises(ValidationError):
            self._other_line(gplace_component="{'key': 'value'}")

    def test_empty_string_literal_raises(self):
        with self.assertRaises(ValidationError):
            self._other_line(gplace_component="''")

    def test_updating_to_invalid_raises(self):
        line = self._other_line(gplace_component="'displayName'")
        with self.assertRaises(ValidationError):
            line.write({'gplace_component': '42'})

    def test_updating_to_valid_passes(self):
        line = self._other_line(gplace_component="'displayName'")
        line.write({'gplace_component': "'rating'"})
        self.assertEqual(line.gplace_component, "'rating'")


# ---------------------------------------------------------------------------
# Other line — UNIQUE(mapping_id, field_id)
# ---------------------------------------------------------------------------


class TestOtherLineUniqueConstraint(MappingConstraintBase):

    def test_duplicate_field_in_same_mapping_raises(self):
        self._other_line(field_id=self.f_street.id)
        with mute_logger('odoo.sql_db'), self.assertRaises(Exception):
            with self.env.cr.savepoint(flush=False):
                self._other_line(field_id=self.f_street.id)

    def test_different_fields_in_same_mapping_passes(self):
        self._other_line(field_id=self.f_street.id)
        self._other_line(
            field_id=self.f_city.id,
            gplace_component="'rating'",
        )

    def test_same_field_in_different_mappings_passes(self):
        mapping2 = self.env['google.places.mapping'].create(
            {
                'code': 'test_other_2',
                'mode': 'places',
                'model_id': self.partner_model.id,
            }
        )
        self._other_line(field_id=self.f_street.id)
        self.env['google.places.mapping.other.line'].create(
            {
                'mapping_id': mapping2.id,
                'field_id': self.f_street.id,
                'gplace_component': "'displayName'",
            }
        )


# ---------------------------------------------------------------------------
# google.places.mapping — _check_mappings (gplace_options)
# ---------------------------------------------------------------------------


class TestMappingGplaceOptions(MappingConstraintBase):

    def test_no_options_set_passes(self):
        self.mapping.write({'gplace_options': False})

    def test_valid_dict_options_passes(self):
        self.mapping.write({'gplace_options': "{'types': ['address']}"})

    def test_empty_dict_passes(self):
        self.mapping.write({'gplace_options': '{}'})

    def test_invalid_syntax_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write({'gplace_options': '{invalid'})

    def test_non_dict_list_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write({'gplace_options': "['types']"})

    def test_non_dict_string_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write({'gplace_options': "'options'"})

    def test_non_string_key_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write({'gplace_options': "{1: 'value'}"})

    def test_empty_key_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write({'gplace_options': "{'': 'value'}"})

    def test_empty_value_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write({'gplace_options': "{'types': ''}"})

    def test_multiple_valid_keys_pass(self):
        self.mapping.write(
            {
                'gplace_options': "{'types': ['address'], 'componentRestrictions': {'country': 'nz'}}",
            }
        )


# ---------------------------------------------------------------------------
# google.places.mapping — _check_mappings (fetch fields)
# ---------------------------------------------------------------------------


class TestMappingFetchFields(MappingConstraintBase):

    # address mode ----------------------------------------------------------

    def test_address_mode_valid_fetch_fields_pass(self):
        self.mapping.write(
            {
                'mode': 'address',
                'gplace_address_fetch_fields': "['addressComponents', 'location']",
            }
        )

    def test_address_mode_empty_fetch_fields_passes(self):
        """Field is optional; empty means no fetch-field validation fires."""
        self.mapping.write(
            {
                'mode': 'address',
                'gplace_address_fetch_fields': False,
            }
        )

    def test_address_mode_empty_list_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mode': 'address',
                    'gplace_address_fetch_fields': '[]',
                }
            )

    def test_address_mode_non_list_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mode': 'address',
                    'gplace_address_fetch_fields': "'addressComponents'",
                }
            )

    def test_address_mode_list_with_integer_item_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mode': 'address',
                    'gplace_address_fetch_fields': '[1, 2]',
                }
            )

    def test_address_mode_invalid_syntax_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mode': 'address',
                    'gplace_address_fetch_fields': '[addressComponents',
                }
            )

    # places mode -----------------------------------------------------------

    def test_places_mode_valid_fetch_fields_pass(self):
        self.mapping.write(
            {
                'mode': 'places',
                'gplace_place_fetch_fields': "['displayName', 'rating']",
            }
        )

    def test_places_mode_empty_fetch_fields_passes(self):
        """gplace_place_fetch_fields is optional; must not raise when unset."""
        self.mapping.write(
            {
                'mode': 'places',
                'gplace_place_fetch_fields': False,
            }
        )

    def test_places_mode_empty_list_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mode': 'places',
                    'gplace_place_fetch_fields': '[]',
                }
            )

    def test_places_mode_non_list_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mode': 'places',
                    'gplace_place_fetch_fields': "'displayName'",
                }
            )

    def test_places_mode_list_with_empty_string_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mode': 'places',
                    'gplace_place_fetch_fields': "['displayName', '']",
                }
            )

    def test_address_fetch_fields_not_validated_in_places_mode(self):
        """Address fetch fields are only validated in address mode."""
        self.mapping.write(
            {
                'mode': 'places',
                'gplace_place_fetch_fields': "['displayName']",
                'gplace_address_fetch_fields': False,
            }
        )


# ---------------------------------------------------------------------------
# google.places.mapping — _check_field_mappings (cross-mapping duplicates)
# ---------------------------------------------------------------------------


class TestMappingCrossFieldConstraint(MappingConstraintBase):
    """A field must not appear in both address lines and other lines."""

    def test_same_field_in_address_and_other_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mapping_address_ids': [
                        Command.create(
                            {
                                'field_id': self.f_street.id,
                                'gplace_component': "['locality']",
                                'handling_mode': 'direct',
                            }
                        )
                    ],
                    'mapping_other_ids': [
                        Command.create(
                            {
                                'field_id': self.f_street.id,
                                'gplace_component': "'displayName'",
                            }
                        )
                    ],
                }
            )

    def test_different_fields_in_address_and_other_passes(self):
        self.mapping.write(
            {
                'mapping_address_ids': [
                    Command.create(
                        {
                            'field_id': self.f_street.id,
                            'gplace_component': "['locality']",
                            'handling_mode': 'direct',
                        }
                    )
                ],
                'mapping_other_ids': [
                    Command.create(
                        {
                            'field_id': self.f_city.id,
                            'gplace_component': "'displayName'",
                        }
                    )
                ],
            }
        )

    def test_adding_duplicate_other_line_raises(self):
        """Duplicate detected when other line is added after address line exists."""
        self.mapping.write(
            {
                'mapping_address_ids': [
                    Command.create(
                        {
                            'field_id': self.f_street.id,
                            'gplace_component': "['locality']",
                            'handling_mode': 'direct',
                        }
                    )
                ],
            }
        )
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mapping_other_ids': [
                        Command.create(
                            {
                                'field_id': self.f_street.id,
                                'gplace_component': "'displayName'",
                            }
                        )
                    ],
                }
            )

    def test_adding_duplicate_address_line_raises(self):
        """Duplicate detected when address line is added after other line exists."""
        self.mapping.write(
            {
                'mapping_other_ids': [
                    Command.create(
                        {
                            'field_id': self.f_street.id,
                            'gplace_component': "'displayName'",
                        }
                    )
                ],
            }
        )
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mapping_address_ids': [
                        Command.create(
                            {
                                'field_id': self.f_street.id,
                                'gplace_component': "['locality']",
                                'handling_mode': 'direct',
                            }
                        )
                    ],
                }
            )

    def test_multiple_fields_with_one_overlap_raises(self):
        with self.assertRaises(ValidationError):
            self.mapping.write(
                {
                    'mapping_address_ids': [
                        Command.create(
                            {
                                'field_id': self.f_street.id,
                                'gplace_component': "['locality']",
                                'handling_mode': 'direct',
                            }
                        ),
                        Command.create(
                            {
                                'field_id': self.f_city.id,
                                'gplace_component': "['route']",
                                'handling_mode': 'direct',
                            }
                        ),
                    ],
                    'mapping_other_ids': [
                        Command.create(
                            {
                                'field_id': self.f_city.id,
                                'gplace_component': "'displayName'",
                            }
                        )
                    ],
                }
            )
