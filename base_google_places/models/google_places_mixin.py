# -*- coding: utf-8 -*-
import base64
import requests

from odoo import api, fields, models, _

PHOTO_MAX_WIDTH = 480

GOOGLE_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/details/{}'
GOOGLE_PHOTO_URL = (
    'https://maps.googleapis.com/maps/api/place/photo?'
    'maxwidth={width}&photoreference={ref}&key={key}'
)
GOOGLE_PLUS_CODE_URL = 'https://plus.codes/{code}'

GOOGLE_PLACES_COMPONENT_FORM = {
    'street_number': 'long_name',
    'route': 'long_name',
    'intersection': 'short_name',
    'political': 'short_name',
    'country': 'short_name',
    'administrative_area_level_1': 'short_name',
    'administrative_area_level_2': 'short_name',
    'administrative_area_level_3': 'short_name',
    'administrative_area_level_4': 'short_name',
    'administrative_area_level_5': 'short_name',
    'colloquial_area': 'short_name',
    'locality': 'short_name',
    'ward': 'short_name',
    'sublocality_level_1': 'short_name',
    'sublocality_level_2': 'short_name',
    'sublocality_level_3': 'short_name',
    'sublocality_level_5': 'short_name',
    'neighborhood': 'short_name',
    'premise': 'short_name',
    'postal_code': 'short_name',
    'natural_feature': 'short_name',
    'airport': 'short_name',
    'park': 'short_name',
    'point_of_interest': 'long_name',
}

PLACES_FIELDS = [
    'formatted_address',
    'geometry',
    'name',
    'place_id',
    'plus_code',
    'type',
    'vicinity',
    'url',
]

ADDRESS_FIELS_MAPPING = {
    'street': ['route', 'street_number'],
    'street2': [
        'administrative_area_level_3',
        'administrative_area_level_4',
        'administrative_area_level_5',
    ],
    'city': ['administrative_area_level_2', 'locality'],
    'zip': ['postal_code'],
    'state_id': ['administrative_area_level_1'],
    'country_id': ['country'],
}


class GooglePlacesMixin(models.AbstractModel):
    _name = 'google.places.mixin'
    _description = 'Google Places Mixin'

    def _get_mapping_odoo_fields(self):
        '''Mapping odoo fields
        key: alias
        value: odoo fields
        '''
        return {
            'name': 'name',
            'street': 'street',
            'street2': 'street2',
            'city': 'city',
            'zip': 'zip',
            'state_id': 'state_id',
            'country_id': 'country_id',
            'lat': 'partner_latitude',
            'lng': 'partner_longitude',
            'phone': 'phone',
            'website': 'website',
        }

    def _get_mapping_component_address(self, mapping_fields):
        '''Mapping address fields with google component form'''
        values = {}
        values[mapping_fields.get('street')] = [
            'route',
            'street_number',
        ]
        values[mapping_fields.get('street2')] = [
            'administrative_area_level_3',
            'administrative_area_level_4',
            'administrative_area_level_5',
        ]
        values[mapping_fields.get('city')] = [
            'locality',
            'administrative_area_level_2',
        ]
        values[mapping_fields.get('zip')] = ['postal_code']
        values[mapping_fields.get('state_id')] = [
            'administrative_area_level_1'
        ]
        values[mapping_fields.get('country_id')] = ['country']
        return values

    @api.depends('gplace_plus_code_global')
    def compute_gplace_plus_url(self):
        for rec in self:
            if rec.gplace_plus_code_global:
                rec.gplace_plus_code_url = GOOGLE_PLUS_CODE_URL.format(
                    code=rec.gplace_plus_code_global
                )
            else:
                rec.gplace_plus_code_url = False

    gplace_formatted_address = fields.Char(string='Google Address')
    gplace_id = fields.Char(
        string='Place ID',
        help='A textual identifier that uniquely identifies a place',
    )
    gplace_url = fields.Char(string='Place URL')
    gplace_opening_hours = fields.Text(string='Opening Hours')
    gplace_type_ids = fields.Many2many(
        comodel_name='google.places.type',
        column1='address_id',
        column2='place_type',
        string='Types',
    )
    gplace_plus_code_global = fields.Char(string='Global Code')
    gplace_plus_code_compound = fields.Char(string='Compound Code')
    gplace_plus_code_url = fields.Char(
        compute='compute_gplace_plus_url', string='PLus code URL'
    )
    gplace_vicinity = fields.Char(
        string='Vicinity',
        help='A simplified address for the place, '
        'including the street name, street number, '
        'and locality, but not the province/state, '
        'postal code, or country',
    )
    gplace_photos_url = fields.Text(string='Photos')

    def _prepare_geolocation_fields(self, odoo_fields, location_dict):
        values = {}
        if (
            odoo_fields.get('lat')
            and location_dict.get('lat')
            and odoo_fields.get('lng')
            and location_dict.get('lng')
        ):
            values[odoo_fields['lat']] = location_dict['lat']
            values[odoo_fields['lng']] = location_dict['lng']

        return values

    def _mapping_address(self, address_components, field_mapping):
        values = {}
        for field, mapping in field_mapping.items():
            for component in address_components:
                component_type = component.get('types') or []
                for type_val in set(component_type).intersection(set(mapping)):
                    if values.get(field):
                        values[field].append(
                            component.get(
                                GOOGLE_PLACES_COMPONENT_FORM[type_val]
                            )
                        )
                    else:
                        values[field] = [
                            component.get(
                                GOOGLE_PLACES_COMPONENT_FORM[type_val]
                            )
                        ]

        street_delimiter = {'street': ' ', 'street2': ', '}
        for key, val in values.items():
            if key == 'city':
                try:
                    values[key] = list(filter(None, val))[0]
                except:
                    values[key] = ' '.join(val)
            else:
                fields_delimeter = street_delimiter.get(key) or ' '
                values[key] = fields_delimeter.join(val)

        return values

    def _prepare_address_fields(
        self, address_components, mode='create', field_mapping=None
    ):
        if field_mapping is None:
            field_mapping = ADDRESS_FIELS_MAPPING

        address = self._mapping_address(address_components, field_mapping)
        country_id = None

        odoo_fields = self._get_mapping_odoo_fields()
        country_field = odoo_fields.get('country_id')
        state_field = odoo_fields.get('state_id')
        if address.get(country_field):
            country_id = self.env['res.country'].search(
                [
                    '|',
                    ('name', '=', address[country_field]),
                    ('code', '=', address[country_field]),
                ]
            )
            if country_id:
                if mode == 'create':
                    address[country_field] = country_id.id
                elif mode == 'write':
                    address[country_field] = [
                        country_id.id,
                        country_id.display_name,
                    ]
            else:
                address.pop(country_field, None)

        if address.get(state_field) and country_id:
            state_id = self.env['res.country.state'].search(
                [
                    ('country_id', '=', country_id.id),
                    '|',
                    ('name', '=', address[state_field]),
                    ('code', '=', address[state_field]),
                ],
                limit=1,
            )
            if state_id:
                if mode == 'create':
                    address[state_field] = state_id.id
                elif mode == 'write':
                    address[state_field] = [state_id.id, state_id.display_name]
            else:
                address.pop(state_field, None)

        return address

    @api.model
    def action_google_place_quick_create(self, place_dict):
        place_id = place_dict.get('gplace_id')
        exists = False
        if place_id:
            values = {}
            record_count = self.search_count(
                [('gplace_id', '=', place_id)], limit=1
            )
            if record_count:
                exists = True
        else:
            values = self.default_get(self._fields.keys())

        place = place_dict.get('place')
        address_components = place.get('address_components')
        location = (place.get('geometry') or {}).get('location') or {}
        place.pop('photos', None)
        places_value = place_dict.get('values') or {}
        values.update(places_value)

        if values.get('gplace_type_ids'):
            gplace_type_ids = values['gplace_type_ids'].get('resIds') or []
            values['gplace_type_ids'] = [(6, 0, gplace_type_ids)]

        odoo_fields = self._get_mapping_odoo_fields()
        if place:
            if odoo_fields.get('name') and place.get('name'):
                values[odoo_fields['name']] = place['name']

            if odoo_fields.get('website') and place.get('website'):
                values[odoo_fields['website']] = place['website']

            if odoo_fields.get('phone') and place.get(
                'international_phone_number'
            ):
                values[odoo_fields['phone']] = place[
                    'international_phone_number'
                ]

            # address
            if address_components:
                address_values = self._prepare_address_fields(
                    address_components
                )
                values.update(address_values)

            # geolocation
            if location:
                geo_values = self._prepare_geolocation_fields(
                    odoo_fields, location
                )
                values.update(geo_values)

            if (
                values.get('gplace_photos_url')
                and 'image_1920' in self._fields
            ):
                photos = values['gplace_photos_url'].split(',')
                image = self._google_get_place_image(photos[0])
                if image:
                    values['image_1920'] = image

        if exists:
            return values

        default_values = self.env.context.copy()
        for key, val in values.items():
            default_values['default_{}'.format(key)] = val

        return default_values

    @api.model
    def action_google_place_update(self, place_dict):
        values = {}
        place = place_dict.get('place')
        address_components = place.get('address_components')

        location = (place.get('geometry') or {}).get('location') or {}
        place.pop('photos', None)

        places_value = place_dict.get('values') or {}
        values.update(places_value)

        odoo_fields = self._get_mapping_odoo_fields()
        if place:
            if odoo_fields.get('name') and place.get('name'):
                values[odoo_fields['name']] = place['name']

            if odoo_fields.get('website') and place.get('website'):
                values[odoo_fields['website']] = place['website']

            if odoo_fields.get('phone') and place.get(
                'international_phone_number'
            ):
                values[odoo_fields['phone']] = place[
                    'international_phone_number'
                ]

            # address
            if address_components:
                address_values = self._prepare_address_fields(
                    address_components,
                    mode='write',
                )
                values.update(address_values)

            # geolocation
            if location:
                geo_values = self._prepare_geolocation_fields(
                    odoo_fields, location
                )
                values.update(geo_values)

            if (
                values.get('gplace_photos_url')
                and 'image_1920' in self._fields
            ):
                photos = values['gplace_photos_url'].split(',')
                image = self._google_get_place_image(photos[0])
                if image:
                    values['image_1920'] = image

        return values

    def _google_get_place_image(self, photo_url):
        if photo_url:
            try:
                res = requests.get(photo_url, timeout=5)
                if res.status_code != requests.codes.ok:
                    return False
            except requests.exceptions.ConnectionError:
                return False
            except requests.exceptions.Timeout:
                return False
            return base64.b64encode(res.content)
        return None
