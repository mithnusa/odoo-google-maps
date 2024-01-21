# -*- encoding: utf-8 -*-
from odoo import fields, models


class ResPartnerArea(models.Model):
    """Inherit Drawing mixins model 'google.drawing.shape'"""

    _name = 'res.partner.area'
    _inherit = 'google.drawing.shape'
    _description = 'Partner Area'

    partner_id = fields.Many2one(
        comodel_name='res.partner', required=True, ondelete='cascade'
    )


class ResPartner(models.Model):
    _inherit = 'res.partner'

    shape_line_ids = fields.One2many(
        comodel_name='res.partner.area',
        inverse_name='partner_id',
        string='Area',
    )
