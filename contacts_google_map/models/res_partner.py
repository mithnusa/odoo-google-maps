# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    marker_color = fields.Integer(string='Marker Color', default=1)

    @api.model
    def action_cron_geolocalize(self):
        self.search(
            [
                '&',
                ('country_id', '!=', False),
                '|',
                ('partner_latitude', '=', False),
                ('partner_longitude', '=', False),
            ],
            limit=500,
        ).geo_localize()
        return True
