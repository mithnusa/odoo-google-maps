# -*- coding: utf-8 -*-
from odoo import fields, models


class StockPicking(models.Model):
    _inherit = 'stock.picking'

    partner_latitude = fields.Float(related='partner_id.partner_latitude', string='Delivery Latitude')
    partner_longitude = fields.Float(related='partner_id.partner_longitude', string='Delivery Longitude')
