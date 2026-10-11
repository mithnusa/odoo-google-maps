from odoo import fields, models
from odoo.addons.web_view_google_map_drawing.models.fields import (
    SearchableJson,
)


class ProjectTask(models.Model):
    _inherit = "project.task"

    project_geojson = SearchableJson(
        related="project_id.geojson",
        string="Project GeoJSON",
        readonly=True,
    )
    project_geojson_area = fields.Float(
        related="project_id.geojson_area",
        string="Project Area",
        readonly=True,
    )
    geojson = SearchableJson(string="GeoJSON")
    geojson_area = fields.Float(string="Area")
    # Paired with widget color_picker
    geojson_color = fields.Integer(string="AreaColor", default=1)
