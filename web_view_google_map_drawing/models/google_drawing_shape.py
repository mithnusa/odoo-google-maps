# -*- coding: utf-8 -*-
from odoo import _, fields, models
from .fields import SearchableJson


class GoogleDrawingShape(models.AbstractModel):
    _name = 'google.drawing.shape'
    _description = 'Google Maps Shape Mixin'
    _rec_name = 'gshape_name'

    gshape_name = fields.Char(string='Name')
    gshape_area = fields.Float(
        string='Area',
        digits=(16, 2),
    )
    gshape_description = fields.Text(string='Description')
    gshape_geojson = SearchableJson(string='Shape GeoJSON')
    gshape_color = fields.Integer(default=1, string='Color')  # Paired with widget color picker
