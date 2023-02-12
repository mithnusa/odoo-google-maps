# -*- coding: utf-8 -*-
from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    marker_color = fields.Integer(string='Marker Color', default=1)
