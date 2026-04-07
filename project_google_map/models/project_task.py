from odoo import api, fields, models


class ProjectTask(models.Model):
    _inherit = "project.task"

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
    marker_color = fields.Integer(
        string="Marker Color",
    )
