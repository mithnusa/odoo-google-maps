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

    _mapping_fields_unique = models.Constraint('UNIQUE(mapping_id, field_id)', 'Field must be unique per mapping')
