# -*- coding: utf-8 -*-
from odoo import fields, models


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    partner_latitude = fields.Float(
        related='partner_id.partner_latitude',
        string='Latitude',
    )
    partner_longitude = fields.Float(
        related='partner_id.partner_longitude',
        string='Longitude',
    )
    partner_contact_address = fields.Char(
        related='partner_id.contact_address',
        string='Complete Address',
    )
