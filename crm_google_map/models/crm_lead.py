# -*- coding: utf-8 -*-
from collections import defaultdict

from odoo import api, fields, models
from odoo.addons.base.models.res_partner import ADDRESS_FIELDS


class CrmLead(models.Model):
    _inherit = 'crm.lead'

    @api.model
    def _get_default_address_format(self):
        return "%(street)s\n%(street2)s\n%(city)s %(state_code)s %(zip)s\n%(country_name)s"

    def _display_address_depends(self):
        # field dependencies of method _display_address()
        return self._formatting_address_fields() + [
            'country_id',
            'state_id',
        ]

    @api.model
    def _get_address_format(self):
        return (
            self.country_id.address_format
            or self._get_default_address_format()
        )

    @api.depends('partner_id')
    def _compute_customer_geo(self):
        for lead in self:
            if lead.partner_id:
                lead.customer_latitude = lead.partner_id.partner_latitude
                lead.customer_longitude = lead.partner_id.partner_longitude
            else:
                lead.customer_latitude = 0.0
                lead.customer_longitude = 0.0

    @api.model
    def _address_fields(self):
        """Returns the list of address fields that are synced from the parent."""
        return list(ADDRESS_FIELDS)

    @api.model
    def _formatting_address_fields(self):
        """Returns the list of address fields usable to format addresses."""
        return self._address_fields()

    def update_address(self, vals):
        addr_vals = {
            key: vals[key] for key in self._address_fields() if key in vals
        }
        if addr_vals:
            return super(CrmLead, self).write(addr_vals)

    def _get_country_name(self):
        return self.country_id.name or ''

    def _prepare_display_address(self, without_company=False):
        # get the information that will be injected into the display format
        # get the address format
        address_format = self._get_address_format()
        args = defaultdict(
            str,
            {
                'state_code': self.state_id.code or '',
                'state_name': self.state_id.name or '',
                'country_code': self.country_id.code or '',
                'country_name': self._get_country_name(),
            },
        )
        for field in self._formatting_address_fields():
            args[field] = getattr(self, field) or ''
        if without_company:
            args['company_name'] = ''

        return address_format, args

    def _display_address(self, without_company=False):
        '''copied from res.partner'''
        address_format, args = self._prepare_display_address(without_company)
        return address_format % args

    @api.depends(lambda self: self._display_address_depends())
    def _compute_customer_address(self):
        for lead in self:
            lead.customer_address = lead._display_address()

    customer_latitude = fields.Float(
        string='Customer latitude',
        digits=(6, 5),
        compute='_compute_customer_geo',
        readonly=False,
        store=True,
    )
    customer_longitude = fields.Float(
        string='Customer longitude',
        digits=(6, 5),
        compute='_compute_customer_geo',
        readonly=False,
        store=True,
    )
    customer_address = fields.Char(
        compute='_compute_customer_address', string='Complete Address'
    )
    marker_color = fields.Integer(string='Marker color')

    @api.model
    def _geo_localize(self, street='', zip='', city='', state='', country=''):
        geo_obj = self.env['base.geocoder']
        search = geo_obj.geo_query_address(
            street=street,
            zip=zip,
            city=city,
            state=state,
            country=country,
        )
        result = geo_obj.geo_find(search, force_country=country)
        if result is None:
            search = geo_obj.geo_query_address(
                city=city, state=state, country=country
            )
            result = geo_obj.geo_find(search, force_country=country)
        return result

    def geo_localize(self):
        for lead in self.with_context(lang='en_US'):
            result = self._geo_localize(
                lead.street,
                lead.zip,
                lead.city,
                lead.state_id.name,
                lead.country_id.name,
            )

            if result:
                lead.write(
                    {
                        'customer_latitude': result[0],
                        'customer_longitude': result[1],
                    }
                )
        return True
