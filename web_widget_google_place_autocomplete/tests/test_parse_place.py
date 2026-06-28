"""
Tests for the parse_place pipeline and its helper methods.

Covers:
  - adjust_address_components
  - _build_component_lookup
  - parse_geolocation
  - parse_address  (direct / fallback / concat text fields, relational fields,
                    country-aware street formatting, missing components)
  - parse_others
  - parse_place   (end-to-end, unknown code, places vs address mode)

Run with:
    odoo-bin -i web_widget_google_place_autocomplete --test-enable --stop-after-init
"""

from odoo import Command
from odoo.tests.common import TransactionCase


# ---------------------------------------------------------------------------
# Shared fixture
# ---------------------------------------------------------------------------


class ParsePlaceBase(TransactionCase):
    """
    Creates a full google.places.mapping for res.partner in address mode,
    shared across parse tests.
    """

    def setUp(self):
        super().setUp()
        partner_model = self.env['ir.model'].search(
            [('model', '=', 'res.partner')], limit=1
        )
        F = self.env['ir.model.fields']
        base = [('model_id', '=', partner_model.id)]

        self.f_street = F.search(base + [('name', '=', 'street')], limit=1)
        self.f_city = F.search(base + [('name', '=', 'city')], limit=1)
        self.f_zip = F.search(base + [('name', '=', 'zip')], limit=1)
        self.f_country = F.search(
            base + [('name', '=', 'country_id')], limit=1
        )
        self.f_state = F.search(base + [('name', '=', 'state_id')], limit=1)
        self.f_lat = F.search(
            base + [('name', '=', 'partner_latitude')], limit=1
        )
        self.f_lng = F.search(
            base + [('name', '=', 'partner_longitude')], limit=1
        )

        self.mapping = self.env['google.places.mapping'].create(
            {
                'code': 'test_parse',
                'mode': 'address',
                'model_id': partner_model.id,
                'gplace_address_fetch_fields': "['addressComponents', 'location']",
                'latitude': self.f_lat.id,
                'longitude': self.f_lng.id,
                'mapping_address_ids': [
                    Command.create(
                        {
                            'field_id': self.f_city.id,
                            'gplace_component': "['locality']",
                            'handling_mode': 'direct',
                            'text_option': 'shortText',
                        }
                    ),
                    Command.create(
                        {
                            'field_id': self.f_zip.id,
                            'gplace_component': "['postal_code']",
                            'handling_mode': 'direct',
                            'text_option': 'shortText',
                        }
                    ),
                    Command.create(
                        {
                            'field_id': self.f_street.id,
                            'gplace_component': "['street_number', 'route']",
                            'handling_mode': 'concat',
                            'separator': 'space',
                            'text_option': 'shortText',
                        }
                    ),
                    Command.create(
                        {
                            'field_id': self.f_country.id,
                            'gplace_component': "['country']",
                            'handling_mode': 'direct',
                            'text_option': 'shortText',
                        }
                    ),
                    Command.create(
                        {
                            'field_id': self.f_state.id,
                            'gplace_component': "['administrative_area_level_1']",
                            'handling_mode': 'direct',
                            'text_option': 'shortText',
                        }
                    ),
                ],
            }
        )

        # Use is_mapping_test=True so parse_place skips the sudo() branch;
        # tests run as superuser already, but being explicit avoids context drift.
        self.Mapping = self.env['google.places.mapping'].with_context(
            is_mapping_test=True
        )

        # Base place dict reused across tests
        self.nz = self.env.ref('base.nz')
        self.base_place = {
            'addressComponents': [
                {
                    'types': ['street_number'],
                    'shortText': '10',
                    'longText': '10',
                },
                {
                    'types': ['route'],
                    'shortText': 'Willis St',
                    'longText': 'Willis Street',
                },
                {
                    'types': ['locality'],
                    'shortText': 'Wellington',
                    'longText': 'Wellington City',
                },
                {
                    'types': ['postal_code'],
                    'shortText': '6011',
                    'longText': '6011',
                },
                {
                    'types': ['country'],
                    'shortText': 'NZ',
                    'longText': 'New Zealand',
                },
            ],
            'location': {'lat': -41.2865, 'lng': 174.7762},
        }


# ---------------------------------------------------------------------------
# adjust_address_components
# ---------------------------------------------------------------------------


class TestAdjustAddressComponents(ParsePlaceBase):

    def test_no_op_when_address_components_empty(self):
        # Returns the empty list unchanged — not None — because the early-return
        # path does `return address_components`, not `return None`.
        result = self.Mapping.adjust_address_components(
            [], {'street_number': '5'}
        )
        self.assertEqual(result, [])

    def test_no_op_when_street_address_none(self):
        components = [{'types': ['locality'], 'shortText': 'Auckland'}]
        self.Mapping.adjust_address_components(components, None)
        self.assertEqual(len(components), 1)

    def test_no_op_when_street_address_empty_dict(self):
        components = [{'types': ['locality'], 'shortText': 'Auckland'}]
        self.Mapping.adjust_address_components(components, {})
        self.assertEqual(len(components), 1)

    def test_appends_street_number_when_missing(self):
        components = [
            {
                'types': ['route'],
                'shortText': 'Main St',
                'longText': 'Main Street',
            }
        ]
        self.Mapping.adjust_address_components(
            components, {'street_number': '42'}
        )
        self.assertEqual(len(components), 2)
        added = components[-1]
        self.assertIn('street_number', added['types'])
        self.assertEqual(added['shortText'], '42')
        self.assertEqual(added['longText'], '42')

    def test_does_not_append_when_street_number_already_present(self):
        components = [
            {'types': ['street_number'], 'shortText': '99', 'longText': '99'},
            {
                'types': ['route'],
                'shortText': 'Main St',
                'longText': 'Main Street',
            },
        ]
        self.Mapping.adjust_address_components(
            components, {'street_number': '42'}
        )
        self.assertEqual(len(components), 2)
        self.assertEqual(components[0]['shortText'], '99')

    def test_does_not_append_when_street_number_value_empty(self):
        components = [
            {
                'types': ['route'],
                'shortText': 'Main St',
                'longText': 'Main Street',
            }
        ]
        self.Mapping.adjust_address_components(
            components, {'street_number': ''}
        )
        self.assertEqual(len(components), 1)

    def test_no_op_when_both_arguments_falsy(self):
        result = self.Mapping.adjust_address_components(None, None)
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# _build_component_lookup
# ---------------------------------------------------------------------------


class TestBuildComponentLookup(ParsePlaceBase):

    def test_empty_list_returns_empty_dict(self):
        self.assertEqual(self.Mapping._build_component_lookup([]), {})

    def test_single_type_component_is_indexed(self):
        comp = {'types': ['locality'], 'shortText': 'Auckland'}
        lookup = self.Mapping._build_component_lookup([comp])
        self.assertIn('locality', lookup)
        self.assertEqual(lookup['locality']['shortText'], 'Auckland')

    def test_multi_type_component_is_indexed_under_all_types(self):
        """A component with multiple types must be reachable by any of them."""
        comp = {'types': ['political', 'locality'], 'shortText': 'Auckland'}
        lookup = self.Mapping._build_component_lookup([comp])
        self.assertIn('political', lookup)
        self.assertIn('locality', lookup)

    def test_later_component_overwrites_earlier_for_same_type(self):
        comp1 = {'types': ['locality'], 'shortText': 'First'}
        comp2 = {'types': ['locality'], 'shortText': 'Second'}
        lookup = self.Mapping._build_component_lookup([comp1, comp2])
        self.assertEqual(lookup['locality']['shortText'], 'Second')

    def test_multiple_distinct_components_all_indexed(self):
        components = [
            {'types': ['street_number'], 'shortText': '10'},
            {'types': ['route'], 'shortText': 'Willis St'},
            {'types': ['locality'], 'shortText': 'Wellington'},
            {'types': ['country'], 'shortText': 'NZ'},
        ]
        lookup = self.Mapping._build_component_lookup(components)
        self.assertEqual(len(lookup), 4)
        self.assertEqual(lookup['route']['shortText'], 'Willis St')


# ---------------------------------------------------------------------------
# parse_geolocation
# ---------------------------------------------------------------------------


class TestParseGeolocation(ParsePlaceBase):

    def test_returns_empty_dict_when_no_location(self):
        result = self.Mapping.parse_geolocation(self.mapping, {})
        self.assertEqual(result, {})

    def test_returns_empty_dict_when_location_none(self):
        result = self.Mapping.parse_geolocation(self.mapping, None)
        self.assertEqual(result, {})

    def test_returns_empty_dict_when_mapping_has_no_lat_lng_fields(self):
        mapping_no_geo = self.env['google.places.mapping'].create(
            {
                'code': 'test_no_geo',
                'mode': 'address',
                'model_id': self.mapping.model_id.id,
                'gplace_address_fetch_fields': "['addressComponents']",
            }
        )
        result = self.Mapping.parse_geolocation(
            mapping_no_geo, {'lat': -41.2, 'lng': 174.7}
        )
        self.assertEqual(result, {})

    def test_maps_lat_lng_to_configured_fields(self):
        result = self.Mapping.parse_geolocation(
            self.mapping, {'lat': -41.2865, 'lng': 174.7762}
        )
        self.assertIn('partner_latitude', result)
        self.assertIn('partner_longitude', result)
        self.assertAlmostEqual(result['partner_latitude'], -41.2865)
        self.assertAlmostEqual(result['partner_longitude'], 174.7762)

    def test_negative_coordinates_preserved(self):
        result = self.Mapping.parse_geolocation(
            self.mapping, {'lat': -33.8688, 'lng': 151.2093}
        )
        self.assertAlmostEqual(result['partner_latitude'], -33.8688)
        self.assertAlmostEqual(result['partner_longitude'], 151.2093)


# ---------------------------------------------------------------------------
# parse_place — end-to-end
# ---------------------------------------------------------------------------


class TestParsePlaceEndToEnd(ParsePlaceBase):

    def test_unknown_code_returns_empty_dict(self):
        result = self.Mapping.parse_place({}, 'nonexistent_code')
        self.assertEqual(result, {})

    def test_result_has_required_top_level_keys(self):
        result = self.Mapping.parse_place(self.base_place, 'test_parse')
        self.assertIn('mode', result)
        self.assertIn('address', result)
        self.assertIn('geolocation', result)
        self.assertIn('other', result)

    def test_mode_is_address(self):
        result = self.Mapping.parse_place(self.base_place, 'test_parse')
        self.assertEqual(result['mode'], 'address')

    def test_city_resolved_from_locality(self):
        result = self.Mapping.parse_place(self.base_place, 'test_parse')
        self.assertEqual(result['address'].get('city'), 'Wellington')

    def test_zip_resolved_from_postal_code(self):
        result = self.Mapping.parse_place(self.base_place, 'test_parse')
        self.assertEqual(result['address'].get('zip'), '6011')

    def test_country_resolved_as_relational(self):
        result = self.Mapping.parse_place(self.base_place, 'test_parse')
        country_val = result['address'].get('country_id')
        self.assertIsInstance(country_val, dict)
        self.assertEqual(country_val.get('id'), self.nz.id)

    def test_geolocation_populated(self):
        result = self.Mapping.parse_place(self.base_place, 'test_parse')
        self.assertAlmostEqual(
            result['geolocation'].get('partner_latitude'), -41.2865
        )
        self.assertAlmostEqual(
            result['geolocation'].get('partner_longitude'), 174.7762
        )

    def test_missing_component_returns_empty_string_for_text_field(self):
        place = {
            'addressComponents': [
                # locality present but postal_code absent
                {
                    'types': ['locality'],
                    'shortText': 'Wellington',
                    'longText': 'Wellington City',
                },
                {
                    'types': ['country'],
                    'shortText': 'NZ',
                    'longText': 'New Zealand',
                },
            ],
            'location': {'lat': -41.2865, 'lng': 174.7762},
        }
        result = self.Mapping.parse_place(place, 'test_parse')
        # city present, zip absent → empty
        self.assertEqual(result['address'].get('city'), 'Wellington')
        self.assertEqual(result['address'].get('zip', ''), '')

    def test_empty_address_components_returns_empty_address(self):
        place = {'addressComponents': [], 'location': {}}
        result = self.Mapping.parse_place(place, 'test_parse')
        self.assertEqual(result['address'], {})

    def test_none_address_components_returns_empty_address(self):
        place = {'addressComponents': None, 'location': {}}
        result = self.Mapping.parse_place(place, 'test_parse')
        self.assertEqual(result['address'], {})

    def test_street_number_injection_via_street_number_param(self):
        """Manually provided street_number is merged when absent from components."""
        place = {
            'addressComponents': [
                {
                    'types': ['route'],
                    'shortText': 'Willis St',
                    'longText': 'Willis Street',
                },
                {
                    'types': ['locality'],
                    'shortText': 'Wellington',
                    'longText': 'Wellington City',
                },
                {
                    'types': ['country'],
                    'shortText': 'NZ',
                    'longText': 'New Zealand',
                },
            ],
            'location': {},
        }
        result = self.Mapping.parse_place(
            place, 'test_parse', street_number={'street_number': '10'}
        )
        street = result['address'].get('street', '')
        self.assertIn('10', street)
        self.assertIn('Willis St', street)


# ---------------------------------------------------------------------------
# Street formatting by country convention
# ---------------------------------------------------------------------------


class TestStreetFormatting(ParsePlaceBase):

    def _place_with_street(self):
        return {
            'addressComponents': [
                {
                    'types': ['street_number'],
                    'shortText': '10',
                    'longText': '10',
                },
                {
                    'types': ['route'],
                    'shortText': 'Willis St',
                    'longText': 'Willis Street',
                },
                {
                    'types': ['country'],
                    'shortText': 'NZ',
                    'longText': 'New Zealand',
                },
            ],
            'location': {},
        }

    def test_route_street_number_format(self):
        """Default format: route first, then street number (e.g. 'Willis St 10')."""
        self.nz.google_street_format = 'route_street_number'
        result = self.Mapping.parse_place(
            self._place_with_street(), 'test_parse'
        )
        street = result['address'].get('street', '')
        self.assertTrue(
            street.index('Willis St') < street.index('10'),
            f"Expected route before number, got: {street!r}",
        )

    def test_street_number_route_format(self):
        """US-style: number first, then route (e.g. '10 Willis St')."""
        self.nz.google_street_format = 'street_number_route'
        result = self.Mapping.parse_place(
            self._place_with_street(), 'test_parse'
        )
        street = result['address'].get('street', '')
        self.assertTrue(
            street.index('10') < street.index('Willis St'),
            f"Expected number before route, got: {street!r}",
        )

    def test_street_contains_both_parts(self):
        result = self.Mapping.parse_place(
            self._place_with_street(), 'test_parse'
        )
        street = result['address'].get('street', '')
        self.assertIn('Willis St', street)
        self.assertIn('10', street)


# ---------------------------------------------------------------------------
# Text field handling modes (direct / fallback / concat)
# ---------------------------------------------------------------------------


class TestAddressTextHandlingModes(ParsePlaceBase):

    def setUp(self):
        super().setUp()
        partner_model = self.mapping.model_id
        F = self.env['ir.model.fields']

        self.mapping_modes = self.env['google.places.mapping'].create(
            {
                'code': 'test_modes',
                'mode': 'address',
                'model_id': partner_model.id,
                'gplace_address_fetch_fields': "['addressComponents']",
                'mapping_address_ids': [
                    # direct: use first component only
                    Command.create(
                        {
                            'field_id': self.f_city.id,
                            'gplace_component': "['locality']",
                            'handling_mode': 'direct',
                            'text_option': 'shortText',
                        }
                    ),
                    # fallback: first available among two
                    Command.create(
                        {
                            'field_id': self.f_zip.id,
                            'gplace_component': "['postal_code', 'postal_town']",
                            'handling_mode': 'fallback',
                            'text_option': 'shortText',
                        }
                    ),
                    # concat: join both with comma separator
                    Command.create(
                        {
                            'field_id': self.f_street.id,
                            'gplace_component': "['street_number', 'route']",
                            'handling_mode': 'concat',
                            'separator': 'comma',
                            'text_option': 'shortText',
                        }
                    ),
                ],
            }
        )

    def test_direct_uses_first_component_value(self):
        place = {
            'addressComponents': [
                {
                    'types': ['locality'],
                    'shortText': 'Auckland',
                    'longText': 'Auckland City',
                },
            ],
            'location': {},
        }
        result = self.Mapping.parse_place(place, 'test_modes')
        self.assertEqual(result['address'].get('city'), 'Auckland')

    def test_fallback_uses_first_available_component(self):
        """postal_code present → use it."""
        place = {
            'addressComponents': [
                {
                    'types': ['postal_code'],
                    'shortText': '1010',
                    'longText': '1010',
                },
                {
                    'types': ['postal_town'],
                    'shortText': 'CBD',
                    'longText': 'Central Business District',
                },
            ],
            'location': {},
        }
        result = self.Mapping.parse_place(place, 'test_modes')
        self.assertEqual(result['address'].get('zip'), '1010')

    def test_fallback_falls_through_to_second_when_first_missing(self):
        """postal_code absent → fall through to postal_town."""
        place = {
            'addressComponents': [
                {
                    'types': ['postal_town'],
                    'shortText': 'CBD',
                    'longText': 'Central Business District',
                },
            ],
            'location': {},
        }
        result = self.Mapping.parse_place(place, 'test_modes')
        self.assertEqual(result['address'].get('zip'), 'CBD')

    def test_fallback_returns_empty_when_no_component_found(self):
        place = {'addressComponents': [], 'location': {}}
        result = self.Mapping.parse_place(place, 'test_modes')
        self.assertEqual(result['address'].get('zip', ''), '')

    def test_concat_joins_all_components_with_separator(self):
        """street_number + route joined by comma separator (', ')."""
        place = {
            'addressComponents': [
                {
                    'types': ['street_number'],
                    'shortText': '5',
                    'longText': '5',
                },
                {
                    'types': ['route'],
                    'shortText': 'Queen St',
                    'longText': 'Queen Street',
                },
            ],
            'location': {},
        }
        result = self.Mapping.parse_place(place, 'test_modes')
        # separator='comma' maps to ', ' in SEPARATOR_SYMBOL
        street = result['address'].get('street', '')
        self.assertIn('5', street)
        self.assertIn('Queen St', street)

    def test_concat_with_only_one_component_present_returns_that_value(self):
        """Concat with only one available component returns that value."""
        place = {
            'addressComponents': [
                {
                    'types': ['route'],
                    'shortText': 'Queen St',
                    'longText': 'Queen Street',
                },
            ],
            'location': {},
        }
        result = self.Mapping.parse_place(place, 'test_modes')
        street = result['address'].get('street', '')
        self.assertIn('Queen St', street)

    def test_direct_with_long_text_option(self):
        """text_option='longText' returns the long form of the component."""
        partner_model = self.mapping.model_id
        mapping_long = self.env['google.places.mapping'].create(
            {
                'code': 'test_long_text',
                'mode': 'address',
                'model_id': partner_model.id,
                'gplace_address_fetch_fields': "['addressComponents']",
                'mapping_address_ids': [
                    Command.create(
                        {
                            'field_id': self.f_city.id,
                            'gplace_component': "['locality']",
                            'handling_mode': 'direct',
                            'text_option': 'longText',
                        }
                    ),
                ],
            }
        )
        place = {
            'addressComponents': [
                {
                    'types': ['locality'],
                    'shortText': 'Auckland',
                    'longText': 'Auckland City',
                },
            ],
            'location': {},
        }
        result = self.Mapping.parse_place(place, 'test_long_text')
        self.assertEqual(result['address'].get('city'), 'Auckland City')


# ---------------------------------------------------------------------------
# State resolution (country-scoped)
# ---------------------------------------------------------------------------


class TestStateResolution(ParsePlaceBase):

    def test_state_resolved_within_country_context(self):
        """State lookup is scoped to the resolved country — prevents cross-country matches."""
        us = self.env.ref('base.us')
        ca_state = self.env['res.country.state'].search(
            [('country_id', '=', us.id), ('code', '=', 'CA')], limit=1
        )
        if not ca_state:
            self.skipTest('California state not found in base data')

        partner_model = self.mapping.model_id
        mapping_us = self.env['google.places.mapping'].create(
            {
                'code': 'test_state_us',
                'mode': 'address',
                'model_id': partner_model.id,
                'gplace_address_fetch_fields': "['addressComponents']",
                'mapping_address_ids': [
                    Command.create(
                        {
                            'field_id': self.f_country.id,
                            'gplace_component': "['country']",
                            'handling_mode': 'direct',
                            'text_option': 'shortText',
                        }
                    ),
                    Command.create(
                        {
                            'field_id': self.f_state.id,
                            'gplace_component': "['administrative_area_level_1']",
                            'handling_mode': 'direct',
                            'text_option': 'shortText',
                        }
                    ),
                ],
            }
        )

        place = {
            'addressComponents': [
                {
                    'types': ['country'],
                    'shortText': 'US',
                    'longText': 'United States',
                },
                {
                    'types': ['administrative_area_level_1'],
                    'shortText': 'CA',
                    'longText': 'California',
                },
            ],
            'location': {},
        }
        result = self.Mapping.parse_place(place, 'test_state_us')
        country_val = result['address'].get('country_id')
        state_val = result['address'].get('state_id')

        self.assertIsNotNone(country_val)
        self.assertEqual(country_val.get('id'), us.id)

        if state_val:
            self.assertEqual(state_val.get('id'), ca_state.id)


# ---------------------------------------------------------------------------
# parse_others (places mode)
# ---------------------------------------------------------------------------


class TestParseOthers(ParsePlaceBase):

    def setUp(self):
        super().setUp()
        partner_model = self.mapping.model_id
        F = self.env['ir.model.fields']
        base = [('model_id', '=', partner_model.id)]
        self.f_name = F.search(base + [('name', '=', 'name')], limit=1)

        self.mapping_places = self.env['google.places.mapping'].create(
            {
                'code': 'test_others',
                'mode': 'places',
                'model_id': partner_model.id,
                'gplace_place_fetch_fields': "['displayName', 'internationalPhoneNumber']",
                'mapping_other_ids': [
                    Command.create(
                        {
                            'field_id': self.f_name.id,
                            'gplace_component': "'displayName'",
                        }
                    ),
                ],
            }
        )

    def test_other_field_mapped_from_place(self):
        place = {
            'displayName': 'Wellington Cafe',
            'addressComponents': [],
            'location': {},
        }
        result = self.Mapping.parse_place(place, 'test_others')
        self.assertEqual(result['other'].get('name'), 'Wellington Cafe')

    def test_missing_other_component_returns_false(self):
        place = {
            'addressComponents': [],
            'location': {},
        }
        result = self.Mapping.parse_place(place, 'test_others')
        self.assertFalse(result['other'].get('name'))

    def test_other_dict_is_empty_for_address_mode(self):
        """parse_place sets other={} when mode is 'address'."""
        result = self.Mapping.parse_place(self.base_place, 'test_parse')
        self.assertEqual(result['other'], {})
