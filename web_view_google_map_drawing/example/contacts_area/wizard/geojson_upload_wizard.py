# -*- coding: utf-8 -*-
import json
import logging
import base64
from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)


class GeoJsonUploadWizard(models.TransientModel):
    _name = 'google.geojson.upload.wizard'
    _description = 'GeoJSON File Upload Wizard'

    name = fields.Char(string='Upload Name', required=True, default='GeoJSON Import')
    geojson_file = fields.Binary(string='GeoJSON File', required=True)
    filename = fields.Char(string='Filename')
    target_model = fields.Char(string='Target Model', required=True)
    
    # Import options
    overwrite_existing = fields.Boolean(
        string='Overwrite Existing Records',
        default=True,
        help='If enabled, existing records with same names will be updated'
    )
    default_description = fields.Text(
        string='Default Description',
        help='Default description for imported features'
    )
    # feature_name_field = fields.Selection([
    #     ('name', 'Use "name" property'),
    #     ('id', 'Use feature ID'),
    #     ('auto', 'Auto-generate names'),
    # ], string='Feature Name Source', default='name', required=True)
    feature_name = fields.Char(
        string='Feature Name Source',
        default='name',
        required=True,
        help="Field in properties to use as feature name: 'name', 'id', or 'auto' for auto-generated names"
    )
    
    # Preview fields
    preview_data = fields.Text(string='Preview Data', readonly=True)
    feature_count = fields.Integer(string='Feature Count', readonly=True)
    
    @api.onchange('geojson_file')
    def _onchange_geojson_file(self):
        """Preview the GeoJSON file content"""
        if self.geojson_file:
            try:
                # Decode the file
                file_content = base64.b64decode(self.geojson_file).decode('utf-8')
                geojson_data = json.loads(file_content)
                
                # Validate GeoJSON structure
                self._validate_geojson(geojson_data)
                
                # Update preview
                features = geojson_data.get('features', [])
                self.feature_count = len(features)
                
                # Create preview summary
                preview = self._create_preview_summary(features)
                self.preview_data = preview
                
            except UnicodeDecodeError:
                raise UserError(_('Invalid file encoding. Please upload a UTF-8 encoded file.'))
            except json.JSONDecodeError as e:
                raise UserError(_('Invalid JSON format: %s') % str(e))
            except ValidationError as e:
                raise UserError(str(e))
            except Exception as e:
                _logger.error('Error processing GeoJSON file: %s', e)
                raise UserError(_('Error processing GeoJSON file: %s') % str(e))

    def _validate_geojson(self, geojson_data):
        """Validate GeoJSON structure"""
        if not isinstance(geojson_data, dict):
            raise ValidationError(_('GeoJSON must be a JSON object'))
        
        if geojson_data.get('type') != 'FeatureCollection':
            raise ValidationError(_('GeoJSON must be a FeatureCollection'))
        
        features = geojson_data.get('features', [])
        if not features:
            raise ValidationError(_('GeoJSON must contain at least one feature'))
        
        # Validate each feature
        for i, feature in enumerate(features):
            if not isinstance(feature, dict):
                raise ValidationError(_('Feature %d is not a valid object') % (i + 1))
            
            if feature.get('type') != 'Feature':
                raise ValidationError(_('Feature %d is not a valid Feature type') % (i + 1))
            
            geometry = feature.get('geometry')
            if not geometry or not geometry.get('type'):
                raise ValidationError(_('Feature %d has invalid geometry') % (i + 1))
            
            # Check for supported geometry types
            supported_types = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'Circle']
            if geometry.get('type') not in supported_types:
                _logger.warning('Feature %d has unsupported geometry type: %s', i + 1, geometry.get('type'))

    def _create_preview_summary(self, features):
        """Create a preview summary of the features"""
        geometry_counts = {}
        feature_names = []
        
        for i, feature in enumerate(features[:10]):  # Show first 10 features
            geometry_type = feature.get('geometry', {}).get('type', 'Unknown')
            geometry_counts[geometry_type] = geometry_counts.get(geometry_type, 0) + 1
            
            # Extract feature name based on selected method
            feature_name = self._extract_feature_name(feature, i + 1)
            feature_names.append(f"{i + 1}. {feature_name} ({geometry_type})")
        
        preview_lines = [
            f"Total Features: {len(features)}",
            "",
            "Geometry Types:",
        ]
        
        for geom_type, count in geometry_counts.items():
            preview_lines.append(f"  - {geom_type}: {count}")
        
        preview_lines.extend([
            "",
            "Sample Features:",
        ])
        preview_lines.extend(feature_names)
        
        if len(features) > 10:
            preview_lines.append(f"... and {len(features) - 10} more features")
        
        return "\n".join(preview_lines)

    def _extract_feature_name(self, feature, index):
        """Extract feature name based on the selected method"""
        properties = feature.get('properties', {})
        feature_name = None

        if not self.feature_name in properties.keys():
            raise UserError(_('The specified feature name source "%s" does not exist in feature properties. Please close the pop-up window and try again') % self.feature_name)

        if properties.get(self.feature_name):
            feature_name = str(properties.get(self.feature_name))

        if not feature_name:
            feature_name = properties.get('name') or properties.get('id')

        if not feature_name:
            geometry_type = feature.get('geometry', {}).get('type', 'Feature')
            feature_name = f"{geometry_type} {index}"
        return feature_name

    def action_import_geojson(self):
        """Import the GeoJSON features as individual records"""
        self.ensure_one()
        
        if not self.geojson_file:
            raise UserError(_('Please select a GeoJSON file to upload'))

        try:
            # Decode and parse the file
            file_content = base64.b64decode(self.geojson_file).decode('utf-8')
            geojson_data = json.loads(file_content)
            
            # Validate again
            self._validate_geojson(geojson_data)

            self._import_features(geojson_data['features'])            
            return {
                'type': 'ir.actions.client',
                'tag': 'reload',
            }
            
        except Exception as e:
            _logger.error('Error importing GeoJSON: %s', e)
            raise UserError(_('Error importing GeoJSON: %s') % str(e))

    def _import_features(self, features):
        """Import individual features as records"""
        target_model_obj = self.env[self.target_model]
        imported_records = []
        
        for i, feature in enumerate(features):
            try:
                # Extract feature data
                feature_data = self._extract_feature_data(feature, i + 1)

                # Check if record exists (if overwrite is enabled)
                existing_record = None
                if self.overwrite_existing and feature_data.get('gshape_name'):
                    existing_record = target_model_obj.search([
                        ('gshape_name', '=', feature_data['gshape_name'])
                    ], limit=1)

                if existing_record:
                    # Update existing record
                    existing_record.write(feature_data)
                    imported_records.append(existing_record)
                    _logger.info('Updated existing record: %s', feature_data['gshape_name'])
                else:
                    # Create new record
                    new_record = target_model_obj.create(feature_data)
                    imported_records.append(new_record)
                    _logger.info('Created new record: %s', feature_data['gshape_name'])
                    
            except Exception as e:
                _logger.error('Error importing feature %d: %s', i + 1, e)
                # Continue with other features instead of failing completely
                continue
        
        return imported_records

    def _extract_feature_data(self, feature, index):
        """Extract data from a GeoJSON feature to create/update a record"""
        properties = feature.get('properties', {})

        # Extract basic information
        feature_name = self._extract_feature_name(feature, index)

        # Calculate area and other measurements
        area = self._calculate_feature_area(feature)
        
        # Prepare feature data
        feature_data = {
            'partner_id': self.env.user.partner_id.id,
            'gshape_name': feature_name,
            'gshape_area': area,
            'gshape_description': self.default_description or properties.get('description', ''),
            'gshape_geojson': {
                'type': 'FeatureCollection',
                'features': [feature]
            },
        }

        return feature_data

    def _calculate_feature_area(self, feature):
        """Calculate area for polygon features"""
        geometry = feature.get('geometry', {})
        geometry_type = geometry.get('type', '')
        
        if geometry_type in ['Polygon', 'MultiPolygon']:
            # For now, extract from properties if available
            properties = feature.get('properties', {})
            return properties.get('area', 0.0)
        
        return 0.0


    def action_cancel(self):
        """Cancel the import wizard"""
        return {'type': 'ir.actions.act_window_close'}
