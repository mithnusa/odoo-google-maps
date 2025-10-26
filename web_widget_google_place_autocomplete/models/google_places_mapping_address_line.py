from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class GooglePlacesMappingAddressLine(models.Model):
    _name = 'google.places.mapping.address.line'
    _description = 'Google Places Mapping to Odoo Address Fields'

    @api.constrains('gplace_component')
    def _check_gplace_component(self):
        """Validate Google Places component configuration using shared validation logic."""
        for line in self:
            if line.gplace_component:
                self._validate_component_list(line.gplace_component, 'Google Address Component')

    @api.constrains('field_id', 'text_option')
    def _check_field_text_option_compatibility(self):
        """Validate that text_option is only used with text fields."""
        for line in self:
            if line.field_id and line.text_option:
                # text_option is only relevant for char/text fields, not relational fields
                if line.field_id.ttype not in ('char', 'text'):
                    # For relational fields, we could auto-set to None or provide a warning
                    # but for now, we'll allow it as it might be ignored in processing
                    pass

    @api.constrains('gplace_component', 'handling_mode')
    def _check_component_handling_mode_compatibility(self):
        """Validate that handling_mode is compatible with the component list."""
        for line in self:
            if line.gplace_component:
                try:
                    component_list = self.env['google.places.mapping']._safe_literal_eval(
                        line.gplace_component, 'Google Address Component', list
                    )
                except ValidationError:
                    # If component list is invalid, skip further checks as they are handled elsewhere
                    continue

                if line.handling_mode == 'direct' and len(component_list) > 1:
                    raise ValidationError(_(
                        "Direct handling mode can only be used with a single component. "
                        "Please adjust the Google Address Component for field '%s'."
                    ) % line.field_id.name)

                if line.handling_mode in ('fallback', 'concat') and len(component_list) < 2:
                    raise ValidationError(_(
                        "%s handling mode requires at least two components. "
                        "Please adjust the Google Address Component for field '%s'."
                    ) % (line.handling_mode.capitalize(), line.field_id.name))

    def _validate_component_list(self, component_text, field_name):
        """Validate component list format and content.

        Args:
            component_text (str): JSON string containing component list
            field_name (str): Human-readable field name for error messages

        Raises:
            ValidationError: If component list is invalid
        """
        try:
            # Use the shared validation logic from parent model
            mapping_model = self.env['google.places.mapping']
            component_list = mapping_model._safe_literal_eval(component_text, field_name, list)

            if not component_list:
                raise ValidationError(_('%s list cannot be empty.') % field_name)

            for item in component_list:
                if not isinstance(item, str):
                    raise ValidationError(_('%s must contain only strings.') % field_name)
                if not item:
                    raise ValidationError(_('%s cannot contain empty strings.') % field_name)

        except ValidationError:
            # Re-raise validation errors as-is
            raise

    mapping_id = fields.Many2one(
        comodel_name='google.places.mapping',
        string='Mapping',
        required=True,
        ondelete='cascade',
    )
    model_id = fields.Many2one(related='mapping_id.model_id', string='Model', store=True, readonly=True)
    field_id = fields.Many2one(
        'ir.model.fields',
        string='Field',
        domain="""[
            ('model_id', '=', model_id),
            ('ttype', 'in', ('char', 'text', 'many2one', 'many2many')),
            ('store', '=', True),
            ('readonly', '=', False),
            ('related', '=', False)
        ]""",
        required=True,
        ondelete='cascade',
    )
    gplace_component = fields.Text(string='Google Address Component', required=True)
    text_option = fields.Selection(
        selection=[('shortText', 'Short Text'), ('longText', 'Long Text')],
        string='Text Option',
        default='shortText',
        help='Choose whether to use the short or long text from the Google Places API for this component.',
        required=True,
    )
    handling_mode = fields.Selection(
        selection=[
            ('direct', 'Direct'),
            ('fallback', 'Fallback'),
            ('concat', 'Concatenate'),
        ],
        string='Handling Mode',
        default='direct',
        help="How to handle multiple components when mapping:\n"
            "• Direct: Use only the first component (requires exactly 1 component)\n"
            "• Fallback: Use first available component from the list (requires 2+ components)\n"
            "• Concatenate: Join all available components with separator (requires 2+ components)\n"
            "Examples:\n"
            "- Direct: ['locality'] → Use locality value\n"
            "- Fallback: ['locality', 'administrative_area_level_2'] → Use locality if available, otherwise use administrative_area_level_2\n"
            "- Concatenate: ['street_number', 'route'] → '123 Main St'",
        required=True,
    )
    separator = fields.Selection(
        [
            ('space', 'Space'),
            ('comma', 'Comma'),
            ('hyphen', 'Hyphen'),
            ('underscore', 'Underscore'),
            ('forward_slash', 'Forward Slash'),
            ('back_slash', 'Back Slash'),
            ('new_line', 'New Line'),
        ],
        string='Separator',
        default='space',
        help='Separator to use when concatenating multiple components. Only used with Concatenate handling mode.',
    )

    _mapping_fields_unique = models.Constraint('UNIQUE(mapping_id, field_id)', 'Field must be unique per mapping')
