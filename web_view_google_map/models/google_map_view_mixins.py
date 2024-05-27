# -*- coding: utf-8 -*-
from odoo import api, models
from odoo.osv import expression
from odoo.tools.safe_eval import safe_eval


class GoogleMapViewMixins(models.AbstractModel):
    _name = 'google.map.view.mixins'
    _description = 'Google Map View Mixins'

    @api.model
    def handle_see_more(self, xml_id, domain=None, context=None):
        action = self.sudo().env.ref(xml_id).read()[0]
        if domain:
            if action.get('domain'):
                if isinstance(action['domain'], str):
                    action['domain'] = expression.AND(
                        [safe_eval(action['domain']), domain]
                    )
                else:
                    action['domain'] = expression.AND([action['domain'], domain])
            else:
                action['domain'] = domain

        if context:
            if action.get('context'):
                action['context'] = safe_eval(action['context'])
                action['context'].update(context)
            else:
                action['context'] = context
        return action

    @api.model
    def handle_get_geolocation_fields(self, model, field_lat, field_lng):
        if not field_lat or not field_lng or not model:
            return False

        values = {}
        for rec in (
            self.env['ir.model.fields']
            .sudo()
            .search(
                [
                    ('model', '=', model),
                    ('name', 'in', [field_lat, field_lng]),
                ]
            )
        ):
            if rec.store:
                values[rec.name] = rec.name
            elif not rec.store and rec.related:
                values[rec.name] = rec.related

        return values

    @api.model
    def handle_find_action(self, actionId):
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


# handle_generate_geolocation_domain
