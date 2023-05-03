# -*- coding: utf-8 -*-
import base64
import requests
from requests.exceptions import HTTPError

from odoo import api, exceptions, fields, models, _

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
    'business_status',
    'formatted_address',
    'geometry',
    'icon',
    'name',
    'place_id',
    'plus_code',
    'type',
    'rating',
    'vicinity',
    'user_ratings_total',
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


def google_place_by_id(api_key, place_id):
    gfields = ','.join(PLACES_FIELDS)
    request = 'json?key={0}&place_id={1}&fields={2}'.format(
        api_key, place_id, gfields
    )
    url = GOOGLE_PLACE_URL.format(request)
    return requests.get(url)


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
        values[mapping_fields.get('street')] = ['route', 'street_number']
        values[mapping_fields.get('street2')] = [
            'administrative_area_level_3',
            'administrative_area_level_4',
            'administrative_area_level_5',
        ]
        values[mapping_fields.get('city')] = ['locality']
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

    def google_action_update_place(self):
        places = self.google_get_place_by_id()
        if places:
            for record in self:
                record.update(places.get(record.id))

    def google_get_place_by_id(self):
        result = {}
        google_api_key = (
            self.env['ir.config_parameter']
            .sudo()
            .get_param('base_google_map.api_key', default='')
        )
        if not google_api_key:
            return

        for record in self:
            if record.gplace_id:
                try:
                    response = google_place_by_id(
                        google_api_key, record.gplace_id
                    )
                    # If the response was successful,
                    # no Exception will be raised
                    response.raise_for_status()
                except HTTPError as http_err:
                    raise exceptions.UserError(http_err)
                except Exception as err:
                    raise exceptions.UserError(err)
                else:
                    response_json = response.json()
                    if response_json.get('error_message'):
                        raise exceptions.UserError(
                            '{}\n{}'.format(
                                response_json.get('status'),
                                response_json['error_message'],
                            )
                        )
                    elif response_json.get('result'):
                        place = response_json['result']
                        result[record.id] = self._google_prepare_places(
                            google_api_key, place
                        )

        return result

    def _google_prepare_places(self, api_key, place_dict):
        odoo_fields = self._get_mapping_odoo_fields()
        values = {
            'gplace_formatted_address': place_dict.get('formatted_address')
            or '',
            'gplace_url': place_dict.get('url'),
            'gplace_vicinity': place_dict.get('vicinity') or '',
            'name': place_dict.get('name'),
        }

        if place_dict.get('address_components'):
            address_values = self._prepare_address_fields(
                place_dict['address_components']
            )
            values.update(address_values)

        if place_dict.get('photos'):
            photos = []
            # The response of a successful Place Photo request will be an image.
            # The type of the image will depend upon the type of the originally
            # submitted photo.
            # If your request exceeds your available quota,
            # the server will return an HTTP 403 status
            # more on: https://developers.google.com/places/web-service/photos
            for photo in place_dict['photos'][:3]:
                photo_url = GOOGLE_PHOTO_URL.format(
                    width=PHOTO_MAX_WIDTH,
                    ref=photo['photo_reference'],
                    key=api_key,
                )
                photos.append(photo_url)

            values['gplace_photos_url'] = ','.join(photos)

        if place_dict.get('types'):
            place_types = self.env['google.places.type'].search(
                [('code', 'in', place_dict['types'])]
            )

            values['gplace_type_ids'] = [(6, 0, place_types.ids)]

        if place_dict.get('opening_hours'):
            values['gplace_opening_hours'] = '\n'.join(
                place_dict['opening_hours']['weekday_text']
            )

        if place_dict.get('plus_code'):
            values.update(
                {
                    'gplace_plus_code_global': place_dict['plus_code'][
                        'global_code'
                    ],
                    'gplace_plus_code_compound': place_dict['plus_code'][
                        'compound_code'
                    ],
                }
            )

        location = (place_dict.get('geometry') or {}).get('location') or {}
        # geometry
        geo_values = self._prepare_geolocation_fields(odoo_fields, location)
        values.update(geo_values)
        return values

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

        for key, val in values.items():
            values[key] = ' '.join(val)

        return values

    def _prepare_address_fields(self, address_components, field_mapping=None):
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
                address[country_field] = country_id.id
            else:
                address.pop(country_field, None)

        if address.get(state_field) and country_id:
            state_id = self.env['res.country.state'].search(
                [
                    ('country_id', '=', country_id.id),
                    ('code', '=', address[state_field]),
                ],
                limit=1,
            )
            if state_id:
                address[state_field] = state_id.id
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
            gplace_type_ids = values['gplace_type_ids'].get('ids')
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
