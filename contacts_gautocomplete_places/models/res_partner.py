# -*- coding: utf-8 -*-
from odoo import api, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.onchange('street', 'zip', 'city', 'state_id', 'country_id')
    def _delete_coordinates(self):
        """An overwrite method to prevent the deletion of the coordinates"""
        pass
