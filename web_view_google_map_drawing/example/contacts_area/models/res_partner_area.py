# -*- encoding: utf-8 -*-
from odoo import fields, models
from odoo.tools.sql import create_index


class ResPartnerArea(models.Model):
    """Inherit Drawing mixins model 'google.drawing.shape'"""

    _name = 'res.partner.area'
    _inherit = 'google.drawing.shape'
    _description = 'Partner Area'
    _order = 'gshape_name asc, id desc'

    partner_id = fields.Many2one(
        'res.partner',
        required=False,
        ondelete='cascade',
        string='Contact',
    )

    def _auto_init(self):
        res = super()._auto_init()
        create_index(
            self.env.cr,
            'res_partner_area_gshape_geojson_gin',
            self._table,
            ['gshape_geojson'],
            method='gin',
        )
        return res


class ResPartner(models.Model):
    _inherit = 'res.partner'

    shape_line_ids = fields.One2many(
        'res.partner.area', 'partner_id', string='Area'
    )
