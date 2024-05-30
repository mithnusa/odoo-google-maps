# -*- coding: utf-8 -*-
from odoo import api, models


class GoogleMapViewMixins(models.AbstractModel):
    _name = 'google.map.view.mixins'
    _description = 'Google Map View Mixins'

    @api.model
    def handle_find_action(self, actionId):
        if not actionId:
            return False

        action_data = (
            self.env['ir.model.data']
            .sudo()
            .search_read(
                [('res_id', '=', actionId), ('model', '=', 'ir.actions.act_window')],
                ['name', 'module'],
                limit=1,
            )
        )
        if not action_data:
            return False

        return '{model}.{key}'.format(
            model=action_data[0]['module'], key=action_data[0]['name']
        )

    @api.model
    def handle_find_action_form_view(self, action_id, res_id):
        if not action_id or not res_id:
            return False

        action_name = self.handle_find_action(action_id)
        if not action_name:
            return False

        action = self.env['ir.actions.actions']._for_xml_id(action_name)
        return dict(action, view_mode='form', res_id=res_id, views=[(False, 'form')])
