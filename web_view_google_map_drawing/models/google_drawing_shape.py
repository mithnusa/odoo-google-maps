# -*- coding: utf-8 -*-
import logging
from odoo import _, api, fields, models
from odoo.tools.safe_eval import safe_eval


_logger = logging.getLogger(__name__)


class GoogleDrawingShape(models.AbstractModel):
    _name = 'google.drawing.shape'
    _description = 'Google Maps Shape Mixin'
    _rec_name = 'gshape_name'

    @api.depends('gshape_paths', 'gshape_type')
    def _compute_gshape_polygon_lines(self):
        Qweb = self.env["ir.qweb"]
        for shape in self:
            description = []
            if shape.gshape_type == 'polygon' and shape.gshape_paths:
                try:
                    paths = safe_eval(shape.gshape_paths)
                    if paths.get('lines'):
                        lines = paths['lines']
                        total_lines = len(lines)
                        for line, data in lines.items():
                            line_idx = int(line)
                            description.append(
                                {
                                    'start': line_idx,
                                    'stop': line_idx + 1
                                    if line_idx < total_lines
                                    else 1,
                                    'distance': '{:.2f}'.format(
                                        data.get('length') or 0.0
                                    ),
                                },
                            )
                except Exception as err:
                    _logger.error(err)

            shape.gshape_polygon_lines = Qweb._render(
                'web_view_google_map_drawing.polygon_lines',
                {'lines': description},
            )

    gshape_name = fields.Char(string='Name')
    gshape_area = fields.Float(
        string='Area',
        digits=(16, 2),
    )
    gshape_radius = fields.Float(
        default=0.0,
        string='Radius',
        digits=(16, 2),
    )
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
    gshape_width = fields.Float(
        default=0.0,
        string='Width',
        help='Width of Rectangle',
        digits=(16, 2),
    )
    gshape_height = fields.Float(
        default=0.0,
        string='Height',
        help='Height of Rectangle',
        digits=(16, 2),
    )
    gshape_polygon_lines = fields.Html(
        string='Lines', compute='_compute_gshape_polygon_lines'
    )

    def decode_shape_paths(self):
        self.ensure_one()
        return safe_eval(self.gshape_paths)
