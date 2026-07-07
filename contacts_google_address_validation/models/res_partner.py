# -*- coding: utf-8 -*-
from markupsafe import Markup, escape

from odoo import api, fields, models
from odoo.exceptions import UserError

# Address fields that invalidate a previously stored verdict when edited
ADDRESS_FIELDS = (
    'street',
    'street2',
    'city',
    'zip',
    'state_id',
    'country_id',
)

VALIDATION_STATUSES = [
    ('not_validated', 'Not Validated'),
    ('valid', 'Validated'),
    ('needs_review', 'Needs Review'),
    ('invalid', 'Invalid'),
]

# See "Granularity" in the Maps JS API address-validation reference:
# developers.google.com/maps/documentation/javascript
#   /reference/address-validation#Granularity
VALIDATION_GRANULARITIES = [
    ('SUB_PREMISE', 'Sub-premise'),
    ('PREMISE', 'Premise'),
    ('PREMISE_PROXIMITY', 'Premise Proximity'),
    ('BLOCK', 'Block'),
    ('ROUTE', 'Route'),
    ('OTHER', 'Other'),
    ('GRANULARITY_UNSPECIFIED', 'Unspecified'),
]


class ResPartner(models.Model):
    _inherit = 'res.partner'

    google_address_validation_status = fields.Selection(
        VALIDATION_STATUSES,
        string='Address Validation',
        default='not_validated',
        readonly=True,
        copy=False,
        index=True,
        help='Result of the last Google Address Validation check. '
        'Reset to "Not Validated" whenever an address field is edited.',
    )
    google_address_validation_granularity = fields.Selection(
        VALIDATION_GRANULARITIES,
        string='Validation Granularity',
        readonly=True,
        copy=False,
        help='Level of detail the Google Address Validation API could fully validate the address to. '
        'PREMISE or SUB_PREMISE usually indicates a deliverable address. '
        '\n- PREMISE means the address is valid but may be missing a unit number. '
        '\n- SUB_PREMISE means the address is valid and includes a unit number. '
        '\n- BLOCK or ROUTE usually indicates a non-deliverable address. '
        '\n- OTHER or GRANULARITY_UNSPECIFIED means the API could not determine the level of detail.',
    )
    google_address_validation_date = fields.Datetime(
        string='Address Validated On',
        readonly=True,
        copy=False,
    )
    google_address_validation_response_id = fields.Char(
        string='Validation Response ID',
        readonly=True,
        copy=False,
        help='Unique identifier returned by the Google Address Validation '
        'API for the validation request.',
    )

    @api.model
    def _get_google_validation_reset_values(self):
        """Field values clearing a previously stored validation verdict."""
        return {
            'google_address_validation_status': 'not_validated',
            'google_address_validation_granularity': False,
            'google_address_validation_date': False,
            'google_address_validation_response_id': False,
        }

    @api.onchange(*ADDRESS_FIELDS)
    def _onchange_address_reset_google_validation(self):
        """Reset the stored verdict in the UI as soon as an address field is
        edited, without waiting for the record to be saved."""
        reset_values = self._get_google_validation_reset_values()
        for partner in self:
            partner.update(reset_values)

    def write(self, vals):
        # Any manual change to an address field invalidates the stored
        # verdict. When the validation flow itself writes the address, it
        # includes the status in the same vals, so no reset happens.
        if (
            any(f in vals for f in ADDRESS_FIELDS)
            and 'google_address_validation_status' not in vals
        ):
            vals = dict(vals, **self._get_google_validation_reset_values())
        return super().write(vals)

    def _prepare_google_address_lines(self):
        """Build the free-form address lines sent to the Address
        Validation API from the partner's address fields."""
        self.ensure_one()
        lines = [line for line in (self.street, self.street2) if line]
        last_line = ' '.join(
            filter(
                None,
                [
                    self.city,
                    self.state_id.name or '',
                    self.zip or '',
                ],
            )
        )
        if last_line:
            lines.append(last_line)
        return lines

    def action_google_validate_address(self):
        """Validate the partner's address with the Google Address
        Validation API (server-side).

        :return: dict with the entered address (for display) and the
            normalized validation result, consumed by the
            ``AddressValidationDialog`` component
        """
        self.ensure_one()
        lines = self._prepare_google_address_lines()
        if not lines:
            raise UserError(
                self.env._('Enter an address before validating it.')
            )

        service = self.env['google.address.validation']
        region_code = (self.country_id.code or '').upper()
        if region_code and not service.is_region_supported(region_code):
            raise UserError(
                self.env._(
                    'The Address Validation API is not available in the '
                    'country of this address (%(region)s).',
                    region=region_code,
                )
            )

        result = service.validate_address(
            lines,
            region_code=region_code,
            enable_usps_cass=service.should_enable_cass(region_code),
        )
        return {'entered': '\n'.join(lines), 'result': result}

    def action_apply_google_address_validation(self, result, apply_address):
        """Store the Google Address Validation verdict and optionally apply
        the standardized address returned by the API.

        Called from the ``google_address_validation`` form widget after the
        user reviews the validation dialog.

        :param dict result: normalized validation result returned by
            :meth:`action_google_validate_address` (see
            ``google.address.validation._parse_validation``)
        :param bool apply_address: write the standardized address back to
            the partner

        Note: Google / USPS standardized address strings are intentionally
        never persisted (fields, chatter, or logs) — see the Google Maps
        Platform Service Specific Terms, Table 1.3.2 (30-day caching cap).
        An address the user applies through the dialog is End User
        confirmed data and lives in the regular address fields.
        :return: True
        """
        self.ensure_one()
        result = result or {}
        verdict = result.get('verdict') or {}

        status = result.get('status')
        if status not in dict(VALIDATION_STATUSES):
            status = 'not_validated'

        granularity = verdict.get('validationGranularity')
        if granularity not in dict(VALIDATION_GRANULARITIES):
            granularity = False

        vals = {
            'google_address_validation_status': status,
            'google_address_validation_granularity': granularity,
            'google_address_validation_date': fields.Datetime.now(),
            'google_address_validation_response_id': result.get('responseId')
            or False,
        }

        if apply_address:
            postal_address = result.get('postalAddress') or {}
            lines = postal_address.get('addressLines') or []
            vals.update(
                self._prepare_google_validated_address(
                    {
                        'street': lines[0] if lines else '',
                        'street2': ', '.join(lines[1:]),
                        'city': postal_address.get('locality') or '',
                        'zip': postal_address.get('postalCode') or '',
                        'state_code': postal_address.get('administrativeArea')
                        or '',
                        'country_code': postal_address.get('regionCode') or '',
                    }
                )
            )
            location = result.get('location') or {}
            latitude = location.get('latitude')
            longitude = location.get('longitude')
            if (
                isinstance(latitude, (int, float))
                and isinstance(longitude, (int, float))
                and -90 <= latitude <= 90
                and -180 <= longitude <= 180
            ):
                # Always overwrite the geolocation with the geocode of the
                # validated address, even when coordinates are already set.
                vals['partner_latitude'] = latitude
                vals['partner_longitude'] = longitude

        self.write(vals)
        # Add info to the chatter for traceability
        items = [
            '<li>%s: %s</li>'
            % (
                self.env._('Status'),
                dict(VALIDATION_STATUSES).get(status, status),
            ),
            '<li>%s: %s</li>'
            % (
                self.env._('Granularity'),
                dict(VALIDATION_GRANULARITIES).get(granularity, granularity),
            ),
        ]
        if result.get('missingComponentTypes'):
            items.append(
                '<li>%s: %s</li>'
                % (
                    self.env._('Missing Components'),
                    escape(', '.join(result['missingComponentTypes'])),
                )
            )

        if result.get('recommendation'):
            items.append(
                '<li>%s: %s</li>'
                % (
                    self.env._('Recommendation'),
                    result.get('recommendation'),
                )
            )

        usps = result.get('uspsData') or {}
        dpv_code = (usps.get('dpvConfirmation') or '').upper()
        if dpv_code:
            dpv_labels = {
                'Y': self.env._('Deliverable'),
                'S': self.env._('Deliverable, secondary number dropped'),
                'D': self.env._('Confirmed, missing secondary number'),
                'N': self.env._('Not deliverable'),
            }
            items.append(
                '<li>%s: %s (%s)</li>'
                % (
                    self.env._('USPS DPV Confirmation'),
                    escape(dpv_code),
                    dpv_labels.get(dpv_code, self.env._('Unknown')),
                )
            )
        # Note: the Google / USPS standardized address strings and the USPS
        # county are deliberately NOT logged (nor stored anywhere else).
        # Chatter messages are kept forever, which would exceed the 30-day
        # caching period allowed by the Google Maps Platform Service
        # Specific Terms (Table 1.3.2). An address the user applies through
        # the dialog is End User confirmed data and lives in the regular
        # address fields.
        message_body = Markup(
            '<span>%s</span><ul>%s</ul>'
            % (self.env._('Google Address Validation Result'), ''.join(items))
        )

        self.message_post(body=message_body, subtype_xmlid='mail.mt_note')
        return True

    @api.model
    def _prepare_google_validated_address(self, address):
        """Convert a standardized address (from the API ``postalAddress``)
        into ``res.partner`` field values, resolving country and state
        Many2one records server-side.

        :param dict address: see :meth:`action_apply_google_address_validation`
        :return: dict of partner field values
        """
        vals = {}
        for field_name in ('street', 'street2', 'city', 'zip'):
            if field_name in address:
                vals[field_name] = address.get(field_name) or False

        country = self.env['res.country']
        country_code = (address.get('country_code') or '').strip()
        if country_code:
            country = country.search(
                [('code', '=ilike', country_code)], limit=1
            )
            if country:
                vals['country_id'] = country.id

        if not country:
            return vals

        state_value = (address.get('state_code') or '').strip()
        if state_value:
            state_domain = [
                ('country_id', '=', country.id),
                '|',
                ('code', '=ilike', state_value),
                ('name', '=ilike', state_value),
            ]
            state = self.env['res.country.state'].search(state_domain, limit=1)
            vals['state_id'] = state.id if state else False
        elif 'state_code' in address:
            vals['state_id'] = False

        return vals
