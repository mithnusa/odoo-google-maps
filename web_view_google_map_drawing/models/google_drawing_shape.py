# -*- coding: utf-8 -*-
import logging
from odoo import _, api, fields, models
from odoo.tools.safe_eval import safe_eval
from .fields import SearchableJson


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
    gshape_geojson = SearchableJson(string='Shape GeoJSON')

    def decode_shape_paths(self):
        self.ensure_one()
        return safe_eval(self.gshape_paths)

    @api.model
    def create_from_geojson_feature(self, feature_data, default_values=None):
        """Create a shape record from GeoJSON feature data"""
        if default_values is None:
            default_values = {}
            
        # Extract geometry data
        geometry = feature_data.get('geometry', {})
        properties = feature_data.get('properties', {})
        
        # Prepare values for creation
        values = {
            'gshape_name': properties.get('name', default_values.get('name', 'Imported Shape')),
            'gshape_description': properties.get('description', default_values.get('description', '')),
            'gshape_geojson': feature_data,
        }
        
        # Determine shape type and extract specific data
        geom_type = geometry.get('type', '').lower()
        coordinates = geometry.get('coordinates', [])
        
        if geom_type == 'polygon':
            values.update({
                'gshape_type': 'polygon',
                'gshape_paths': str({'coordinates': coordinates}),
            })
            # Calculate area if possible
            area = properties.get('area', 0.0)
            if area:
                values['gshape_area'] = area
                
        elif geom_type == 'point':
            # For points, create a small circle
            values.update({
                'gshape_type': 'circle',
                'gshape_radius': properties.get('radius', 100.0),
                'gshape_paths': str({'center': coordinates}),
            })
            
        elif geom_type in ['linestring', 'multilinestring']:
            # Convert to polygon for compatibility
            values.update({
                'gshape_type': 'polygon',
                'gshape_paths': str({'coordinates': coordinates}),
            })
            
        # Add any additional default values
        values.update(default_values)
        
        return self.create(values)

    @api.model
    def import_geojson_features(self, features_data, default_values=None):
        """Import multiple GeoJSON features"""
        created_records = self.env[self._name]
        
        for feature_data in features_data:
            try:
                record = self.create_from_geojson_feature(feature_data, default_values)
                created_records |= record
            except Exception as e:
                _logger.error(f"Failed to import feature: {e}")
                
        return created_records
