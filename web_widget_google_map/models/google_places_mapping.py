import ast
import secrets
import logging

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError, UserError

_logger = logging.getLogger(__name__)


class GooglePlacesMapping(models.Model):
    """Google Places API to Odoo Field Mapping Configuration.

    This model provides configurable mappings between Google Places API responses
    and Odoo model fields, enabling automatic population of Odoo records from
    Google Places autocomplete selections.

    Key Features:
    - Two operation modes: 'places' (full place data) and 'address' (address only)
    - Configurable field mappings for address components and other place data
    - Support for both simple fields (char/text) and relational fields (many2one/many2many)
    - Country-specific street address formatting
    - Optimized parsing performance with O(n) complexity

    Usage:
    - Configure mappings through Odoo interface
    - Use parse_place() method to convert Google Places API responses
    - Use get_widget_mapping() for frontend widget configuration
    """
    _name = 'google.places.mapping'
    _description = 'Google Places Mapping'
    _rec_name = 'code'
    _order = 'sequence desc, id desc'

    @api.constrains('mode', 'gplace_options', 'gplace_place_fetch_fields', 'gplace_address_fetch_fields')
    def _check_mappings(self):
        """Validate Google Places mapping configuration.

        Validates:
        - Place Autocomplete Element Options format and content
        - Fetch Fields configuration based on mode (places/address)
        - Ensures all configurations are valid JSON and meet requirements

        Raises:
            ValidationError: If any configuration is invalid
        """
        for record in self:
            if record.gplace_options:
                gplace_options = record._safe_literal_eval(
                    record.gplace_options,
                    'Place Autocomplete Element Options',
                    dict
                )

                for key, value in gplace_options.items():
                    if not isinstance(key, str):
                        raise ValidationError(_('Place Autocomplete Element Options keys must be string'))
                    if not key or not value:
                        raise ValidationError(_('Place Autocomplete Element Options keys and values cannot be empty'))

            if record.mode == 'places':
                record._validate_fetch_fields(record.gplace_place_fetch_fields, 'Place Fetch Fields')
            elif record.mode == 'address':
                record._validate_fetch_fields(record.gplace_address_fetch_fields, 'Address Fetch Fields')

    @api.constrains('mapping_address_ids', 'mapping_other_ids')
    def _check_field_mappings(self):
        """Ensure no duplicate field mappings between address and other mappings.

        Validates that each Odoo field is mapped only once across both
        address field mappings and other field mappings to prevent conflicts.

        Raises:
            ValidationError: If duplicate field mappings are found
        """
        for record in self:
            mapping_address_fields = record.mapping_address_ids.mapped('field_id').ids
            mapping_other_fields = record.mapping_other_ids.mapped('field_id').ids
            # check make sure no duplicate field in address and other mappings
            common_fields = set(mapping_address_fields) & set(mapping_other_fields)
            if common_fields:
                raise ValidationError(_('Duplicate field mapping found in Address and Other mappings. Please ensure each field is mapped only once.'))
    
    def get_list_models(self):
        """Get list of models for model selection field.

        Returns:
            list: List of tuples with model technical names and descriptions
        """
        models = self.env['ir.model'].sudo().search([
            ('transient', '=', False),
            ('abstract', '=', False),
            ('model', 'not in', ['ir.actions.report', 'ir.actions.report.xml', 'ir.actions.report.template']),
        ])
        return [(model.model, model.name) for model in models]
    
    def get_list_model_fields(self):
        """Get list of fields for field selection based on selected model.

        Returns:
            list: List of tuples with field IDs and names for the selected model
        """
        self.ensure_one()
        if not self.model_id:
            return []
        fields = self.env['ir.model.fields'].sudo().search([
            ('model_id', '=', self.model_id.id),
            ('store', '=', True),
            ('readonly', '=', False),
            ('related', '=', False),
        ])
        return [(f'{field.id}_{field.name}', field.name) for field in fields]

    place_id_test = fields.Char(string='Place ID Test') # field to facilitate testing in the UI
    code = fields.Char(
        string='Code',
        required=True,
        default=lambda: secrets.token_urlsafe(6),
        index=True,
    )
    mode = fields.Selection(
        selection=[
            ('places', 'Place'),
            ('address', 'Address'),
        ],
        string='Mode',
        required=True,
        default='places',
    )
    description = fields.Text(string='Description')

    gplace_options = fields.Text(
        string='Place Autocomplete Element Options ',
        help='PlaceAutocompleteElement options',
    )
    gplace_place_fetch_fields = fields.Text(
        string='Fetch Fields',
        help='PlaceAutocompleteElement options "fields" parameter.',
    )
    gplace_address_fetch_fields = fields.Text(
        string='Fetch Fields',
        help='PlaceAutocompleteElement options "fields" parameter.',
        default=lambda: "['addressComponents', 'location']",
    )
    model_id = fields.Many2one(
        'ir.model',
        string='Model',
        required=True,
        domain=['|', ('transient', '=', False), ('abstract', '=', False)],
        ondelete='cascade',
    )
    active = fields.Boolean(default=True)
    sequence = fields.Integer(default=10)
    latitude = fields.Many2one(
        'ir.model.fields',
        string='Latitude Field',
        domain="[('model_id', '=', model_id), ('ttype', '=', 'float'), ('store', '=', True), ('readonly', '=', False), ('related', '=', False)]",
        help='Field to store latitude value',
        ondelete='cascade',
    )
    longitude = fields.Many2one(
        'ir.model.fields',
        string='Longitude Field',
        domain="[('model_id', '=', model_id), ('ttype', '=', 'float'), ('store', '=', True), ('readonly', '=', False), ('related', '=', False)]",
        help='Field to store longitude value',
        ondelete='cascade',
    )
    mapping_address_ids = fields.One2many(
        'google.places.mapping.address.line',
        'mapping_id',
        string='Address Field Mappings',
    )
    mapping_other_ids = fields.One2many(
        'google.places.mapping.other.line',
        'mapping_id',
        string='Other Field Mappings',
    )
    is_address_component_missing = fields.Boolean(
        string='Is Address Component Missing',
        compute='_compute_fields_component_missing',
    )
    is_location_field_missing = fields.Boolean(
        string='Is Location Field Missing',
        compute='_compute_fields_component_missing',
    )

    _code_unique = models.Constraint('UNIQUE(code)', 'Code must be unique!')

    # Constants for Google Places API component processing
    TEXT_SHORT = 'shortText'  # Short text format for address components (e.g., "CA" for California)
    TEXT_LONG = 'longText'    # Long text format for address components (e.g., "California")
    STREET_COMPONENTS = ['route', 'street_number']  # Components that constitute a street address

    # Relation constants for field processing
    COUNTRY_RELATION = 'res.country'
    STATE_RELATION = 'res.country.state'

    # Field type constants
    RELATIONAL_FIELD_TYPES = ('many2one', 'many2many')
    TEXT_FIELD_TYPES = ('char', 'text')

    @api.model
    def _safe_literal_eval(self, text, field_name, expected_type=None):
        """Safely parse AST literal with consistent error handling.

        Args:
            text (str): JSON string to parse
            field_name (str): Human-readable field name for error messages
            expected_type (type, optional): Expected type for validation

        Returns:
            object: Parsed object from AST literal evaluation

        Raises:
            ValidationError: If parsing fails or type validation fails
        """
        if not text:
            return expected_type() if expected_type else None

        try:
            result = ast.literal_eval(text)
            if expected_type and not isinstance(result, expected_type):
                raise ValidationError(_('%s must be a %s.') % (field_name, expected_type.__name__))
            return result
        except (ValueError, SyntaxError, TypeError) as e:
            raise ValidationError(_('%s must be a valid JSON string.\n%s') % (field_name, e))

    @api.model
    def _validate_fetch_fields(self, fetch_fields_text, field_name):
        """Validate Google Places API fetch fields configuration.

        Ensures fetch fields are properly formatted as a list of non-empty strings.
        Used for both place fetch fields and address fetch fields validation.

        Args:
            fetch_fields_text (str): JSON string containing list of fetch fields
            field_name (str): Human-readable field name for error messages

        Raises:
            ValidationError: If fetch fields are invalid or improperly formatted
        """
        if not fetch_fields_text:
            return

        fetch_fields = self._safe_literal_eval(fetch_fields_text, field_name, list)

        if not fetch_fields:
            raise ValidationError(_('%s list cannot be empty.') % field_name)

        for field in fetch_fields:
            if not isinstance(field, str):
                raise ValidationError(_('%s must be a list of strings.') % field_name)
            if not field:
                raise ValidationError(_('%s cannot contain empty strings.') % field_name)

    @api.depends('mode', 'gplace_place_fetch_fields', 'gplace_address_fetch_fields')
    def _compute_fields_component_missing(self):
        """Compute missing component indicators for UI display.

        Determines if required components (addressComponents, location) are missing
        from the fetch fields configuration, used to show warnings in the UI.

        Sets:
            is_address_component_missing: True if 'addressComponents' not in fetch fields
            is_location_field_missing: True if 'location' not in fetch fields
        """
        for record in self:
            try:
                if record.mode == 'address':
                    fetch_fields_text = record.gplace_address_fetch_fields
                else:
                    fetch_fields_text = record.gplace_place_fetch_fields

                fetch_fields = record._safe_literal_eval(fetch_fields_text, 'Fetch Fields', list) or []

                record.is_address_component_missing = 'addressComponents' not in fetch_fields
                record.is_location_field_missing = 'location' not in fetch_fields
            except ValidationError:
                record.is_address_component_missing = True
                record.is_location_field_missing = True

    def copy(self, default=None):
        """Override copy to generate unique code for duplicated records.

        Args:
            default (dict, optional): Default values for the copy

        Returns:
            GooglePlacesMapping: New record with unique code
        """
        default = dict(default or {})
        default['code'] = secrets.token_urlsafe(6)
        return super().copy(default=default)

    @api.model
    def get_widget_mapping_by_mode(self, mode):
        widget_res_model = self.env.context.get('widget_res_model')
        if not mode or not widget_res_model:
            return {}

        mapping_id = self.sudo().search([
            ('mode', '=', mode),
            ('model_id.model', '=', widget_res_model),
        ])

        if not mapping_id:
            return {}

        values = mapping_id[0]._prepare_mapping_values()
        return values

    @api.model
    def get_widget_mapping_by_code(self, code):
        """Retrieve widget configuration for frontend autocomplete widgets.

        Gets the Google Places autocomplete configuration including options
        and fetch fields for a specific mapping code.

        Args:
            code (str): Unique mapping code to retrieve configuration for

        Returns:
            dict: Widget configuration with 
                 - 'mapping_id'
                 - 'mapping_code'
                 - 'mapping_mode'
                 - 'gplace_options'
                 - 'gplace_fetch_fields'
                 Returns empty dict if mapping not found or configuration invalid
        """
        is_mapping_test = self.env.context.get('is_mapping_test', False)
        widget_res_model = self.env.context.get('widget_res_model')

        if not is_mapping_test:
            self = self.sudo()

        mapping_id = self.search([('code', '=', code)])

        if not mapping_id or (not is_mapping_test and not widget_res_model):
            return {}

        if not is_mapping_test and mapping_id.model_id.model != widget_res_model:
            return {}

        values = mapping_id._prepare_mapping_values()
        return values
    
    def _prepare_mapping_values(self):
        self.ensure_one()
        try:
            if self.mode == 'places':
                fetch_fields_text = self.gplace_place_fetch_fields
            else:
                fetch_fields_text = self.gplace_address_fetch_fields

            gplace_options = self._safe_literal_eval(self.gplace_options, 'Options', dict) or {}
            gplace_fetch_fields = self._safe_literal_eval(fetch_fields_text, 'Property Fields', list) or []

            return {
                'mapping_id': self.id,
                'mapping_code': self.code,
                'mapping_mode': self.mode,
                'gplace_options': gplace_options,
                'gplace_fetch_fields': gplace_fetch_fields,
            }
        except ValidationError:
            return {}

    @api.model
    def parse_place(self, place, code):
        """Parse Google Places API response into Odoo field values.

        Main entry point for converting Google Places API data into structured
        Odoo field mappings. Orchestrates parsing of address, geolocation, and
        other place data based on the mapping configuration.

        Args:
            place (dict): Google Places API response data
            code (str): Mapping code to determine parsing configuration

        Returns:
            dict: Parsed data with keys:
                - mode: Mapping mode ('places' or 'address')
                - address: Parsed address field mappings
                - geolocation: Parsed latitude/longitude values
                - other: Parsed other field mappings (places mode only)
        """
        is_mapping_test = self.env.context.get('is_mapping_test', False)
        if not is_mapping_test:
            self = self.sudo()

        mapping_id = self.search([('code', '=', code)])
        if not mapping_id:
            return {}

        address_components = place.get('addressComponents')
        address = self.parse_address(mapping_id, address_components)

        location = place.get('location') or {}
        geolocation = self.parse_geolocation(mapping_id, location)
        other = self.parse_others(mapping_id, place) if mapping_id.mode == 'places' else {}

        result = {
            'mode': mapping_id.mode,
            'address': address,
            'geolocation': geolocation,
            'other': other,
        }
        return result

    @api.model
    def parse_others(self, mapping_id, place):
        """Parse non-address place data fields.

        Processes Google Places API response fields that are not address
        components, such as place name, types, ratings, etc.

        Args:
            mapping_id (GooglePlacesMapping): Mapping configuration record
            place (dict): Google Places API response data

        Returns:
            dict: Parsed field values mapped to Odoo field names
        """
        if not mapping_id or not place:
            return {}

        other_mapping = self._build_other_mapping(mapping_id)
        if not other_mapping:
            return {}

        result = {}
        for field_name, field_config in other_mapping.items():
            if not field_config.get('component'):
                continue

            field_value = self._process_other_field(field_config, place)
            if field_value is not None:
                result[field_name] = field_value

        return result

    @api.model
    def _build_field_mapping(self, mapping_lines, include_text_option=False):
        """Build field configuration mapping for address or other fields.

        Creates a lookup dictionary for mapping Google Places components
        to Odoo model fields with their type and configuration information.

        Args:
            mapping_lines (recordset): Mapping line records (address or other)
            include_text_option (bool): Whether to include text_option for address fields

        Returns:
            dict: Field mapping configuration with field names as keys
        """
        field_mapping = {}
        for line in mapping_lines:
            try:
                component = self._safe_literal_eval(line.gplace_component, f'Component for {line.field_id.name}')
                config = {
                    'type': line.field_id.ttype,
                    'relation': line.field_id.relation or False,
                    'component': component,
                }

                # Add text_option for address fields only
                if include_text_option and hasattr(line, 'text_option'):
                    config['text_option'] = line.text_option or self.TEXT_SHORT

                field_mapping[line.field_id.name] = config

            except ValidationError as e:
                _logger.warning('Invalid component configuration for field %s: %s', line.field_id.name, e)
                continue
        return field_mapping

    @api.model
    def _build_other_mapping(self, mapping_id):
        """Build field configuration mapping for other (non-address) fields."""
        return self._build_field_mapping(mapping_id.mapping_other_ids, include_text_option=False)

    @api.model
    def _process_other_field(self, field_config, place):
        """Process a single other field mapping.

        Extracts and processes a single field value from Google Places data
        based on field configuration, handling both simple and relational fields.

        Args:
            field_config (dict): Field mapping configuration
            place (dict): Google Places API response data

        Returns:
            mixed: Processed field value (string, dict for many2one, list for many2many)
        """
        component_key = field_config.get('component')
        component_value = place.get(component_key)

        if field_config.get('type') in ('many2one', 'many2many') and field_config.get('relation'):
            return self._process_other_relational_field(field_config, component_value)
        else:
            return component_value

    @api.model
    def _process_other_relational_field(self, field_config, component_value):
        """Process relational field (many2one/many2many) for other fields."""
        if not component_value:
            return [(6, 0, [])] if field_config.get('type') == 'many2many' else False

        search_values = [component_value]
        related_record = self._search_related_record(field_config.get('relation'), search_values)

        return self._format_relational_field_value(field_config.get('type'), related_record)

    @api.model
    def _format_relational_field_value(self, field_type, related_record):
        """Format relational field value based on field type.

        Args:
            field_type (str): Field type ('many2one' or 'many2many')
            related_record (recordset): Found records

        Returns:
            mixed: Formatted field value for Odoo
        """
        if not related_record:
            return [(6, 0, [])] if field_type == 'many2many' else False

        if field_type == 'many2one':
            return {
                'id': related_record[0].id,
                'display_name': related_record[0].display_name,
            }
        else:  # many2many
            return [(6, 0, related_record.ids)]

    @api.model
    def parse_geolocation(self, mapping_id, location):
        """Parse location coordinates from Google Places response.

        Extracts latitude and longitude values and maps them to configured
        Odoo model fields.

        Args:
            mapping_id (GooglePlacesMapping): Mapping configuration record
            location (dict): Location data from Google Places API response

        Returns:
            dict: Mapped coordinate values with field names as keys
        """
        result = {}
        if location and mapping_id:
            lat_field = mapping_id.latitude and mapping_id.latitude.name or None
            lng_field = mapping_id.longitude and mapping_id.longitude.name or None
            if lat_field and lng_field:
                result[lat_field] = (location or {}).get('lat')
                result[lng_field] = (location or {}).get('lng')
        return result

    @api.model
    def parse_address(self, mapping_id, address_components):
        """Parse Google Places address components into Odoo address fields.

        Main address parsing method that processes Google Places address components
        and maps them to configured Odoo model fields. Handles both text fields
        and relational fields (country, state, etc.).

        Args:
            mapping_id (GooglePlacesMapping): Mapping configuration record
            address_components (list): Address components from Google Places API

        Returns:
            dict: Parsed address field values mapped to Odoo field names
        """
        if not mapping_id or not address_components or (address_components and not isinstance(address_components, list)):
            return {}

        address_mapping = self._build_address_mapping(mapping_id)
        if not address_mapping:
            return {}

        component_lookup = self._build_component_lookup(address_components)
        result_address = {}
        country_id = None

        # Process fields in order: country -> state -> other relational -> text
        field_groups = [
            ('country', {k: v for k, v in address_mapping.items()
                        if v.get('relation') == self.COUNTRY_RELATION and v['type'] in self.RELATIONAL_FIELD_TYPES}),
            ('state', {k: v for k, v in address_mapping.items()
                      if v.get('relation') == self.STATE_RELATION and v['type'] in self.RELATIONAL_FIELD_TYPES}),
            ('other_relational', {k: v for k, v in address_mapping.items()
                                 if (v.get('relation') not in (self.COUNTRY_RELATION, self.STATE_RELATION) and
                                     v['type'] in self.RELATIONAL_FIELD_TYPES and v['relation'])}),
            ('text', {k: v for k, v in address_mapping.items() if v['type'] in self.TEXT_FIELD_TYPES})
        ]

        for group_type, fields in field_groups:
            for field_name, field_config in fields.items():
                if not field_config['component']:
                    continue

                field_value = self._process_field_by_group(
                    group_type, field_config, component_lookup, country_id
                )

                if field_value:
                    # Handle special processing for different field types
                    if group_type == 'text' and self._is_street_field(field_config['component']) and country_id:
                        result_address[field_name] = self._format_street_address(field_value, country_id)
                    elif group_type == 'text':
                        result_address[field_name] = ', '.join(str(v) for v in field_value.values() if v)
                    else:
                        result_address[field_name] = field_value

                # Update country context if found
                if group_type == 'country' and field_value:
                    country_id = self._extract_country_from_field_value(field_config, component_lookup)

        return result_address

    @api.model
    def _process_field_by_group(self, group_type, field_config, component_lookup, country_id=None):
        """Process field based on its group type.

        Args:
            group_type (str): Type of field group ('country', 'state', 'other_relational', 'text')
            field_config (dict): Field configuration
            component_lookup (dict): Component lookup table
            country_id (res.country, optional): Country context for state validation

        Returns:
            mixed: Processed field value
        """
        if group_type == 'text':
            return self._process_text_field(field_config, component_lookup)
        elif group_type == 'state':
            field_value, _ = self._process_relational_field(field_config, component_lookup, country_id)
            return field_value
        else:  # country or other_relational
            field_value, _ = self._process_relational_field(field_config, component_lookup)
            return field_value

    @api.model
    def _extract_country_from_field_value(self, field_config, component_lookup):
        """Extract country record from field processing.

        Args:
            field_config (dict): Field configuration
            component_lookup (dict): Component lookup table

        Returns:
            res.country: Country record or None
        """
        for component_type in field_config['component']:
            component = component_lookup.get(component_type)
            if not component:
                continue

            search_values = [component.get(self.TEXT_LONG), component.get(self.TEXT_SHORT)]
            related_record = self._search_related_record(self.COUNTRY_RELATION, search_values)

            if related_record:
                return related_record[0]

        return None

    @api.model
    def _build_address_mapping(self, mapping_id):
        """Build field configuration mapping for address fields."""
        return self._build_field_mapping(mapping_id.mapping_address_ids, include_text_option=True)

    @api.model
    def _build_component_lookup(self, address_components):
        """Build optimized lookup table for address components.

        Creates O(1) lookup table from address components list for efficient
        component access by type, improving performance from O(n²) to O(n).

        Args:
            address_components (list): Address components from Google Places API

        Returns:
            dict: Component lookup table with component types as keys
        """
        component_lookup = {}
        for component in address_components:
            for type_ in component.get('types', []):
                component_lookup[type_] = component
        return component_lookup

    @api.model
    def _search_related_record(self, relation, search_values):
        """Search for related records in specified model.

        Shared helper method for searching related records by name or code
        in any Odoo model. Used by both address and other field processing.

        Args:
            relation (str): Target model name (e.g., 'res.country', 'res.country.state')
            search_values (list): List of values to search for (name or code)

        Returns:
            recordset: Found records or None if not found or error occurred
        """
        try:
            related_model = self.env[relation].sudo()
            domain = []
            for search_value in search_values:
                if search_value:
                    domain.append(('name', '=', search_value))
                    domain.append(('code', '=', search_value))

            if domain:
                domain = ['|'] * (len(domain) - 1) + domain
                return related_model.search(domain)

        except (AttributeError, KeyError) as e:
            _logger.warning('Error searching related record for %s: %s', relation, e)

        return None

    @api.model
    def _search_state_with_country(self, search_values, country_context):
        """Search for state records within a specific country context.

        Searches for state records that belong to the specified country,
        ensuring geographic accuracy and preventing cross-country state matches.

        Args:
            search_values (list): List of values to search for (name or code)
            country_context (res.country): Country record to constrain search

        Returns:
            recordset: Found state records within the country or None if not found
        """
        try:
            state_model = self.env['res.country.state'].sudo()
            search_domain = []

            for search_value in search_values:
                if search_value:
                    search_domain.append(('name', '=', search_value))
                    search_domain.append(('code', '=', search_value))

            if search_domain:
                # Build OR conditions for name/code searches within country
                search_domain = ['|'] * (len(search_domain) - 1) + search_domain
                final_domain = [('country_id', '=', country_context.id)] + search_domain
                return state_model.search(final_domain)

        except (AttributeError, KeyError) as e:
            _logger.warning('Error searching state with country context for %s: %s', country_context.name, e)

        return None

    @api.model
    def _process_relational_field(self, field_config, component_lookup, country_context=None):
        """Process relational fields (many2one/many2many) for address components.

        Searches for related records based on address component values and returns
        appropriate Odoo relational field format. Also tracks country records for
        street formatting. For state fields, validates that the state belongs to
        the provided country context.

        Args:
            field_config (dict): Field mapping configuration
            component_lookup (dict): Optimized component lookup table
            country_context (res.country, optional): Country record for state validation

        Returns:
            tuple: (field_value, country_record) where field_value is the processed
                   value and country_record is the country for street formatting
        """
        field_value = None
        country_record = None

        for component_type in field_config['component']:
            component = component_lookup.get(component_type)
            if not component:
                continue

            search_values = [component.get(self.TEXT_LONG), component.get(self.TEXT_SHORT)]

            # For state fields, use country-specific search when country context is available
            if field_config['relation'] == self.STATE_RELATION and country_context:
                related_record = self._search_state_with_country(search_values, country_context)
            else:
                related_record = self._search_related_record(field_config['relation'], search_values)

            if related_record:
                field_value = self._format_relational_field_value(field_config['type'], related_record)
                if field_config['relation'] == self.COUNTRY_RELATION:
                    country_record = related_record[0]
                break

        return field_value, country_record

    @api.model
    def _process_text_field(self, field_config, component_lookup):
        """Process text fields (char/text) for address components.

        Extracts text values from address components based on configured
        text option (shortText or longText) and builds field parts dictionary.

        Args:
            field_config (dict): Field mapping configuration
            component_lookup (dict): Optimized component lookup table

        Returns:
            dict: Field parts with component types as keys and text values
        """
        field_parts = {}

        for component_type in field_config['component']:
            component = component_lookup.get(component_type)
            if component:
                text_value = component.get(field_config['text_option']) or ''
                if text_value:
                    field_parts[component_type] = text_value

        if not field_parts:
            return ''

        return field_parts

    @api.model
    def _is_street_field(self, components):
        """Check if field components constitute a street address.

        Determines if the field mapping includes both route and street_number
        components, indicating it should use country-specific street formatting.

        Args:
            components (list): List of Google Places component types

        Returns:
            bool: True if field contains both street components
        """
        return len(set(components) & set(self.STREET_COMPONENTS)) == len(self.STREET_COMPONENTS)

    @api.model
    def _format_street_address(self, field_parts, country_id):
        """Format street address based on country-specific conventions.

        Applies country-specific street formatting rules. Some countries use
        'street_number route' format while others use 'route street_number'.

        Args:
            field_parts (dict): Field components with their values
            country_id (res.country): Country record for formatting rules

        Returns:
            str: Formatted street address string
        """
        if not all(comp in field_parts for comp in self.STREET_COMPONENTS):
            return ', '.join(str(v) for v in field_parts.values() if v)

        street_format = '%(street_number)s %(route)s' if country_id.google_street_format == 'street_number_route' else '%(route)s %(street_number)s'
        return street_format % field_parts

    def unlink(self):
        """Override unlink to prevent deletion of mappings in use.

        Prevents deletion of Google Places mapping records that are currently
        referenced by other records in the system.

        Raises:
            UserError: If any mapping is in use and cannot be deleted
        """
        for record in self:
            referenced_in_views = self.env['ir.ui.view'].search([('arch_db', 'like', record.code), ('model', '!=', self._name)])
            view_count = len(referenced_in_views)
            if view_count > 0:
                views_list = '\n - '.join(referenced_in_views.mapped('name'))
                raise UserError(_('Cannot delete mapping "%s" as it is currently in use by the following views:\n - %s.', record.code, views_list))
        return super().unlink()