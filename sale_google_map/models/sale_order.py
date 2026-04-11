# -*- coding: utf-8 -*-
from odoo import fields, models


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    partner_latitude = fields.Float(
        related='partner_id.partner_latitude',
        string='Latitude',
        store=True,
    )
    partner_longitude = fields.Float(
        related='partner_id.partner_longitude',
        string='Longitude',
        store=True,
    )
