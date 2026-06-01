from odoo import api, models


class CrmLead(models.Model):
    _inherit = 'crm.lead'

    @api.depends(
        'partner_id',
        'partner_id.partner_latitude',
        'partner_id.partner_longitude',
        'street',
        'street2',
        'city',
        'zip',
        'state_id',
        'country_id',
    )
    def _compute_customer_geo(self):
        # When the caller is Google Places autocomplete, coordinates have
        # already been written directly onto the lead from the Places API
        # response.  Calling super() here would reset them to 0.0 (the
        # "address diverges from partner" fallback), so we skip it.
        if self.env.context.get('is_from_google_maps'):
            return

        if hasattr(super(), '_compute_customer_geo'):
            super()._compute_customer_geo()
