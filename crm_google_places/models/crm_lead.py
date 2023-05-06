# -*- coding: utf-8 -*-
from odoo import models


class CrmLead(models.Model):
    _name = 'crm.lead'
    _inherit = ['crm.lead', 'google.places.mixin']

    def _get_mapping_odoo_fields(self):
        res = super(CrmLead, self)._get_mapping_odoo_fields()
        res.update({'lat': 'customer_latitude', 'lng': 'customer_longitude'})
        return res
