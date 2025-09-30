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
        values[mapping_fields.get('state_id')] = ['administrative_area_level_1']
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
                            component.get(GOOGLE_PLACES_COMPONENT_FORM[type_val])
                        )
                    else:
                        values[field] = [
                            component.get(GOOGLE_PLACES_COMPONENT_FORM[type_val])
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

    def _prepare_address_fields(self, address_components, mode='create'):
        print('\n\n\t _prepare_address_fields ')
        print('address_components: ', address_components)
        print('mode: ', mode)
        odoo_fields = self._get_mapping_odoo_fields()
        google_address = self.env['res.country'].prepare_google_address(
            address_components, odoo_fields
        )

        # if mode == 'create':
        #     if google_address.get('country_id'):
        #         google_address['country_id'] = google_address['country_id'][0]
        #     if google_address.get('state_id'):
        #         google_address['state_id'] = google_address['state_id'][0]
        
        print('\n\n\t google_address: ', google_address, '\n\n')
        return google_address

    @api.model
    def action_google_place_quick_create(self, place_dict):
        place_id = place_dict.get('gplace_id')
        exists = False
        if place_id:
            values = {}
            record_count = self.search_count([('gplace_id', '=', place_id)], limit=1)
            if record_count:
                exists = True
        else:
            values = self.default_get(self._fields.keys())

        place = place_dict.get('place')
        address_components = place.get('addressComponents')
        location = place.get('location') or {}
        place.pop('photos', None)
        places_value = place_dict.get('values') or {}
        values.update(places_value)

        if values.get('gplace_type_ids'):
            values['gplace_type_ids'] = values['gplace_type_ids']

        odoo_fields = self._get_mapping_odoo_fields()
        if place:
            if odoo_fields.get('name') and place.get('displayName'):
                values[odoo_fields['name']] = place['displayName']

            if odoo_fields.get('website') and place.get('website'):
                values[odoo_fields['website']] = place['website']

            if odoo_fields.get('phone'):
                values[odoo_fields['phone']] = place.get('internationalPhoneNumber') or place.get('nationalPhoneNumber')

            # address
            if address_components:
                address_values = self._prepare_address_fields(address_components)
                values.update(address_values)

            # geolocation
            if location:
                geo_values = self._prepare_geolocation_fields(odoo_fields, location)
                values.update(geo_values)

        if exists:
            return values

        default_values = {}
        for key, val in values.items():
            default_values['default_{}'.format(key)] = val

        return default_values

    @api.model
    def action_google_place_update(self, place_dict):
        print('\n\n\t action_google_place_update ')
        print('place_dict: ', place_dict, '\n\n')
        values = {}
        place = place_dict.get('place')
        address_components = place.get('addressComponents') or {}

        location = place.get('location') or {}

        places_value = place_dict.get('values') or {}
        values.update(places_value)

        odoo_fields = self._get_mapping_odoo_fields()
        if place:
            if odoo_fields.get('name') and place.get('displayName'):
                values[odoo_fields['name']] = place['displayName']

            if odoo_fields.get('website') and place.get('websiteURI'):
                values[odoo_fields['website']] = place['websiteURI']

            if odoo_fields.get('phone'):
                values[odoo_fields['phone']] = place.get('internationalPhoneNumber') or place.get('nationalPhoneNumber')

            # address
            if address_components:
                address_values = self._prepare_address_fields(
                    address_components,
                    mode='write',
                )
                values.update(address_values)

            # geolocation
            if location:
                geo_values = self._prepare_geolocation_fields(odoo_fields, location)
                values.update(geo_values)

        return values
