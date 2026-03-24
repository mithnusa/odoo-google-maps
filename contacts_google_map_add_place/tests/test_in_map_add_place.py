# -*- coding: utf-8 -*-
"""
Test suite for contacts_google_map_add_place ResPartner model methods.

Covers:
- action_in_map_google_place_create
- action_in_map_google_place_from_reverse_geocode
- _parse_adr_format_address
- _parse_formatted_address
- _mapping_address
- _prepare_geolocation_fields
- _get_mapping_odoo_fields
"""
from odoo.tests.common import TransactionCase

# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

SAMPLE_ADDRESS_COMPONENTS = [
    {"types": ["street_number"], "longText": "33", "shortText": "33"},
    {"types": ["route"], "longText": "Ihimaera Terrace", "shortText": "Ihimaera Terrace"},
    {"types": ["locality"], "longText": "Leamington", "shortText": "Leamington"},
    {"types": ["postal_code"], "longText": "3432", "shortText": "3432"},
    {"types": ["administrative_area_level_1"], "longText": "Waikato", "shortText": "WKO"},
    {"types": ["country"], "longText": "New Zealand", "shortText": "NZ"},
]

SAMPLE_ADR_FORMAT_ADDRESS = (
    '<span class="street-address">33 Ihimaera Terrace</span>, '
    '<span class="locality">Leamington</span>, '
    '<span class="postal-code">3432</span>, '
    '<span class="region">Waikato</span>, '
    '<span class="country-name">New Zealand</span>'
)

SAMPLE_PLACE = {
    "placeId": "ChIJtest1234",
    "displayName": "Test Café",
    "websiteURI": "https://testcafe.example.com",
    "internationalPhoneNumber": "+64 7 123 4567",
    "addressComponents": SAMPLE_ADDRESS_COMPONENTS,
    "adrFormatAddress": SAMPLE_ADR_FORMAT_ADDRESS,
    "location": {"lat": -37.8736, "lng": 175.5456},
}

SAMPLE_GEOCODING = {
    "place_id": "ChIJgeotest5678",
    "address_components": [
        {"types": ["street_number"], "long_name": "1600", "short_name": "1600"},
        {"types": ["route"], "long_name": "Amphitheatre Pkwy", "short_name": "Amphitheatre Pkwy"},
        {"types": ["locality"], "long_name": "Mountain View", "short_name": "Mountain View"},
        {"types": ["administrative_area_level_1"], "long_name": "California", "short_name": "CA"},
        {"types": ["postal_code"], "long_name": "94043", "short_name": "94043"},
        {"types": ["country"], "long_name": "United States", "short_name": "US"},
    ],
    "formatted_address": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
    "geometry": {
        "location": {"lat": 37.4224764, "lng": -122.0842499}
    },
}


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _create_partner(env, name, gplace_id=None):
    """Create a res.partner record for use in tests."""
    vals = {"name": name}
    if gplace_id:
        vals["gplace_id"] = gplace_id
    return env["res.partner"].create(vals)


# ---------------------------------------------------------------------------
# _get_mapping_odoo_fields
# ---------------------------------------------------------------------------

class TestGetMappingOdooFields(TransactionCase):
    """Tests for _get_mapping_odoo_fields."""

    def setUp(self):
        super().setUp()
        self.partner = self.env["res.partner"]

    def test_returns_dict(self):
        """Should return a dict."""
        result = self.partner._get_mapping_odoo_fields()
        self.assertIsInstance(result, dict)

    def test_contains_required_keys(self):
        """Should include all standard address and contact aliases."""
        result = self.partner._get_mapping_odoo_fields()
        for key in ("name", "street", "city", "zip", "state_id", "country_id", "lat", "lng", "phone", "website"):
            self.assertIn(key, result, f"Missing key '{key}' in field mapping")

    def test_lat_lng_map_to_partner_fields(self):
        """lat/lng aliases should resolve to partner_latitude/partner_longitude."""
        result = self.partner._get_mapping_odoo_fields()
        self.assertEqual(result["lat"], "partner_latitude")
        self.assertEqual(result["lng"], "partner_longitude")


# ---------------------------------------------------------------------------
# _prepare_geolocation_fields
# ---------------------------------------------------------------------------

class TestPrepareGeolocationFields(TransactionCase):
    """Tests for _prepare_geolocation_fields."""

    def setUp(self):
        super().setUp()
        self.partner = self.env["res.partner"]
        self.odoo_fields = self.partner._get_mapping_odoo_fields()

    def test_valid_coordinates(self):
        """Should return lat/lng Odoo field names with float values."""
        location = {"lat": -37.8736, "lng": 175.5456}
        result = self.partner._prepare_geolocation_fields(self.odoo_fields, location)
        self.assertIn("partner_latitude", result)
        self.assertIn("partner_longitude", result)
        self.assertAlmostEqual(result["partner_latitude"], -37.8736)
        self.assertAlmostEqual(result["partner_longitude"], 175.5456)

    def test_empty_location_dict(self):
        """Should return empty dict when location is empty."""
        result = self.partner._prepare_geolocation_fields(self.odoo_fields, {})
        self.assertEqual(result, {})

    def test_missing_lat(self):
        """Should return empty dict when lat is missing from location."""
        result = self.partner._prepare_geolocation_fields(self.odoo_fields, {"lng": 175.5})
        self.assertEqual(result, {})

    def test_missing_lng(self):
        """Should return empty dict when lng is missing from location."""
        result = self.partner._prepare_geolocation_fields(self.odoo_fields, {"lat": -37.8})
        self.assertEqual(result, {})

    def test_zero_coordinates(self):
        """Zero lat/lng (falsy) should NOT populate geolocation fields."""
        result = self.partner._prepare_geolocation_fields(self.odoo_fields, {"lat": 0, "lng": 0})
        self.assertEqual(result, {})


# ---------------------------------------------------------------------------
# _parse_adr_format_address
# ---------------------------------------------------------------------------

class TestParseAdrFormatAddress(TransactionCase):
    """Tests for _parse_adr_format_address."""

    def setUp(self):
        super().setUp()
        self.partner = self.env["res.partner"]

    def test_none_input_returns_empty(self):
        """None input should return empty dict."""
        self.assertEqual(self.partner._parse_adr_format_address(None), {})

    def test_empty_string_returns_empty(self):
        """Empty string input should return empty dict."""
        self.assertEqual(self.partner._parse_adr_format_address(""), {})

    def test_parses_street_address(self):
        """Should extract street-address span content."""
        html = '<span class="street-address">33 Ihimaera Terrace</span>'
        result = self.partner._parse_adr_format_address(html)
        self.assertEqual(result.get("street-address"), "33 Ihimaera Terrace")

    def test_parses_multiple_components(self):
        """Should extract all span components by their class names."""
        result = self.partner._parse_adr_format_address(SAMPLE_ADR_FORMAT_ADDRESS)
        self.assertEqual(result.get("street-address"), "33 Ihimaera Terrace")
        self.assertEqual(result.get("locality"), "Leamington")
        self.assertEqual(result.get("postal-code"), "3432")
        self.assertEqual(result.get("region"), "Waikato")

    def test_strips_whitespace(self):
        """Should strip leading/trailing whitespace from span text."""
        html = '<span class="locality">  Auckland  </span>'
        result = self.partner._parse_adr_format_address(html)
        self.assertEqual(result.get("locality"), "Auckland")

    def test_span_without_class_ignored(self):
        """Spans without a class attribute should not appear in the result."""
        html = '<span>No class here</span><span class="locality">City</span>'
        result = self.partner._parse_adr_format_address(html)
        self.assertNotIn(None, result)
        self.assertEqual(result.get("locality"), "City")


# ---------------------------------------------------------------------------
# _parse_formatted_address
# ---------------------------------------------------------------------------

class TestParseFormattedAddress(TransactionCase):
    """Tests for _parse_formatted_address."""

    def setUp(self):
        super().setUp()
        self.partner = self.env["res.partner"]

    def test_none_returns_empty(self):
        self.assertEqual(self.partner._parse_formatted_address(None), {})

    def test_empty_string_returns_empty(self):
        self.assertEqual(self.partner._parse_formatted_address(""), {})

    def test_standard_three_segment(self):
        """Standard 3-segment: 'street, city zip, country'."""
        result = self.partner._parse_formatted_address(
            "33 Ihimaera Terrace, Leamington 3432, New Zealand"
        )
        self.assertEqual(result["street-address"], "33 Ihimaera Terrace")
        self.assertEqual(result["locality"], "Leamington")
        self.assertEqual(result["postal-code"], "3432")
        self.assertEqual(result["country"], "New Zealand")

    def test_standard_four_segment(self):
        """Standard 4-segment: 'street, city, state zip, country'."""
        result = self.partner._parse_formatted_address(
            "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA"
        )
        self.assertEqual(result["street-address"], "1600 Amphitheatre Pkwy")
        self.assertEqual(result["locality"], "Mountain View")
        self.assertEqual(result["postal-code"], "94043")
        self.assertEqual(result["region"], "CA")
        self.assertEqual(result["country"], "USA")

    def test_russian_cis_style(self):
        """Russian/CIS style: last segment is a pure-digit postal code."""
        result = self.partner._parse_formatted_address(
            "ул. Ленина 5, Москва, Россия, 123456"
        )
        self.assertEqual(result["postal-code"], "123456")
        self.assertEqual(result["country"], "Россия")
        self.assertEqual(result["locality"], "Москва")

    def test_two_segment_address(self):
        """Two segments: 'street, country' — should set street and country only."""
        result = self.partner._parse_formatted_address("Main Street, France")
        self.assertEqual(result["street-address"], "Main Street")
        self.assertEqual(result["country"], "France")
        self.assertNotIn("locality", result)

    def test_single_segment_address(self):
        """Single segment: only street-address set."""
        result = self.partner._parse_formatted_address("Main Street")
        self.assertEqual(result["street-address"], "Main Street")
        self.assertNotIn("country", result)

    def test_five_plus_segments_sets_extended_address(self):
        """5+ segments should populate extended-address from middle parts."""
        result = self.partner._parse_formatted_address(
            "1 Main St, Suite 100, Apt 4, San Francisco, CA 94105, USA"
        )
        self.assertIn("extended-address", result)
        self.assertEqual(result["country"], "USA")


# ---------------------------------------------------------------------------
# _mapping_address
# ---------------------------------------------------------------------------

class TestMappingAddress(TransactionCase):
    """Tests for _mapping_address."""

    def setUp(self):
        super().setUp()
        self.partner = self.env["res.partner"]
        self.adr = self.partner._parse_adr_format_address(SAMPLE_ADR_FORMAT_ADDRESS)

    def test_maps_street_from_components(self):
        """Should combine route and street_number into a street string."""
        result = self.partner._mapping_address(SAMPLE_ADDRESS_COMPONENTS, self.adr)
        # adrFormatAddress takes priority for street — verify it is set
        self.assertIn("street", result)
        self.assertIsNotNone(result["street"])

    def test_maps_city(self):
        """Should set city from locality component."""
        result = self.partner._mapping_address(SAMPLE_ADDRESS_COMPONENTS, self.adr)
        self.assertEqual(result.get("city"), "Leamington")

    def test_maps_zip(self):
        """Should set zip from postal_code component."""
        result = self.partner._mapping_address(SAMPLE_ADDRESS_COMPONENTS, self.adr)
        self.assertEqual(result.get("zip"), "3432")

    def test_resolves_country_id(self):
        """Should resolve country string to res.country record ID."""
        result = self.partner._mapping_address(SAMPLE_ADDRESS_COMPONENTS, self.adr)
        country_id = result.get("country_id")
        self.assertTrue(country_id, "country_id should be resolved to a non-falsy record ID")
        country = self.env["res.country"].browse(country_id)
        self.assertTrue(country.exists())

    def test_resolves_state_id(self):
        """Should resolve state string to res.country.state record ID (if exists)."""
        result = self.partner._mapping_address(SAMPLE_ADDRESS_COMPONENTS, self.adr)
        # state_id may be False if the state doesn't exist in the test DB — assert it's int or False
        self.assertIn("state_id", result)
        state_val = result["state_id"]
        self.assertIn(type(state_val), (int, bool), "state_id should be an int (record ID) or False")

    def test_empty_components_uses_adr_fallback(self):
        """With empty address_components, should fall back to adr parsed values."""
        result = self.partner._mapping_address([], self.adr)
        self.assertEqual(result.get("city"), "Leamington")
        self.assertEqual(result.get("zip"), "3432")

    def test_adr_street_takes_priority_over_components(self):
        """adrFormatAddress street-address should override component-derived street."""
        result = self.partner._mapping_address(SAMPLE_ADDRESS_COMPONENTS, self.adr)
        self.assertIn("33 Ihimaera Terrace", result.get("street", ""))


# ---------------------------------------------------------------------------
# action_in_map_google_place_create
# ---------------------------------------------------------------------------

class TestActionInMapGooglePlaceCreate(TransactionCase):
    """Tests for action_in_map_google_place_create."""

    def setUp(self):
        super().setUp()
        self.partner_model = self.env["res.partner"]

    # --- Return type ----------------------------------------------------

    def test_returns_act_window_action(self):
        """Should always return an ir.actions.act_window dict."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        self.assertEqual(result["type"], "ir.actions.act_window")
        self.assertEqual(result["res_model"], "res.partner")

    def test_opens_in_popup(self):
        """Action should open in a dialog (target='new')."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        self.assertEqual(result["target"], "new")

    # --- New place (no existing partner) --------------------------------

    def test_new_place_has_no_res_id(self):
        """Action for a new place should NOT set res_id (opens create form)."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        self.assertFalse(result.get("res_id"))

    def test_new_place_populates_name_default(self):
        """Context defaults should include the place displayName."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        ctx = result.get("context", {})
        self.assertEqual(ctx.get("default_name"), "Test Café")

    def test_new_place_populates_website_default(self):
        """Context defaults should include the place websiteURI."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        ctx = result.get("context", {})
        self.assertEqual(ctx.get("default_website"), "https://testcafe.example.com")

    def test_new_place_populates_phone_default(self):
        """Context defaults should include the place internationalPhoneNumber."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        ctx = result.get("context", {})
        self.assertEqual(ctx.get("default_phone"), "+64 7 123 4567")

    def test_new_place_populates_gplace_id_default(self):
        """Context defaults should include the Google Place ID."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        ctx = result.get("context", {})
        self.assertEqual(ctx.get("default_gplace_id"), "ChIJtest1234")

    def test_new_place_populates_coordinates(self):
        """Context defaults should include lat/lng from location."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        ctx = result.get("context", {})
        self.assertAlmostEqual(ctx.get("default_partner_latitude"), -37.8736)
        self.assertAlmostEqual(ctx.get("default_partner_longitude"), 175.5456)

    def test_new_place_populates_city(self):
        """Context defaults should include the resolved city."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        ctx = result.get("context", {})
        self.assertEqual(ctx.get("default_city"), "Leamington")

    def test_new_place_populates_zip(self):
        """Context defaults should include the postal code."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        ctx = result.get("context", {})
        self.assertEqual(ctx.get("default_zip"), "3432")

    def test_new_place_resolves_country(self):
        """Context defaults should include a resolved country_id integer."""
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        ctx = result.get("context", {})
        country_id = ctx.get("default_country_id")
        self.assertTrue(country_id)
        self.assertTrue(self.env["res.country"].browse(country_id).exists())

    # --- Non-http website should be rejected ----------------------------

    def test_non_http_website_excluded(self):
        """websiteURI not starting with http/https should not be set."""
        place = {**SAMPLE_PLACE, "websiteURI": "ftp://insecure.example.com"}
        result = self.partner_model.action_in_map_google_place_create(place)
        ctx = result.get("context", {})
        self.assertNotIn("default_website", ctx)

    # --- Missing optional fields ----------------------------------------

    def test_place_without_display_name(self):
        """Missing displayName should not set default_name in context."""
        place = {k: v for k, v in SAMPLE_PLACE.items() if k != "displayName"}
        result = self.partner_model.action_in_map_google_place_create(place)
        ctx = result.get("context", {})
        self.assertNotIn("default_name", ctx)

    def test_place_without_location(self):
        """Missing location should not set lat/lng defaults."""
        place = {k: v for k, v in SAMPLE_PLACE.items() if k != "location"}
        result = self.partner_model.action_in_map_google_place_create(place)
        ctx = result.get("context", {})
        self.assertNotIn("default_partner_latitude", ctx)
        self.assertNotIn("default_partner_longitude", ctx)

    def test_place_without_address_components(self):
        """Missing addressComponents should still return a valid action."""
        place = {k: v for k, v in SAMPLE_PLACE.items() if k != "addressComponents"}
        result = self.partner_model.action_in_map_google_place_create(place)
        self.assertEqual(result["type"], "ir.actions.act_window")

    def test_place_without_place_id(self):
        """Place with no placeId should still return a create action."""
        place = {k: v for k, v in SAMPLE_PLACE.items() if k != "placeId"}
        result = self.partner_model.action_in_map_google_place_create(place)
        self.assertEqual(result["type"], "ir.actions.act_window")
        self.assertFalse(result.get("res_id"))

    # --- Deduplication: existing partner --------------------------------

    def test_existing_partner_returns_edit_action(self):
        """When a partner with the same gplace_id exists, action should open that record."""
        existing = _create_partner(self.env, "Existing Café", gplace_id="ChIJtest1234")
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        self.assertEqual(result.get("res_id"), existing.id)

    def test_existing_partner_action_has_contact_name_in_title(self):
        """The action name should mention the existing partner's name."""
        _create_partner(self.env, "Existing Café", gplace_id="ChIJtest1234")
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        self.assertIn("Existing Café", result.get("name", ""))

    def test_existing_partner_action_opens_in_popup(self):
        """The deduplication action should also open in a dialog."""
        _create_partner(self.env, "Existing Café", gplace_id="ChIJtest1234")
        result = self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        self.assertEqual(result["target"], "new")

    def test_no_duplicate_created_for_same_place_id(self):
        """Calling the method twice with the same placeId should not create a second partner."""
        _create_partner(self.env, "Existing Café", gplace_id="ChIJtest1234")
        count_before = self.partner_model.search_count(
            [("gplace_id", "=", "ChIJtest1234")]
        )
        # The method detects the existing partner and returns early — no new record is created
        self.partner_model.action_in_map_google_place_create(SAMPLE_PLACE)
        count_after = self.partner_model.search_count(
            [("gplace_id", "=", "ChIJtest1234")]
        )
        self.assertEqual(count_before, count_after)


# ---------------------------------------------------------------------------
# action_in_map_google_place_from_reverse_geocode
# ---------------------------------------------------------------------------

class TestActionInMapGooglePlaceFromReverseGeocode(TransactionCase):
    """Tests for action_in_map_google_place_from_reverse_geocode."""

    def setUp(self):
        super().setUp()
        self.partner_model = self.env["res.partner"]

    # --- Return type ----------------------------------------------------

    def test_returns_act_window_action(self):
        """Should always return an ir.actions.act_window dict."""
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        self.assertEqual(result["type"], "ir.actions.act_window")
        self.assertEqual(result["res_model"], "res.partner")

    def test_opens_in_popup(self):
        """Action should open in a dialog (target='new')."""
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        self.assertEqual(result["target"], "new")

    # --- New location (no existing partner) -----------------------------

    def test_new_location_has_no_res_id(self):
        """Action for a new location should NOT set res_id."""
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        self.assertFalse(result.get("res_id"))

    def test_new_location_populates_gplace_id(self):
        """Context defaults should include the Google place_id."""
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        ctx = result.get("context", {})
        self.assertEqual(ctx.get("default_gplace_id"), "ChIJgeotest5678")

    def test_new_location_populates_coordinates(self):
        """Context defaults should include lat/lng from geometry.location."""
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        ctx = result.get("context", {})
        self.assertAlmostEqual(ctx.get("default_partner_latitude"), 37.4224764)
        self.assertAlmostEqual(ctx.get("default_partner_longitude"), -122.0842499)

    def test_new_location_populates_city(self):
        """Context defaults should include the resolved city."""
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        ctx = result.get("context", {})
        self.assertEqual(ctx.get("default_city"), "Mountain View")

    def test_new_location_populates_zip(self):
        """Context defaults should include the postal code."""
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        ctx = result.get("context", {})
        self.assertEqual(ctx.get("default_zip"), "94043")

    def test_new_location_resolves_country(self):
        """Context defaults should include a resolved country_id integer."""
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        ctx = result.get("context", {})
        country_id = ctx.get("default_country_id")
        self.assertTrue(country_id)
        self.assertTrue(self.env["res.country"].browse(country_id).exists())

    # --- Missing optional fields ----------------------------------------

    def test_without_geometry_no_coordinates(self):
        """Missing geometry should not set lat/lng defaults."""
        geocoding = {k: v for k, v in SAMPLE_GEOCODING.items() if k != "geometry"}
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            geocoding
        )
        ctx = result.get("context", {})
        self.assertNotIn("default_partner_latitude", ctx)
        self.assertNotIn("default_partner_longitude", ctx)

    def test_without_address_components_still_returns_action(self):
        """Missing address_components should still return a valid action."""
        geocoding = {k: v for k, v in SAMPLE_GEOCODING.items() if k != "address_components"}
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            geocoding
        )
        self.assertEqual(result["type"], "ir.actions.act_window")

    def test_without_place_id_still_returns_create_action(self):
        """Geocoding result with no place_id should open a create form."""
        geocoding = {k: v for k, v in SAMPLE_GEOCODING.items() if k != "place_id"}
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            geocoding
        )
        self.assertEqual(result["type"], "ir.actions.act_window")
        self.assertFalse(result.get("res_id"))

    # --- Deduplication: existing partner --------------------------------

    def test_existing_partner_returns_edit_action(self):
        """When a partner with the same gplace_id exists, action should open that record."""
        existing = _create_partner(self.env, "Existing Location", gplace_id="ChIJgeotest5678")
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        self.assertEqual(result.get("res_id"), existing.id)

    def test_existing_partner_action_has_contact_name_in_title(self):
        """The action name should mention the existing partner's name."""
        _create_partner(self.env, "Existing Location", gplace_id="ChIJgeotest5678")
        result = self.partner_model.action_in_map_google_place_from_reverse_geocode(
            SAMPLE_GEOCODING
        )
        self.assertIn("Existing Location", result.get("name", ""))

    def test_no_duplicate_created_for_same_place_id(self):
        """Calling the method twice with the same place_id should not create a second partner."""
        _create_partner(self.env, "Existing Location", gplace_id="ChIJgeotest5678")
        count_before = self.partner_model.search_count(
            [("gplace_id", "=", "ChIJgeotest5678")]
        )
        self.partner_model.action_in_map_google_place_from_reverse_geocode(SAMPLE_GEOCODING)
        count_after = self.partner_model.search_count(
            [("gplace_id", "=", "ChIJgeotest5678")]
        )
        self.assertEqual(count_before, count_after)
