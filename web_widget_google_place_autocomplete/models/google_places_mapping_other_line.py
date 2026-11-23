from odoo import api, fields, models
from odoo.exceptions import ValidationError

from .utils import safe_literal_eval


class GooglePlacesMappingOtherLine(models.Model):
    _name = 'google.places.mapping.other.line'
    _description = 'Google Places Mapping to Odoo Other Fields'

    @api.constrains('gplace_component')
    def _check_gplace_component(self):
        """Validate Google Places component configuration using shared validation logic."""
        for line in self:
            if line.gplace_component:
                component = safe_literal_eval(
                    line.gplace_component, 'Google Place Component', str
                )
                if not component:
                    raise ValidationError(
                        self.env._(
                            '%s cannot be empty.', 'Google Place Component'
                        )
                    )

    mapping_id = fields.Many2one(
        comodel_name='google.places.mapping',
        string='Mapping',
        required=True,
        ondelete='cascade',
    )
    model_id = fields.Many2one(
        related='mapping_id.model_id',
        string='Model',
        store=True,
        readonly=True,
    )
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
    gplace_component = fields.Text(
        string='Google Place Component',
        required=True,
    )

    _mapping_fields_unique = models.Constraint(
        'UNIQUE(mapping_id, field_id)', 'Field must be unique per mapping'
    )
