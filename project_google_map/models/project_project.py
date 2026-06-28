from odoo import api, fields, models


class ProjectProject(models.Model):
    _inherit = "project.project"

    partner_site_id = fields.Many2one(
        "res.partner",
        string="Site Address",
    )
    site_latitude = fields.Float(
        related="partner_site_id.partner_latitude",
    )
    site_longitude = fields.Float(
        related="partner_site_id.partner_longitude",
    )
    marker_color = fields.Char(
        string="Marker Color", compute="_compute_marker_color"
    )

    @api.depends("last_update_status")
    def _compute_marker_color(self):
        colors = {
            "on_track": "#28a745",
            "at_risk": "#ffac00",
            "off_track": "#dc3545",
            "on_hold": "#17a2b8",
            "done": "#71639e",
        }
        unknown_status = "#d2d3d4"
        for record in self:
            record.marker_color = colors.get(
                record.last_update_status, unknown_status
            )
