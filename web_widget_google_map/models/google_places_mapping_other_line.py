from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class GooglePlacesMappingOtherLine(models.Model):
    _name = 'google.places.mapping.other.line'
    _description = 'Google Places Mapping to Odoo Other Fields'

    @api.constrains('gplace_component')
    def _check_gplace_component(self):
        """Validate Google Places component configuration using shared validation logic."""
        for line in self:
            if line.gplace_component:
                self._validate_component_string(line.gplace_component, 'Google Place Component')

    def _validate_component_string(self, component_text, field_name):
        """Validate component string format and content.

        Args:
            component_text (str): JSON string containing component
            field_name (str): Human-readable field name for error messages

        Raises:
            ValidationError: If component is invalid
        """
        try:
            # Use the shared validation logic from parent model
            mapping_model = self.env['google.places.mapping']
            component = mapping_model._safe_literal_eval(component_text, field_name, str)

            if not component:
                raise ValidationError(_('%s cannot be empty.') % field_name)

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
            ('ttype', 'in', ('char', 'text', 'many2one', 'many2many', 'integer', 'float')),
            ('store', '=', True),
            ('readonly', '=', False),
            ('related', '=', False)
        ]""",
        required=True,
        ondelete='cascade',
    )
    gplace_component = fields.Text(string='Google Place Component', required=True)

    _mapping_fields_unique = models.Constraint('UNIQUE(mapping_id, field_id)', 'Field must be unique per mapping')
