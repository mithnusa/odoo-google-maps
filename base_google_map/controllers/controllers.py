# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
from odoo.tools.safe_eval import safe_eval


class Main(http.Controller):
    @http.route('/web/base_google_map/settings', type='json', auth='user')
    def map_setting(self):
        IrParam = request.env['ir.config_parameter'].sudo()

        api_key = IrParam.get_param('base_google_map.api_key', default='')
        map_id = IrParam.get_param('base_google_map.map_id', default='')
        libraries = IrParam.get_param(
            'base_google_map.libraries', default='geometry'
        )
        region = IrParam.get_param(
            'base_google_map.region_localization', default=''
        )
        version = IrParam.get_param(
            'base_google_map.version', default='quarterly'
        )

        values = {
            'api_key': api_key,
            'libraries': [lib.strip() for lib in libraries.split(',')],
            'region': region,
            'version': version,
            'map_id': map_id,
        }

        # Extras
        color_scheme = IrParam.get_param('base_google_map.color_scheme', default='')
        is_places_search_enable = safe_eval(
            IrParam.get_param(
                'base_google_map.enable_map_place_search', default='False'
            )
        )
        is_restrict_language = safe_eval(
            IrParam.get_param(
                'base_google_map.autocomplete_lang_restrict', default='False'
            )
        )
        language = IrParam.get_param(
            'base_google_map.lang_localization', default=''
        )
        # if is_restrict_language and language:
        values['language'] = language
        values['restrict_language'] = is_restrict_language

        values['color_scheme'] = color_scheme
        values['is_places_search_enable'] = is_places_search_enable

        # Autocomplete country restriction
        is_restrict_country = safe_eval(
            IrParam.get_param(
                'base_google_map.autocomplete_country_restrict', default='False'
            )
        )
        values['autocomplete_restrict_country'] = is_restrict_country

        country_codes = IrParam.get_param(
            'base_google_map.autocomplete_country_restriction', default=''
        )
        values['autocomplete_list_countries_restriction'] = []
        if country_codes:
            country_codes_list = country_codes.lower().split(',')
            # Support up to 5 countries (https://developers.google.com/maps/documentation/javascript/place-autocomplete#restrict-predictions-to-a-specific-country)
            countries = list(filter(None, [c.strip() for c in country_codes_list[:5]]))
            if countries:
                values['autocomplete_list_countries_restriction'] = countries

        return values
