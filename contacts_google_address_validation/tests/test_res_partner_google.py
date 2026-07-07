# -*- coding: utf-8 -*-
"""
Tests for the Google Address Validation flow on ``res.partner``.

Covers:
  - action_google_validate_address         (guards, coverage, request)
  - action_apply_google_address_validation (apply / keep, sanitization)
  - _prepare_google_validated_address      (state / country resolution)
  - validation reset lifecycle             (write override, onchange)
  - storage compliance (no raw Google/USPS address strings persisted in
    fields or chatter — GMP Service Specific Terms, Table 1.3.2)

All HTTP traffic is mocked — no real Google API calls are made.

Run with:
    odoo-bin -i contacts_google_address_validation --test-enable \
        --stop-after-init
"""

from unittest.mock import patch

from odoo.exceptions import UserError
from odoo.tests.common import TransactionCase

from .test_google_service import rest_document


class GooglePartnerCase(TransactionCase):

    def setUp(self):
        super().setUp()
        self.icp = self.env['ir.config_parameter'].sudo()
        self.icp.set_param('base_google_map.api_key', 'browser-key-123456')
        self.country_us = self.env.ref('base.us')
        State = self.env['res.country.state']
        self.state_ca = State.search(
            [('country_id', '=', self.country_us.id), ('code', '=', 'CA')],
            limit=1,
        ) or State.create({
            'name': 'California',
            'code': 'CA',
            'country_id': self.country_us.id,
        })
        self.partner = self.env['res.partner'].create({
            'name': 'Google Test Partner',
            'street': '1600 Amphitheatre',
            'city': 'Mountainview',
            'zip': '94043',
            'country_id': self.country_us.id,
        })

    def _validated_result(self, document=None):
        return self.env['google.address.validation']._parse_validation(
            document or rest_document()
        )

    def _patch_validate_address(self):
        """Patch ``validate_address`` on the service model class so the
        partner action is tested in isolation — no transport involved
        (transport itself is covered by test_google_service)."""
        return patch.object(
            self.env.registry['google.address.validation'],
            'validate_address',
            return_value=self._validated_result(),
        )

    # ------------------------------------------------------------------
    # Validate action (guards, coverage, request building)
    # ------------------------------------------------------------------

    def test_validate_requires_address(self):
        partner = self.env['res.partner'].create({
            'name': 'Empty',
            'country_id': self.country_us.id,
        })
        with self.assertRaises(UserError):
            partner.action_google_validate_address()

    def test_validate_rejects_unsupported_country(self):
        self.partner.country_id = self.env.ref('base.id')  # Indonesia
        with self.assertRaises(UserError) as ctx:
            self.partner.action_google_validate_address()
        self.assertIn('not available', str(ctx.exception))

    def test_validate_builds_request_and_returns_result(self):
        with self._patch_validate_address() as mock_validate:
            response = self.partner.action_google_validate_address()
        mock_validate.assert_called_once()
        lines = mock_validate.call_args[0][0]
        kwargs = mock_validate.call_args[1]
        self.assertIn('1600 Amphitheatre', lines[0])
        self.assertIn('94043', lines[-1])
        self.assertEqual(kwargs['region_code'], 'US')
        # CASS is enabled automatically for US addresses
        self.assertTrue(kwargs['enable_usps_cass'])
        self.assertEqual(response['result']['status'], 'valid')
        self.assertIn('1600 Amphitheatre', response['entered'])

    def test_validate_no_cass_outside_us_pr(self):
        self.partner.write({
            'country_id': self.env.ref('base.de').id,  # Germany
            'state_id': False,
        })
        with self._patch_validate_address() as mock_validate:
            self.partner.action_google_validate_address()
        kwargs = mock_validate.call_args[1]
        self.assertEqual(kwargs['region_code'], 'DE')
        self.assertFalse(kwargs['enable_usps_cass'])

    # ------------------------------------------------------------------
    # Apply / keep
    # ------------------------------------------------------------------

    def test_apply_address_writes_fields(self):
        self.partner.action_apply_google_address_validation(
            self._validated_result(), True
        )
        self.assertEqual(self.partner.street, '1600 Amphitheatre Pkwy')
        self.assertEqual(self.partner.city, 'Mountain View')
        self.assertEqual(self.partner.zip, '94043')
        self.assertEqual(self.partner.state_id, self.state_ca)
        self.assertEqual(self.partner.country_id, self.country_us)
        self.assertEqual(
            self.partner.google_address_validation_status, 'valid'
        )
        self.assertEqual(
            self.partner.google_address_validation_granularity, 'PREMISE'
        )
        self.assertEqual(
            self.partner.google_address_validation_response_id,
            'resp-abc-123',
        )
        self.assertTrue(self.partner.google_address_validation_date)
        self.assertAlmostEqual(
            self.partner.partner_latitude, 37.4224764
        )
        self.assertAlmostEqual(
            self.partner.partner_longitude, -122.0842499
        )

    def test_keep_address_stores_verdict_only(self):
        self.partner.action_apply_google_address_validation(
            self._validated_result(), False
        )
        self.assertEqual(self.partner.street, '1600 Amphitheatre')
        self.assertEqual(self.partner.city, 'Mountainview')
        self.assertEqual(
            self.partner.google_address_validation_status, 'valid'
        )

    def test_apply_sanitizes_unknown_values(self):
        result = self._validated_result()
        result['status'] = 'bogus'
        result['verdict']['validationGranularity'] = 'NOT_A_GRANULARITY'
        self.partner.action_apply_google_address_validation(result, False)
        self.assertEqual(
            self.partner.google_address_validation_status,
            'not_validated',
        )
        self.assertFalse(
            self.partner.google_address_validation_granularity
        )

    def test_prepare_address_resolves_state_within_country(self):
        vals = self.env['res.partner']._prepare_google_validated_address({
            'street': 'x',
            'state_code': 'California',  # by name
            'country_code': 'US',
        })
        self.assertEqual(vals['state_id'], self.state_ca.id)
        self.assertEqual(vals['country_id'], self.country_us.id)

    def test_prepare_address_unknown_state_cleared(self):
        vals = self.env['res.partner']._prepare_google_validated_address({
            'street': 'x',
            'state_code': 'Atlantis',
            'country_code': 'US',
        })
        self.assertFalse(vals['state_id'])

    # ------------------------------------------------------------------
    # Storage compliance (GMP Service Specific Terms, Table 1.3.2)
    # ------------------------------------------------------------------

    def test_no_standardized_address_fields_on_partner(self):
        """Google / USPS standardized address strings must not be
        persisted on the partner: only End User confirmed data (the
        applied address) may be stored permanently."""
        Partner = self.env['res.partner']
        self.assertNotIn(
            'google_address_validation_formatted_address',
            Partner._fields,
        )
        self.assertNotIn(
            'google_address_validation_usps_address', Partner._fields
        )

    def test_chatter_has_verdict_but_no_raw_addresses(self):
        """The chatter note must contain only verdict data (status,
        granularity, DPV code, ...) — never standardized address strings,
        since mail messages are stored forever, which would exceed the
        30-day caching period of the Google Maps Platform Service
        Specific Terms (Table 1.3.2)."""
        messages_before = len(self.partner.message_ids)
        self.partner.action_apply_google_address_validation(
            self._validated_result(), False
        )
        new_messages = self.partner.message_ids[
            : len(self.partner.message_ids) - messages_before
        ]
        body = ' '.join(new_messages.mapped('body'))
        self.assertIn('Google Address Validation Result', body)
        self.assertIn('USPS DPV Confirmation', body)
        self.assertNotIn('Standardized Address', body)
        self.assertNotIn('AMPHITHEATRE PKWY', body)
        self.assertNotIn('Santa Clara', body)

    def test_no_gc_cron_registered(self):
        """The GC cron was removed together with the cached fields; make
        sure no leftover cron record still calls the deleted method."""
        crons = self.env['ir.cron'].with_context(
            active_test=False
        ).search([('code', 'like', '_gc_google_address_validation_cache')])
        self.assertFalse(crons)

    # ------------------------------------------------------------------
    # Reset lifecycle
    # ------------------------------------------------------------------

    def test_write_address_field_resets_validation(self):
        self.partner.action_apply_google_address_validation(
            self._validated_result(), False
        )
        self.partner.write({'street': 'Another street 7'})
        self.assertEqual(
            self.partner.google_address_validation_status,
            'not_validated',
        )
        self.assertFalse(
            self.partner.google_address_validation_granularity
        )
        self.assertFalse(self.partner.google_address_validation_date)

    def test_write_with_status_skips_reset(self):
        self.partner.action_apply_google_address_validation(
            self._validated_result(), False
        )
        self.partner.write({
            'street': 'New street 42',
            'google_address_validation_status': 'needs_review',
        })
        self.assertEqual(
            self.partner.google_address_validation_status, 'needs_review'
        )

    def test_onchange_resets_validation(self):
        self.partner.action_apply_google_address_validation(
            self._validated_result(), False
        )
        self.partner._onchange_address_reset_google_validation()
        self.assertEqual(
            self.partner.google_address_validation_status,
            'not_validated',
        )
