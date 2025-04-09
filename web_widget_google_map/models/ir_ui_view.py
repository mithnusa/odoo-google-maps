# -*- coding: utf-8 -*-
from odoo import api, models


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    @api.model
    def get_google_form_view_id(self, model_name):
        domain = [
            ('arch_db', 'ilike', 'js_class="google_map_form"'),
            ('model', '=', model_name),
        ]
        view = self.sudo().search_read(domain, ['id'], limit=1)
        return view and view[0]['id'] or False
