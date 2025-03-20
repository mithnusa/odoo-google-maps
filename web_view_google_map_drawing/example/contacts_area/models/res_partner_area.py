# -*- encoding: utf-8 -*-
from odoo import fields, models


class ResPartnerArea(models.Model):
    """Inherit Drawing mixins model 'google.drawing.shape'"""

    _name = 'res.partner.area'
    _inherit = 'google.drawing.shape'
    _description = 'Partner Area'

    partner_id = fields.Many2one(
        'res.partner', required=True, ondelete='cascade'
    )


class ResPartner(models.Model):
    _inherit = 'res.partner'

    shape_line_ids = fields.One2many(
        'res.partner.area', 'partner_id', string='Area'
    )
