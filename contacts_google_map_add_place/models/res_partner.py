from odoo import _, models

class ResPartner(models.Model):
    _name = "res.partner"
    _inherit = ["res.partner", "google_map.add_place.mixin"]
