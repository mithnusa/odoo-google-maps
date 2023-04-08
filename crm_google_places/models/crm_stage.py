# -*- coding: utf-8 -*-
from odoo import fields, models


class CrmStage(models.Model):
    _inherit = 'crm.stage'

    marker_color = fields.Char(default='orange')
