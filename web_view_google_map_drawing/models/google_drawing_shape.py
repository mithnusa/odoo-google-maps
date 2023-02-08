# -*- coding: utf-8 -*-
from odoo import fields, models
from odoo.tools.safe_eval import safe_eval


class GoogleDrawingShape(models.AbstractModel):
    _name = 'google.drawing.shape'
    _description = 'Google Maps Shape Mixin'
    _rec_name = 'gshape_name'

    gshape_name = fields.Char(string='Name')
    gshape_area = fields.Float(string='Area')
    gshape_radius = fields.Float(string='Radius')
    gshape_description = fields.Text(string='Description')
    gshape_type = fields.Selection(
        [
            ('circle', 'Circle'),
            ('polygon', 'Polygon'),
            ('rectangle', 'Rectangle'),
        ],
        string='Type',
        default='polygon',
        required=True,
    )
    gshape_paths = fields.Text(string='Data JSON of shape path')

    def decode_shape_paths(self):
        self.ensure_one()
        return safe_eval(self.gshape_paths)
