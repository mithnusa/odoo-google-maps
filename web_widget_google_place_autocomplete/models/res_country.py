# -*- coding: utf-8 -*-
from odoo import fields, models


class ResCountry(models.Model):
    _inherit = 'res.country'

    google_street_format = fields.Selection(
        selection=[
            ('street_number_route', 'Street Number + Route'),
            ('route_street_number', 'Route + Street Number'),
        ],
        string='Street Format',
        default='route_street_number',
        help='Define the format of the street address.\n'
        'For example, "123 Main St" can be formatted as "Main St 123" or "123 Main St".',
    )
