# -*- coding: utf-8 -*-
from odoo import fields, models, _


class GooglePlacesType(models.Model):
    _name = 'google.places.type'
    _description = 'Google Places Type'

    name = fields.Char(string='Name', required=True)
    code = fields.Char(string='Code', required=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ('type_unique', 'UNIQUE(code, name)', _('Name must be unique!'))]
