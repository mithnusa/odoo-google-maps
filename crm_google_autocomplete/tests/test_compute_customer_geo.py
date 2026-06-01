# -*- coding: utf-8 -*-
"""
Tests for the _compute_customer_geo override in crm_google_autocomplete.

The override adds an is_from_google_maps context guard so that coordinates
written by the Google Places autocomplete handler are not immediately wiped
out by the base compute logic (which would reset them to 0.0 when the lead
address diverges from its partner).

Requires crm_google_map to be installed (provides customer_latitude /
customer_longitude and the base compute).  Tests are skipped automatically
when that module is absent.

Run with:
  odoo-bin -i crm_google_map,crm_google_autocomplete --test-enable --stop-after-init
"""
import unittest

from odoo.tests.common import TransactionCase
from odoo.addons.crm.models.crm_lead import PARTNER_ADDRESS_FIELDS_TO_SYNC


# ---------------------------------------------------------------------------
# Shared helpers  (duplicated from crm_google_map tests for module isolation)
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
        vals[fname] = field_val.id if hasattr(field_val, '_name') else field_val
    return vals


def _create_geocoded_partner(env, name, lat, lng, **address):
    """Create a res.partner with coordinates and an optional address."""
    defaults = {
        'name': name,
        'street': '33 Test Street',
        'city': 'Auckland',
        'zip': '1010',
        'country_id': env.ref('base.nz').id,
    }
    defaults.update(address)
    defaults.update({'partner_latitude': lat, 'partner_longitude': lng})
    return env['res.partner'].create(defaults)


# ---------------------------------------------------------------------------
# Guard: skip entire module if crm_google_map is not installed
# ---------------------------------------------------------------------------

def setUpModule():
    # This hook is called by the standard unittest runner before any test in
    # this module.  The Odoo test runner also honours it.
    pass  # Actual check is done per-class in setUpClass (see below).


class _RequiresCrmGoogleMap(TransactionCase):
    """
    Base class that skips the test class when crm_google_map is not installed.

    The customer_latitude / customer_longitude fields and the base
    _compute_customer_geo method are only present when crm_google_map is
    installed.  Running the override tests without the base module would
    produce misleading failures.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        if 'customer_latitude' not in cls.env['crm.lead']._fields:
            raise unittest.SkipTest(
                'crm_google_map is not installed – '
                '_compute_customer_geo override tests require it'
            )


# ---------------------------------------------------------------------------
# Scenario 5 – is_from_google_maps context: compute must skip
# ---------------------------------------------------------------------------

class TestComputeSkipsWithGoogleMapsContext(_RequiresCrmGoogleMap):
    """
    When the is_from_google_maps context key is truthy, _compute_customer_geo
    must return early without overwriting any coordinates.

    Real-world flow this covers:
      1. User starts typing in a CRM lead's address widget.
      2. Google Places autocomplete fires and sets street, city, zip, country_id
         AND customer_latitude / customer_longitude in a single RPC call that
         carries is_from_google_maps=True in the context.
      3. The base compute would normally see an address that no longer matches
         the partner and reset coordinates to 0.0.
      4. The override intercepts and returns early, preserving the coordinates
         that the autocomplete handler has just written.
    """

    def setUp(self):
        super().setUp()
        # Start with a lead that has a geocoded partner and matching address
        # so that customer_latitude / customer_longitude are non-zero.
        self.partner = _create_geocoded_partner(
            self.env, 'Geocoded Partner', -36.8485, 174.7633
        )
        self.lead = self.env['crm.lead'].create({
            'name': 'Autocomplete Test Lead',
            'partner_id': self.partner.id,
            **_partner_address_vals(self.partner),
        })
        # Sanity-check: coords must be non-zero before we test the override.
        self.assertAlmostEqual(self.lead.customer_latitude, -36.8485, places=4)

    def test_latitude_preserved_when_address_written_with_context(self):
        """
        Writing a diverged address in is_from_google_maps context must NOT
        reset customer_latitude to 0.0.
        """
        self.lead.with_context(is_from_google_maps=True).write({
            'street': 'New Place from Autocomplete',
            'customer_latitude': -10.1234,
            'customer_longitude': 123.4567,
        })
        self.assertAlmostEqual(self.lead.customer_latitude, -10.1234, places=4)

    def test_longitude_preserved_when_address_written_with_context(self):
        """
        Writing a diverged address in is_from_google_maps context must NOT
        reset customer_longitude to 0.0.
        """
        self.lead.with_context(is_from_google_maps=True).write({
            'street': 'New Place from Autocomplete',
            'customer_latitude': -10.1234,
            'customer_longitude': 123.4567,
        })
        self.assertAlmostEqual(self.lead.customer_longitude, 123.4567, places=4)

    def test_context_guard_skips_for_all_leads_in_recordset(self):
        """
        The early-return must apply to every record in the recordset, not just
        the first one — guard is evaluated once per compute call on self.env.
        """
        second_lead = self.env['crm.lead'].create({
            'name': 'Second Autocomplete Lead',
            'partner_id': self.partner.id,
            **_partner_address_vals(self.partner),
        })
        recordset = (self.lead | second_lead).with_context(is_from_google_maps=True)
        recordset.write({
            'street': 'Street from Autocomplete',
            'customer_latitude': -20.0,
            'customer_longitude': 50.0,
        })
        self.assertAlmostEqual(self.lead.customer_latitude, -20.0, places=4)
        self.assertAlmostEqual(second_lead.customer_latitude, -20.0, places=4)


# ---------------------------------------------------------------------------
# Scenario 6 – No context: base compute runs as normal
# ---------------------------------------------------------------------------

class TestComputeRunsWithoutGoogleMapsContext(_RequiresCrmGoogleMap):
    """
    Without is_from_google_maps in the context, _compute_customer_geo must
    fall through to super() and execute the standard address-matching logic.
    """

    def setUp(self):
        super().setUp()
        self.partner = _create_geocoded_partner(
            self.env, 'Geocoded Partner', -36.8485, 174.7633
        )
        self.lead = self.env['crm.lead'].create({
            'name': 'Normal Context Lead',
            'partner_id': self.partner.id,
            **_partner_address_vals(self.partner),
        })
        # Sanity-check: coords must be non-zero.
        self.assertAlmostEqual(self.lead.customer_latitude, -36.8485, places=4)

    def test_latitude_reset_when_address_diverges_without_context(self):
        """
        Writing a diverged address without the context guard must trigger
        the base compute and reset customer_latitude to 0.0.
        """
        self.lead.write({'street': 'A Street That Does Not Match The Partner'})
        self.assertAlmostEqual(self.lead.customer_latitude, 0.0)

    def test_longitude_reset_when_address_diverges_without_context(self):
        """
        Writing a diverged address without the context guard must trigger
        the base compute and reset customer_longitude to 0.0.
        """
        self.lead.write({'street': 'A Street That Does Not Match The Partner'})
        self.assertAlmostEqual(self.lead.customer_longitude, 0.0)

    def test_coordinates_still_inherited_from_partner_without_context(self):
        """
        Normal (non-autocomplete) operations must still inherit coords from
        the partner when addresses match — super() must be called.
        """
        new_partner = _create_geocoded_partner(
            self.env, 'Second Geocoded Partner', -41.2865, 174.7762
        )
        # Switch to a new partner; update address fields to match.
        self.lead.write({
            'partner_id': new_partner.id,
            **_partner_address_vals(new_partner),
        })
        self.assertAlmostEqual(self.lead.customer_latitude, -41.2865, places=4)
        self.assertAlmostEqual(self.lead.customer_longitude, 174.7762, places=4)

    def test_no_partner_gives_zero_coordinates_without_context(self):
        """
        Removing the partner without the context guard must produce (0.0, 0.0)
        — the base compute's no-partner branch must be reachable.
        """
        self.lead.partner_id = False
        self.assertAlmostEqual(self.lead.customer_latitude, 0.0)
        self.assertAlmostEqual(self.lead.customer_longitude, 0.0)
