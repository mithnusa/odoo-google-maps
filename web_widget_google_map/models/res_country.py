# -*- coding: utf-8 -*-
import re
from odoo import fields, models


class ResCountry(models.Model):
    _inherit = 'res.country'

    def _default_google_street(self):
        return 'route street_number'

    def _default_google_street2(self):
        return 'administrative_area_level_4, administrative_area_level_3, administrative_area_level_5'

    def _default_google_city(self):
        return 'locality | administrative_area_level_2'

    def _default_google_state(self):
        return 'administrative_area_level_1'

    def _default_google_zip(self):
        return 'postal_code'

    def _default_google_country(self):
        return 'country'

    google_street = fields.Char(
        string='Street',
        default=lambda self: self._default_google_street(),
    )
    google_street2 = fields.Char(
        string='Street2',
        default=lambda self: self._default_google_street2(),
    )
    google_city = fields.Char(
        string='City',
        default=lambda self: self._default_google_city(),
    )
    google_state = fields.Char(
        string='State',
        default=lambda self: self._default_google_state(),
    )
    google_zip = fields.Char(
        string='Zip/Postal Code',
        default=lambda self: self._default_google_zip(),
    )
    google_country = fields.Char(
        string='Country',
        default=lambda self: self._default_google_country(),
    )

    def prepare_google_address(self, address_components, field_mapping):
        country_long_name = ''
        country_short_name = ''

        state_long_name = ''
        state_short_name = ''

        google_address = {}
        for component in address_components:
            # hardcoded types 'country' for country
            if 'country' in component['types']:
                country_long_name = component['long_name']
                country_short_name = component['short_name']

            # hardcoded types 'administrative_area_level_1' for state
            if 'administrative_area_level_1' in component['types']:
                state_long_name = component['long_name']
                state_short_name = component['short_name']

            for type in component['types']:
                google_address[type] = component['long_name']

        address = {}
        if country_short_name or country_long_name:
            country_id = self.env['res.country'].search(
                [
                    '|',
                    ('code', '=', country_short_name),
                    ('name', '=', country_long_name),
                ],
                limit=1,
            )
            if country_id:
                address[field_mapping['country_id']] = [
                    country_id.id,
                    country_id.name,
                ]

                pattern = re.compile(r'[\|\ \,]')
                separator = '++'

                # state
                state_id = self.env['res.country.state'].search(
                    [
                        ('country_id', '=', country_id.id),
                        '|',
                        ('code', '=', state_short_name),
                        ('name', '=', state_long_name),
                    ],
                    limit=1,
                )
                if state_id:
                    address[field_mapping['state_id']] = [
                        state_id.id,
                        state_id.name,
                    ]

                # street
                street = re.sub(
                    pattern, separator, country_id.google_street.strip()
                ).split(separator)
                street_vals = list(
                    filter(None, [google_address.get(f) for f in street])
                )

                if '|' in country_id.google_street:
                    address[field_mapping['street']] = (
                        street_vals and street_vals[0] or ''
                    )
                else:
                    address[field_mapping['street']] = ' '.join(street_vals)

                # street2
                street2 = re.sub(
                    pattern, separator, country_id.google_street2.strip()
                ).split(separator)
                street2_vals = list(
                    filter(
                        None, [google_address.get(f) or '' for f in street2]
                    )
                )

                if '|' in country_id.google_street2:
                    address[field_mapping['street2']] = (
                        street2_vals and street2_vals[0] or ''
                    )
                elif ',' in country_id.google_street2:
                    address[field_mapping['street2']] = ', '.join(street2_vals)
                else:
                    address[field_mapping['street2']] = ' '.join(street2_vals)

                # city
                city = re.sub(
                    pattern, separator, country_id.google_city.strip()
                ).split(separator)
                city_vals = list(
                    filter(None, [google_address.get(f) or '' for f in city])
                )
                address[field_mapping['city']] = (
                    city_vals and city_vals[0] or ''
                )

                # zip
                zip = re.sub(
                    pattern, separator, country_id.google_zip.strip()
                ).split(separator)
                zip_vals = list(
                    filter(None, [google_address.get(f) or '' for f in zip])
                )
                address[field_mapping['zip']] = zip_vals and zip_vals[0] or ''

        return address
