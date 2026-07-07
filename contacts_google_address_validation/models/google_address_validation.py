# -*- coding: utf-8 -*-
import logging

import requests

from odoo import api, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

GOOGLE_AV_DEFAULT_ENDPOINT = (
    'https://addressvalidation.googleapis.com/v1:validateAddress'
)
GOOGLE_AV_TIMEOUT = 10  # seconds

# Region codes covered by the Address Validation API.
# https://developers.google.com/maps/documentation/address-validation/coverage
SUPPORTED_REGION_CODES = (
    'AR',  # Argentina
    'AT',  # Austria
    'AU',  # Australia
    'BE',  # Belgium
    'BG',  # Bulgaria
    'BR',  # Brazil
    'CA',  # Canada
    'CH',  # Switzerland
    'CL',  # Chile
    'CO',  # Colombia
    'CZ',  # Czechia
    'DE',  # Germany
    'DK',  # Denmark
    'EE',  # Estonia
    'ES',  # Spain
    'FI',  # Finland
    'FR',  # France
    'GB',  # United Kingdom
    'HR',  # Croatia
    'HU',  # Hungary
    'IE',  # Ireland
    'IN',  # India
    'IT',  # Italy
    'JP',  # Japan
    'LT',  # Lithuania
    'LU',  # Luxembourg
    'LV',  # Latvia
    'MX',  # Mexico
    'MY',  # Malaysia
    'NL',  # Netherlands
    'NO',  # Norway
    'NZ',  # New Zealand
    'PL',  # Poland
    'PR',  # Puerto Rico
    'PT',  # Portugal
    'SE',  # Sweden
    'SG',  # Singapore
    'SI',  # Slovenia
    'SK',  # Slovakia
    'US',  # United States
)

# Regions supporting USPS CASS(tm) processing.
CASS_REGION_CODES = (
    'US',  # United States
    'PR',  # Puerto Rico
)

RECOMMENDATION_ACCEPT = 'ACCEPT'
RECOMMENDATION_CONFIRM = 'CONFIRM'
RECOMMENDATION_FIX = 'FIX'

RECOMMENDATION_TO_STATUS = {
    RECOMMENDATION_ACCEPT: 'valid',
    RECOMMENDATION_CONFIRM: 'needs_review',
    RECOMMENDATION_FIX: 'invalid',
}


class GoogleAddressValidation(models.AbstractModel):
    """Server-side client for the Google Address Validation API (REST).

    Centralizes authentication, transport, error handling, response
    normalization, and the accept / confirm / fix recommendation logic so
    any model can validate addresses with::

        result = self.env['google.address.validation'].validate_address(
            ['1600 Amphitheatre Parkway', 'Mountain View CA 94043'],
            region_code='US',
        )

    API documentation:
    https://developers.google.com/maps/documentation/address-validation
    """

    _name = 'google.address.validation'
    _description = 'Google Address Validation Service'

    # ------------------------------------------------------------------
    # Configuration
    # ------------------------------------------------------------------

    @api.model
    def _get_api_key(self):
        """Return the API key for server-side validation requests.

        A dedicated key can be set in
        ``contacts_google_address_validation.api_key`` — recommended,
        because the main ``base_google_map.api_key`` is usually
        HTTP-referrer restricted, and Google rejects referrer-restricted
        keys for server-side (REST) requests. Falls back to the main key.
        """
        icp = self.env['ir.config_parameter'].sudo()
        api_key = (
            icp.get_param(
                'contacts_google_address_validation.api_key', default=''
            )
            or icp.get_param('base_google_map.api_key', default='')
        ).strip()
        if not api_key:
            raise UserError(
                self.env._(
                    'No Google Maps API key is configured. Set it in '
                    'Settings > General Settings > Google Maps.'
                )
            )
        return api_key

    @api.model
    def _get_endpoint(self):
        return (
            self.env['ir.config_parameter']
            .sudo()
            .get_param(
                'contacts_google_address_validation.endpoint',
                default=GOOGLE_AV_DEFAULT_ENDPOINT,
            )
        )

    @api.model
    def is_region_supported(self, region_code):
        return (region_code or '').upper() in SUPPORTED_REGION_CODES

    @api.model
    def should_enable_cass(self, region_code):
        return (region_code or '').upper() in CASS_REGION_CODES

    # ------------------------------------------------------------------
    # Transport
    # ------------------------------------------------------------------

    @api.model
    def _google_request(self, payload):
        """POST a validateAddress request.

        :param dict payload: JSON body (``address``, ``enableUspsCass``,
            ``previousResponseId``, ...)
        :return: the decoded JSON response document
        :raises UserError: on transport errors or API-level errors, with
            actionable messages per Google error status
        """
        try:
            response = requests.post(
                self._get_endpoint(),
                json=payload,
                params={'key': self._get_api_key()},
                timeout=GOOGLE_AV_TIMEOUT,
            )
        except requests.exceptions.Timeout as exc:
            raise UserError(
                self.env._(
                    'The Address Validation API did not respond in time. '
                    'Please try again in a moment.'
                )
            ) from exc
        except requests.exceptions.RequestException as exc:
            _logger.warning('Address Validation request failed: %s', exc)
            raise UserError(
                self.env._(
                    'Could not reach the Address Validation API. Check '
                    'your network connection and try again.'
                )
            ) from exc

        try:
            document = response.json()
        except ValueError as exc:
            _logger.warning(
                'Unexpected Address Validation response (%s): %s',
                response.status_code,
                response.text[:500],
            )
            raise UserError(
                self.env._(
                    'The Address Validation API returned an unexpected '
                    'response.'
                )
            ) from exc

        error = document.get('error')
        if response.status_code >= 400 or error:
            error = error or {}
            status = error.get('status') or ''
            message = error.get('message') or response.reason
            _logger.warning(
                'Address Validation API error (%s): %s', status, message
            )
            raise UserError(self._get_error_message(status, message))

        return document

    @api.model
    def _get_error_message(self, status, message):
        """Map a Google error status to an actionable, translated message."""
        if status == 'PERMISSION_DENIED':
            return self.env._(
                'The Address Validation API rejected the request. Enable '
                'the "Address Validation API" in your Google Cloud '
                'project, make sure it is included in your API key '
                'restrictions, and note that HTTP-referrer restricted '
                'keys cannot be used server-side — configure a dedicated '
                'server key if needed.\n\n%(message)s',
                message=message,
            )
        if status == 'RESOURCE_EXHAUSTED':
            return self.env._(
                'The Address Validation API quota has been exceeded. '
                'Check your Google Cloud quota and billing settings.'
                '\n\n%(message)s',
                message=message,
            )
        if status == 'INVALID_ARGUMENT':
            return self.env._(
                'The Address Validation API could not process this '
                'address. Check the entered address and the country.'
                '\n\n%(message)s',
                message=message,
            )
        if status == 'UNAVAILABLE':
            return self.env._(
                'The Address Validation API is temporarily unreachable. '
                'Please try again in a moment.\n\n%(message)s',
                message=message,
            )
        return self.env._(
            'Address validation failed. Check that the Address '
            'Validation API is enabled for your Google Maps API key.'
            '\n\n%(message)s',
            message=message,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @api.model
    def validate_address(
        self,
        address_lines,
        region_code='',
        enable_usps_cass=False,
        language_code='',
    ):
        """Validate an address and normalize the response.

        :param list address_lines: entered address as free-form lines
        :param str region_code: ISO 3166-1 alpha-2 (CLDR) region code
        :param bool enable_usps_cass: request USPS CASS processing
            (US / PR only)
        :param str language_code: optional BCP-47 language code
        :return: normalized result, see :meth:`_parse_validation`
        """
        address = {'addressLines': list(address_lines)}
        region_code = (region_code or '').upper()
        if region_code:
            address['regionCode'] = region_code
        if language_code:
            address['languageCode'] = language_code

        payload = {'address': address}
        if enable_usps_cass and self.should_enable_cass(region_code):
            payload['enableUspsCass'] = True

        document = self._google_request(payload)
        return self._parse_validation(document)

    # ------------------------------------------------------------------
    # Response normalization
    # ------------------------------------------------------------------

    @api.model
    def _parse_validation(self, document):
        """Normalize a validateAddress REST response into the plain dict
        consumed by the ``AddressValidationDialog`` component and by
        ``res.partner.action_apply_google_address_validation``.

        The keys deliberately mirror the (camelCase) shape previously
        produced client-side so the dialog template needs no changes.

        :param dict document: full REST response
            (``{'result': {...}, 'responseId': ...}``)
        :return: normalized result dict
        """
        result = document.get('result') or {}
        address = result.get('address') or {}
        verdict_source = result.get('verdict') or {}

        verdict = {
            'inputGranularity': verdict_source.get('inputGranularity') or '',
            'validationGranularity': verdict_source.get(
                'validationGranularity'
            )
            or '',
            'geocodeGranularity': verdict_source.get('geocodeGranularity')
            or '',
            'possibleNextAction': verdict_source.get('possibleNextAction')
            or '',
            'addressComplete': bool(verdict_source.get('addressComplete')),
            'hasUnconfirmedComponents': bool(
                verdict_source.get('hasUnconfirmedComponents')
            ),
            'hasInferredComponents': bool(
                verdict_source.get('hasInferredComponents')
            ),
            'hasReplacedComponents': bool(
                verdict_source.get('hasReplacedComponents')
            ),
        }

        components = []
        for component in address.get('addressComponents') or []:
            name = component.get('componentName') or {}
            if not isinstance(name, dict):
                name = {'text': str(name)}
            components.append(
                {
                    'type': component.get('componentType') or '',
                    'name': name.get('text') or '',
                    'confirmationLevel': component.get('confirmationLevel')
                    or '',
                    'inferred': bool(component.get('inferred')),
                    'replaced': bool(component.get('replaced')),
                    'spellCorrected': bool(component.get('spellCorrected')),
                }
            )

        postal_source = address.get('postalAddress') or {}
        postal_address = {
            'addressLines': list(postal_source.get('addressLines') or []),
            'locality': postal_source.get('locality')
            or postal_source.get('sublocality')
            or '',
            'administrativeArea': postal_source.get('administrativeArea')
            or '',
            'postalCode': postal_source.get('postalCode') or '',
            'regionCode': postal_source.get('regionCode') or '',
        }

        usps_data = self._parse_usps_data(result.get('uspsData'))

        geocode = result.get('geocode') or {}
        location_source = geocode.get('location') or {}
        location = None
        latitude = location_source.get('latitude')
        longitude = location_source.get('longitude')
        if isinstance(latitude, (int, float)) and isinstance(
            longitude, (int, float)
        ):
            location = {'latitude': latitude, 'longitude': longitude}

        normalized = {
            'responseId': document.get('responseId') or '',
            'formattedAddress': address.get('formattedAddress') or '',
            'verdict': verdict,
            'components': components,
            'uspsData': usps_data,
            'missingComponentTypes': [
                str(t) for t in address.get('missingComponentTypes') or []
            ],
            'unresolvedTokens': [
                str(t) for t in address.get('unresolvedTokens') or []
            ],
            'postalAddress': postal_address,
            'location': location,
        }
        recommendation = self._compute_recommendation(verdict)
        normalized['recommendation'] = recommendation
        normalized['status'] = RECOMMENDATION_TO_STATUS.get(
            recommendation, 'not_validated'
        )
        return normalized

    @api.model
    def _parse_usps_data(self, usps_source):
        """Normalize the ``uspsData`` block (US / PR with CASS only)."""
        usps_source = usps_source or {}
        usps_address = usps_source.get('standardizedAddress') or {}
        if not usps_source.get('dpvConfirmation') and not usps_address:
            return None

        city_state_zip = usps_address.get('cityStateZipAddressLine')
        if not city_state_zip:
            zip_display = '-'.join(
                filter(
                    None,
                    [
                        usps_address.get('zipCode'),
                        usps_address.get('zipCodeExtension'),
                    ],
                )
            )
            city_state_zip = ' '.join(
                filter(
                    None,
                    [
                        usps_address.get('city'),
                        usps_address.get('state'),
                        zip_display,
                    ],
                )
            )

        return {
            'dpvConfirmation': usps_source.get('dpvConfirmation') or '',
            'standardizedAddress': ', '.join(
                filter(
                    None,
                    [
                        usps_address.get('firstAddressLine'),
                        usps_address.get('secondAddressLine'),
                        city_state_zip,
                    ],
                )
            ),
            'county': usps_source.get('county') or '',
            'dpvVacant': usps_source.get('dpvVacant') or '',
            'dpvNoStat': usps_source.get('dpvNoStat') or '',
        }

    @api.model
    def _compute_recommendation(self, verdict):
        """Accept / confirm / fix recommendation from a normalized verdict.

        Prefers the API's own ``possibleNextAction`` field when present
        (Preview), falling back to a heuristic based on the documented
        verdict fields.

        https://developers.google.com/maps/documentation/javascript
        /address-validation/build-validation-logic
        """
        next_action = (verdict.get('possibleNextAction') or '').upper()
        if next_action in RECOMMENDATION_TO_STATUS:
            return next_action
        granularity = (verdict.get('validationGranularity') or '').upper()
        if granularity in ('OTHER', 'GRANULARITY_UNSPECIFIED', ''):
            return RECOMMENDATION_FIX
        if (
            verdict.get('hasUnconfirmedComponents')
            or verdict.get('hasReplacedComponents')
            or verdict.get('hasInferredComponents')
            or not verdict.get('addressComplete')
        ):
            return RECOMMENDATION_CONFIRM
        return RECOMMENDATION_ACCEPT
