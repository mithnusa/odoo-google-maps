# -*- coding: utf-8 -*-
"""
Tests for _compute_customer_geo on crm.lead (crm_google_map module).

Covers all four scenarios that follow from the fix applied to this method:

  1. Lead with no partner_id        → coordinates are 0.0
  2. Lead address matches partner   → coordinates inherited from partner
  3. Lead address diverges          → coordinates reset to 0.0 (cron picks up)
  4. Partner geocoded after lead    → lead coordinates update automatically
     (this validates the dotted @api.depends paths added in the fix:
      'partner_id.partner_latitude' and 'partner_id.partner_longitude')

Run with:
  python -m pytest odoo --test-enable -i crm_google_map
  # or
  odoo-bin -i crm_google_map --test-enable --stop-after-init
"""

from odoo.tests.common import TransactionCase
from odoo.addons.crm.models.crm_lead import PARTNER_ADDRESS_FIELDS_TO_SYNC


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _partner_address_vals(partner):
    """
    Return a dict of lead field values that exactly mirror a partner's
    PARTNER_ADDRESS_FIELDS_TO_SYNC values.  Many2one fields are converted
    to integer IDs so they can be passed directly to create()/write().
    """
    vals = {}
    for fname in PARTNER_ADDRESS_FIELDS_TO_SYNC:
        field_val = partner[fname]
        # Many2one fields return a recordset; write expects the integer id.
        vals[fname] = (
            field_val.id if hasattr(field_val, "_name") else field_val
        )
    return vals


def _create_geocoded_partner(env, name, lat, lng, **address):
    """Create a res.partner with coordinates and an optional address."""
    defaults = {
        "name": name,
        "street": "33 Test Street",
        "city": "Auckland",
        "zip": "1010",
        "country_id": env.ref("base.nz").id,
    }
    defaults.update(address)
    defaults.update({"partner_latitude": lat, "partner_longitude": lng})
    return env["res.partner"].create(defaults)


# ---------------------------------------------------------------------------
# Scenario 1 – No partner
# ---------------------------------------------------------------------------


class TestComputeCustomerGeoNoPartner(TransactionCase):
    """_compute_customer_geo: lead without a linked partner."""

    def test_new_lead_without_partner_has_zero_coordinates(self):
        """A brand-new lead with no partner_id must start at (0.0, 0.0)."""
        lead = self.env["crm.lead"].create({"name": "Partnerless Lead"})
        self.assertAlmostEqual(lead.customer_latitude, 0.0)
        self.assertAlmostEqual(lead.customer_longitude, 0.0)

    def test_unlinking_partner_resets_coordinates_to_zero(self):
        """Removing partner_id from a lead that had inherited coords must reset to 0.0."""
        partner = _create_geocoded_partner(
            self.env, "Geocoded Partner", -36.8485, 174.7633
        )
        lead = self.env["crm.lead"].create(
            {
                "name": "Test Lead",
                "partner_id": partner.id,
                **_partner_address_vals(partner),
            }
        )
        # Coordinates must have been inherited before we remove the partner.
        self.assertAlmostEqual(lead.customer_latitude, -36.8485, places=4)

        lead.partner_id = False
        self.assertAlmostEqual(lead.customer_latitude, 0.0)
        self.assertAlmostEqual(lead.customer_longitude, 0.0)


# ---------------------------------------------------------------------------
# Scenario 2 – Address matches partner
# ---------------------------------------------------------------------------


class TestComputeCustomerGeoMatchingAddress(TransactionCase):
    """_compute_customer_geo: lead address exactly mirrors partner address."""

    def setUp(self):
        super().setUp()
        self.partner = _create_geocoded_partner(
            self.env, "Geocoded Partner", -36.8485, 174.7633
        )
        self.lead = self.env["crm.lead"].create(
            {
                "name": "Matching Address Lead",
                "partner_id": self.partner.id,
                **_partner_address_vals(self.partner),
            }
        )

    def test_customer_latitude_inherited_from_partner(self):
        """customer_latitude must equal partner.partner_latitude when addresses match."""
        self.assertAlmostEqual(
            self.lead.customer_latitude,
            self.partner.partner_latitude,
            places=4,
        )

    def test_customer_longitude_inherited_from_partner(self):
        """customer_longitude must equal partner.partner_longitude when addresses match."""
        self.assertAlmostEqual(
            self.lead.customer_longitude,
            self.partner.partner_longitude,
            places=4,
        )

    def test_coordinates_stay_in_sync_when_partner_coords_change(self):
        """Writing new coords directly onto the partner must flow through to the lead."""
        self.partner.write(
            {"partner_latitude": -37.0, "partner_longitude": 175.0}
        )
        self.assertAlmostEqual(self.lead.customer_latitude, -37.0, places=4)
        self.assertAlmostEqual(self.lead.customer_longitude, 175.0, places=4)


# ---------------------------------------------------------------------------
# Scenario 3 – Address diverges from partner
# ---------------------------------------------------------------------------


class TestComputeCustomerGeoDivergedAddress(TransactionCase):
    """_compute_customer_geo: lead address no longer matches linked partner."""

    def setUp(self):
        super().setUp()
        self.partner = _create_geocoded_partner(
            self.env, "Geocoded Partner", -36.8485, 174.7633
        )
        # Start with a matching address so inherited coords are non-zero.
        self.lead = self.env["crm.lead"].create(
            {
                "name": "Soon-Diverged Lead",
                "partner_id": self.partner.id,
                **_partner_address_vals(self.partner),
            }
        )
        # Confirm we have a valid starting state.
        self.assertAlmostEqual(self.lead.customer_latitude, -36.8485, places=4)

    def test_latitude_reset_when_street_differs_from_partner(self):
        """Changing the lead's street so it no longer matches the partner must reset latitude."""
        self.lead.street = "A Completely Different Street"
        self.assertAlmostEqual(self.lead.customer_latitude, 0.0)

    def test_longitude_reset_when_street_differs_from_partner(self):
        """Changing the lead's street so it no longer matches the partner must reset longitude."""
        self.lead.street = "A Completely Different Street"
        self.assertAlmostEqual(self.lead.customer_longitude, 0.0)

    def test_latitude_reset_when_city_differs_from_partner(self):
        """Changing the lead's city to differ from the partner must reset latitude."""
        self.lead.city = "Wellington"
        self.assertAlmostEqual(self.lead.customer_latitude, 0.0)

    def test_latitude_reset_when_country_differs_from_partner(self):
        """Changing the lead's country to differ from the partner must reset latitude."""
        self.lead.country_id = self.env.ref("base.au")
        self.assertAlmostEqual(self.lead.customer_latitude, 0.0)


# ---------------------------------------------------------------------------
# Scenario 4 – Partner geocoded *after* lead was created
# ---------------------------------------------------------------------------


class TestComputeCustomerGeoPartnerGeocodedLater(TransactionCase):
    """
    Validates the dotted-path @api.depends fix:
      'partner_id.partner_latitude', 'partner_id.partner_longitude'

    Before the fix, the lead's stored compute cache was never invalidated when
    the partner's coordinates changed after the lead was created.  The lead's
    customer_latitude would remain stale at 0.0 until a manual re-save.
    """

    def setUp(self):
        super().setUp()
        # Partner starts without coordinates (not yet geocoded).
        country_nz = self.env.ref("base.nz")
        self.partner = self.env["res.partner"].create(
            {
                "name": "Ungeolocated Partner",
                "street": "33 Test Street",
                "city": "Auckland",
                "zip": "1010",
                "country_id": country_nz.id,
                # Intentionally no partner_latitude / partner_longitude
            }
        )
        self.lead = self.env["crm.lead"].create(
            {
                "name": "Lead Waiting For Geocoding",
                "partner_id": self.partner.id,
                **_partner_address_vals(self.partner),
            }
        )

    def test_lead_starts_with_zero_coordinates_when_partner_not_geocoded(self):
        """Before the partner is geocoded, the lead must have (0.0, 0.0) coordinates."""
        self.assertAlmostEqual(self.lead.customer_latitude, 0.0)
        self.assertAlmostEqual(self.lead.customer_longitude, 0.0)

    def test_lead_latitude_updates_when_partner_is_geocoded(self):
        """After geocoding the partner, the lead's latitude must recompute automatically."""
        self.partner.write(
            {"partner_latitude": -36.8485, "partner_longitude": 174.7633}
        )
        self.assertAlmostEqual(self.lead.customer_latitude, -36.8485, places=4)

    def test_lead_longitude_updates_when_partner_is_geocoded(self):
        """After geocoding the partner, the lead's longitude must recompute automatically."""
        self.partner.write(
            {"partner_latitude": -36.8485, "partner_longitude": 174.7633}
        )
        self.assertAlmostEqual(
            self.lead.customer_longitude, 174.7633, places=4
        )

    def test_multiple_leads_all_update_when_partner_is_geocoded(self):
        """All leads sharing the same partner must update when the partner is geocoded."""
        second_lead = self.env["crm.lead"].create(
            {
                "name": "Second Lead Same Partner",
                "partner_id": self.partner.id,
                **_partner_address_vals(self.partner),
            }
        )
        self.partner.write(
            {"partner_latitude": -36.8485, "partner_longitude": 174.7633}
        )
        self.assertAlmostEqual(self.lead.customer_latitude, -36.8485, places=4)
        self.assertAlmostEqual(
            second_lead.customer_latitude, -36.8485, places=4
        )
