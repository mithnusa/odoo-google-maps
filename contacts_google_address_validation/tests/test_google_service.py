# -*- coding: utf-8 -*-
"""
Tests for the ``google.address.validation`` abstract model.

Covers:
  - _parse_validation        (REST response normalization)
  - _parse_usps_data         (CASS / DPV block)
  - _compute_recommendation  (accept / confirm / fix logic)
  - validate_address         (request building, CASS gating)
  - _google_request          (transport and API error handling)
  - _get_api_key             (dedicated server key with fallback)

All HTTP traffic is mocked — no real Google API calls are made.

Run with:
    odoo-bin -i contacts_google_address_validation --test-enable \
        --stop-after-init
"""

from unittest.mock import patch

import requests as requests_lib

from odoo.exceptions import UserError
from odoo.tests.common import TransactionCase
from odoo.tools import mute_logger

SERVICE_MODULE = (
    'odoo.addons.contacts_google_address_validation.models'
    '.google_address_validation'
)
REQUESTS_POST = SERVICE_MODULE + '.requests.post'


class MockResponse:
    """Minimal stand-in for requests.Response."""

    def __init__(self, status_code=200, payload=None, text=''):
        self.status_code = status_code
        self._payload = payload
        self.text = text
        self.reason = 'Mock Reason'

    def json(self):
        if self._payload is None:
            raise ValueError('No JSON payload')
        return self._payload


def rest_document(**overrides):
    """A realistic validateAddress REST response (US, CASS enabled)."""
    result = {
        'verdict': {
            'inputGranularity': 'PREMISE',
            'validationGranularity': 'PREMISE',
            'geocodeGranularity': 'PREMISE',
            'addressComplete': True,
            'hasInferredComponents': False,
            'hasUnconfirmedComponents': False,
            'hasReplacedComponents': False,
        },
        'address': {
            'formattedAddress': (
                '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA'
            ),
            'postalAddress': {
                'regionCode': 'US',
                'administrativeArea': 'CA',
                'locality': 'Mountain View',
                'postalCode': '94043',
                'addressLines': ['1600 Amphitheatre Pkwy'],
            },
            'addressComponents': [
                {
                    'componentName': {'text': '1600'},
                    'componentType': 'street_number',
                    'confirmationLevel': 'CONFIRMED',
                },
                {
                    'componentName': {'text': 'Amphitheatre Parkway'},
                    'componentType': 'route',
                    'confirmationLevel': 'CONFIRMED',
                    'spellCorrected': True,
                },
            ],
        },
        'geocode': {
            'location': {
                'latitude': 37.4224764,
                'longitude': -122.0842499,
            },
        },
        'uspsData': {
            'standardizedAddress': {
                'firstAddressLine': '1600 AMPHITHEATRE PKWY',
                'cityStateZipAddressLine': 'MOUNTAIN VIEW CA 94043-1351',
                'city': 'MOUNTAIN VIEW',
                'state': 'CA',
                'zipCode': '94043',
                'zipCodeExtension': '1351',
            },
            'dpvConfirmation': 'Y',
            'county': 'Santa Clara',
            'dpvVacant': 'N',
            'dpvNoStat': 'N',
        },
    }
    result.update(overrides.pop('result', {}))
    document = {'result': result, 'responseId': 'resp-abc-123'}
    document.update(overrides)
    return document


class GoogleServiceCase(TransactionCase):

    def setUp(self):
        super().setUp()
        self.service = self.env['google.address.validation']
        self.icp = self.env['ir.config_parameter'].sudo()
        self.icp.set_param('base_google_map.api_key', 'browser-key-123456')
        self.icp.set_param(
            'contacts_google_address_validation.api_key', ''
        )

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    def test_api_key_falls_back_to_base_google_map(self):
        self.assertEqual(self.service._get_api_key(), 'browser-key-123456')

    def test_dedicated_server_key_takes_precedence(self):
        self.icp.set_param(
            'contacts_google_address_validation.api_key', 'server-key-789'
        )
        self.assertEqual(self.service._get_api_key(), 'server-key-789')

    def test_missing_api_key_raises(self):
        self.icp.set_param('base_google_map.api_key', '')
        with self.assertRaises(UserError):
            self.service._get_api_key()

    def test_region_helpers(self):
        self.assertTrue(self.service.is_region_supported('us'))
        self.assertTrue(self.service.is_region_supported('DE'))
        self.assertFalse(self.service.is_region_supported('ID'))
        self.assertFalse(self.service.is_region_supported(''))
        self.assertTrue(self.service.should_enable_cass('US'))
        self.assertTrue(self.service.should_enable_cass('PR'))
        self.assertFalse(self.service.should_enable_cass('CA'))

    # ------------------------------------------------------------------
    # Response normalization
    # ------------------------------------------------------------------

    def test_parse_validation_accept(self):
        result = self.service._parse_validation(rest_document())
        self.assertEqual(result['responseId'], 'resp-abc-123')
        self.assertIn('Amphitheatre', result['formattedAddress'])
        self.assertEqual(
            result['verdict']['validationGranularity'], 'PREMISE'
        )
        self.assertTrue(result['verdict']['addressComplete'])
        self.assertEqual(len(result['components']), 2)
        self.assertEqual(result['components'][0]['type'], 'street_number')
        self.assertEqual(result['components'][0]['name'], '1600')
        self.assertTrue(result['components'][1]['spellCorrected'])
        self.assertEqual(
            result['postalAddress']['locality'], 'Mountain View'
        )
        self.assertAlmostEqual(result['location']['latitude'], 37.4224764)
        self.assertEqual(result['uspsData']['dpvConfirmation'], 'Y')
        self.assertIn(
            '1600 AMPHITHEATRE PKWY',
            result['uspsData']['standardizedAddress'],
        )
        self.assertEqual(result['recommendation'], 'ACCEPT')
        self.assertEqual(result['status'], 'valid')

    def test_parse_validation_missing_components(self):
        document = rest_document()
        document['result']['verdict']['addressComplete'] = False
        document['result']['address']['missingComponentTypes'] = [
            'street_number'
        ]
        result = self.service._parse_validation(document)
        self.assertEqual(
            result['missingComponentTypes'], ['street_number']
        )
        self.assertEqual(result['recommendation'], 'CONFIRM')
        self.assertEqual(result['status'], 'needs_review')

    def test_parse_validation_minimal_document(self):
        result = self.service._parse_validation({})
        self.assertEqual(result['status'], 'invalid')  # FIX
        self.assertIsNone(result['uspsData'])
        self.assertIsNone(result['location'])
        self.assertEqual(result['components'], [])

    def test_parse_usps_data_zip_fallback(self):
        usps = self.service._parse_usps_data({
            'dpvConfirmation': 'D',
            'standardizedAddress': {
                'firstAddressLine': '20 MAIN ST',
                'city': 'ROSEVILLE',
                'state': 'CA',
                'zipCode': '95678',
                'zipCodeExtension': '1234',
            },
        })
        self.assertIn('95678-1234', usps['standardizedAddress'])
        self.assertEqual(usps['dpvConfirmation'], 'D')

    # ------------------------------------------------------------------
    # Recommendation logic
    # ------------------------------------------------------------------

    def test_recommendation_prefers_possible_next_action(self):
        verdict = {
            'possibleNextAction': 'FIX',
            'validationGranularity': 'PREMISE',
            'addressComplete': True,
        }
        self.assertEqual(
            self.service._compute_recommendation(verdict), 'FIX'
        )

    def test_recommendation_heuristics(self):
        cases = [
            # (verdict, expected)
            ({'validationGranularity': 'OTHER'}, 'FIX'),
            ({'validationGranularity': ''}, 'FIX'),
            (
                {
                    'validationGranularity': 'PREMISE',
                    'addressComplete': True,
                    'hasUnconfirmedComponents': True,
                },
                'CONFIRM',
            ),
            (
                {
                    'validationGranularity': 'SUB_PREMISE',
                    'addressComplete': False,
                },
                'CONFIRM',
            ),
            (
                {
                    'validationGranularity': 'PREMISE',
                    'addressComplete': True,
                },
                'ACCEPT',
            ),
        ]
        for verdict, expected in cases:
            self.assertEqual(
                self.service._compute_recommendation(verdict),
                expected,
                'verdict %r should yield %r' % (verdict, expected),
            )

    # ------------------------------------------------------------------
    # Request building
    # ------------------------------------------------------------------

    def test_validate_address_request_body(self):
        with patch(REQUESTS_POST) as mock_post:
            mock_post.return_value = MockResponse(payload=rest_document())
            self.service.validate_address(
                ['1600 Amphitheatre Pkwy', 'Mountain View CA 94043'],
                region_code='us',
                enable_usps_cass=True,
            )
            body = mock_post.call_args[1]['json']
            params = mock_post.call_args[1]['params']
        self.assertEqual(body['address']['regionCode'], 'US')
        self.assertEqual(len(body['address']['addressLines']), 2)
        self.assertTrue(body['enableUspsCass'])
        self.assertEqual(params['key'], 'browser-key-123456')

    def test_validate_address_cass_gated_by_region(self):
        with patch(REQUESTS_POST) as mock_post:
            mock_post.return_value = MockResponse(payload=rest_document())
            self.service.validate_address(
                ['20 Bay St'], region_code='CA', enable_usps_cass=True
            )
            body = mock_post.call_args[1]['json']
        self.assertNotIn('enableUspsCass', body)

    # ------------------------------------------------------------------
    # Transport / API errors
    # ------------------------------------------------------------------

    def _error_document(self, status, message='boom'):
        return {
            'error': {'code': 403, 'status': status, 'message': message}
        }

    @mute_logger(SERVICE_MODULE)
    def test_permission_denied_hints_configuration(self):
        with patch(REQUESTS_POST) as mock_post:
            mock_post.return_value = MockResponse(
                status_code=403,
                payload=self._error_document('PERMISSION_DENIED'),
            )
            with self.assertRaises(UserError) as ctx:
                self.service.validate_address(['x'], region_code='US')
            self.assertIn('Address Validation API', str(ctx.exception))
            self.assertIn('restrictions', str(ctx.exception))

    @mute_logger(SERVICE_MODULE)
    def test_resource_exhausted(self):
        with patch(REQUESTS_POST) as mock_post:
            mock_post.return_value = MockResponse(
                status_code=429,
                payload=self._error_document('RESOURCE_EXHAUSTED'),
            )
            with self.assertRaises(UserError) as ctx:
                self.service.validate_address(['x'], region_code='US')
            self.assertIn('quota', str(ctx.exception).lower())

    @mute_logger(SERVICE_MODULE)
    def test_invalid_argument(self):
        with patch(REQUESTS_POST) as mock_post:
            mock_post.return_value = MockResponse(
                status_code=400,
                payload=self._error_document('INVALID_ARGUMENT'),
            )
            with self.assertRaises(UserError) as ctx:
                self.service.validate_address(['x'], region_code='US')
            self.assertIn('could not process', str(ctx.exception))

    def test_timeout(self):
        with patch(REQUESTS_POST) as mock_post:
            mock_post.side_effect = requests_lib.exceptions.Timeout()
            with self.assertRaises(UserError) as ctx:
                self.service.validate_address(['x'], region_code='US')
            self.assertIn('did not respond', str(ctx.exception))

    @mute_logger(SERVICE_MODULE)
    def test_invalid_json(self):
        with patch(REQUESTS_POST) as mock_post:
            mock_post.return_value = MockResponse(
                status_code=200, payload=None, text='<html>oops</html>'
            )
            with self.assertRaises(UserError) as ctx:
                self.service.validate_address(['x'], region_code='US')
            self.assertIn('unexpected', str(ctx.exception).lower())
