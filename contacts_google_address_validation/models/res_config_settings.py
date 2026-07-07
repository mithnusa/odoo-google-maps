# -*- coding: utf-8 -*-
from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    google_address_validation_api_key = fields.Char(
        string='Address Validation Server Key',
        config_parameter='contacts_google_address_validation.api_key',
        help='Optional dedicated API key for server-side Address '
        'Validation requests. Recommended: the main Google Maps API key '
        'is usually HTTP-referrer restricted, and Google rejects '
        'referrer-restricted keys for server-side requests. Leave empty '
        'to use the main Google Maps API key.',
    )
