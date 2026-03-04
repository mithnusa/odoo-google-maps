from odoo import fields, models


class ResPartner(models.Model):
    _inherit = "res.partner"

    type = fields.Selection(
        selection_add=[("site", "Site")],
        ondelete={"site": "set default"},
    )

    def _avatar_get_placeholder_path(self):
        if self.type == "site":
            return "project_google_map/static/img/Gemini_site.png"
        return super()._avatar_get_placeholder_path()
