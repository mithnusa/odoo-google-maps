# -*- coding: utf-8 -*-
from odoo import fields, models


class GooglePlacesType(models.Model):
    _name = 'google.places.type'
    _description = 'Google Places Type'

    name = fields.Char(string='Name', required=True)
    code = fields.Char(string='Code', required=True)
    active = fields.Boolean(default=True)

    _name_code_unique = models.Constraint('UNIQUE(code, name)', 'Name must be unique!')
