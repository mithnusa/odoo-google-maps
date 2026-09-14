from odoo import api, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    @api.model
    def _get_view(self, view_id=None, view_type='form', **options):
        arch, view = super()._get_view(view_id, view_type, **options)

        if view_type == 'form':
            for node in arch.xpath("//field[@name='name']"):
                node.set(
                    'widget', 'field_partner_autocomplete_with_google_place'
                )

        return arch, view
