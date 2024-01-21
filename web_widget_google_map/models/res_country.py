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

    def _parse_google_address_settings(self, address_component, google_address):
        """
        Parse the Google address settings based on the given address component and Google address.

        Args:
            address_component (str): The address component to parse.
            google_address (dict): The Google address dictionary.

        Returns:
            str: The parsed address based on the address component and Google address.
        """
        pattern = re.compile(r'[\|\ \,]')
        separator = '++'
        if not address_component or not isinstance(address_component, str):
            return None

        values = re.sub(pattern, separator, address_component.strip()).split(separator)
        address = list(filter(None, [google_address.get(f) for f in values]))

        if not address:
            return None

        if '|' in address_component:
            return address and address[0] or ''
        elif ',' in address_component:
            return ', '.join(address)
        else:
            return ' '.join(address)

    def prepare_google_address(self, address_components, field_mapping):
        """
        Prepare the address dictionary based on the given address components and field mapping.

        Args:
            address_components (list): A list of address components returned by the Google Maps API.
            field_mapping (dict): A dictionary mapping field names to corresponding keys in the address dictionary.

        Returns:
            dict: The prepared address dictionary.

        """
        if (
            not address_components
            or not isinstance(address_components, list)
            or not field_mapping
            or not isinstance(field_mapping, dict)
        ):
            return {}

        if not all(
            f in field_mapping.keys()
            for f in ['street', 'street2', 'city', 'zip', 'state_id', 'country_id']
        ):
            return {}

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
                if state_long_name or state_short_name:
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
                address[field_mapping['street']] = self._parse_google_address_settings(
                    country_id.google_street, google_address
                )
                # street2
                address[field_mapping['street2']] = self._parse_google_address_settings(
                    country_id.google_street2, google_address
                )
                # city
                address[field_mapping['city']] = self._parse_google_address_settings(
                    country_id.google_city, google_address
                )
                # zip
                address[field_mapping['zip']] = self._parse_google_address_settings(
                    country_id.google_zip, google_address
                )

        return address
