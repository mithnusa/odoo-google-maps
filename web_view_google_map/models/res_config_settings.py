from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    nearby_radius_search = fields.Integer(
        string='Nearby Search Radius (meters)',
        config_parameter='web_view_google_map.nearby_radius_search',
        default=1000,
    )
