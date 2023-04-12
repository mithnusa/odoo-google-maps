# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
from odoo.tools.safe_eval import safe_eval


class Main(http.Controller):
    @http.route('/web/base_google_map/settings', type='json', auth='user')
    def map_setting(self):
        IrParam = request.env['ir.config_parameter'].sudo()

        api_key = IrParam.get_param('base_google_map.api_key', default='')
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
        }

        # Extras
        theme = IrParam.get_param('base_google_map.theme', default='default')
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

        values['theme'] = theme
        values['is_places_search_enable'] = is_places_search_enable

        if is_restrict_language and language:
            values['language'] = language

        return values
