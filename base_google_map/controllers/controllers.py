# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
from odoo.tools.safe_eval import safe_eval


class Main(http.Controller):
    @http.route('/web/base_google_map/theme', type='json', auth='user')
    def map_theme(self):
        theme = (
            request.env['ir.config_parameter']
            .sudo()
            .get_param('base_google_map.theme', default='default')
        )
        res = {'theme': theme}
        return res

    @http.route(
        '/web/base_google_map/google_autocomplete_conf',
        type='json',
        auth='user',
    )
    def google_autocomplete_settings(self):
        get_param = http.request.env['ir.config_parameter'].sudo().get_param
        is_lang_restrict = safe_eval(
            get_param(
                'base_google_map.autocomplete_lang_restrict', default='False'
            )
        )
        lang = get_param('base_google_map.lang_localization', default=False)

        result = {}
        if is_lang_restrict and lang:
            result['language'] = lang

        return result
