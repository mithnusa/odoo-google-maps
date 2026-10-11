from odoo import api, fields, models
from odoo.addons.web_view_google_map_drawing.models.fields import (
    SearchableJson,
)


class ProjectProject(models.Model):
    _inherit = "project.project"

    geojson = SearchableJson(string="GeoJSON")
    geojson_color = fields.Char(
        string="Marker Color", compute="_compute_geojson_color"
    )
    geojson_area = fields.Float(string="Area")

    @api.depends("last_update_status")
    def _compute_geojson_color(self):
        colors = {
            "on_track": "#28a745",
            "at_risk": "#ffac00",
            "off_track": "#dc3545",
            "on_hold": "#17a2b8",
            "done": "#71639e",
        }
        unknown_status = "#d2d3d4"
        for record in self:
            record.geojson_color = colors.get(
                record.last_update_status, unknown_status
            )
