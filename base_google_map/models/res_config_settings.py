# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


GMAPS_LANG_LOCALIZATION = [
    ('af', 'Afrikaans'),
    ('sq', 'Albanian'),
    ('am', 'Amharic'),
    ('ar', 'Arabic'),
    ('hy', 'Armenian'),
    ('az', 'Azerbaijani'),
    ('eu', 'Basque'),
    ('be', 'Belarusian'),
    ('bn', 'Bengali'),
    ('bs', 'Bosnian'),
    ('bg', 'Bulgarian'),
    ('my', 'Burmese'),
    ('ca', 'Catalan'),
    ('zh', 'Chinese'),
    ('zh-HK', 'Chinese (Hong Kong)'),
    ('zh-CN', 'Chinese (Simplified)'),
    ('zh-TW', 'Chinese (Traditional)'),
    ('hr', 'Croatian'),
    ('cs', 'Czech'),
    ('da', 'Danish'),
    ('nl', 'Dutch'),
    ('en', 'English'),
    ('en-AU', 'English (Australian)'),
    ('en-GB', 'English (Great Britain)'),
    ('et', 'Estonian'),
    ('fa', 'Farsi'),
    ('fil', 'Filipino'),
    ('fi', 'Finnish'),
    ('fr', 'French'),
    ('fr-CA', 'French (Canada)'),
    ('gl', 'Galician'),
    ('ka', 'Georgian'),
    ('de', 'German'),
    ('el', 'Greek'),
    ('gu', 'Gujarati'),
    ('iw', 'Hebrew'),
    ('hi', 'Hindi'),
    ('hu', 'Hungarian'),
    ('is', 'Icelandic'),
    ('id', 'Indonesian'),
    ('it', 'Italian'),
    ('ja', 'Japanese'),
    ('kn', 'Kannada'),
    ('kk', 'Kazakh'),
    ('km', 'Khmer'),
    ('ko', 'Korean'),
    ('ky', 'Kyrgyz'),
    ('lo', 'Lao'),
    ('lv', 'Latvian'),
    ('lt', 'Lithuanian'),
    ('mk', 'Macedonian'),
    ('ms', 'Malay'),
    ('ml', 'Malayalam'),
    ('mr', 'Marathi'),
    ('mn', 'Mongolian'),
    ('ne', 'Nepali'),
    ('no', 'Norwegian'),
    ('pl', 'Polish'),
    ('pt', 'Portuguese'),
    ('pt-BR', 'Portuguese (Brazil)'),
    ('pt-PT', 'Portuguese (Portugal)'),
    ('pa', 'Punjabi'),
    ('ro', 'Romanian'),
    ('ru', 'Russian'),
    ('sr', 'Serbian'),
    ('si', 'Sinhalese'),
    ('sk', 'Slovak'),
    ('sl', 'Slovenian'),
    ('es', 'Spanish'),
    ('es-419', 'Spanish (Latin America)'),
    ('sw', 'Swahili'),
    ('sv', 'Swedish'),
    ('ta', 'Tamil'),
    ('te', 'Telugu'),
    ('th', 'Thai'),
    ('tr', 'Turkish'),
    ('uk', 'Ukrainian'),
    ('ur', 'Urdu'),
    ('uz', 'Uzbek'),
    ('vi', 'Vietnamese'),
    ('zu', 'Zulu'),
]


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    @api.model
    def get_region_selection(self):
        country_ids = self.env['res.country'].search([])
        values = [(country.code, country.name) for country in country_ids]
        return values

    google_maps_view_api_key = fields.Char(
        string='Google Maps View Api Key',
        config_parameter='base_google_map.api_key',
    )
    google_maps_lang_localization = fields.Selection(
        selection=GMAPS_LANG_LOCALIZATION,
        string='Google Maps Language Localization',
        config_parameter='base_google_map.lang_localization',
    )
    google_maps_region_localization = fields.Selection(
        selection=get_region_selection,
        string='Google Maps Region Localization',
        config_parameter='base_google_map.region_localization',
    )
    google_maps_theme = fields.Selection(
        selection=[
            ('default', 'Default'),
            ('aubergine', 'Aubergine'),
            ('night', 'Night'),
            ('dark', 'Dark'),
            ('retro', 'Retro'),
            ('silver', 'Silver'),
            ('atlas', 'Atlas'),
            ('muted_blue', 'Muted blue'),
            ('pale_down', 'Pale down'),
            ('subtle_gray', 'Subtle gray'),
            ('shift_worker', 'Shift worker'),
            ('even_lighter', 'Even lighter'),
            ('unsaturated_brown', 'Unsaturated brown'),
            ('uber', 'Uber'),
            ('wy', 'WY'),
            ('interface_map', 'Interface map'),
            ('blue_water', 'Blue water'),
            ('blue_essense', 'Blue essense'),
            ('line_drawing', 'Line drawing'),
        ],
        string='Theme',
        config_parameter='base_google_map.theme',
    )
    google_maps_libraries = fields.Char(
        string='Libraries', config_parameter='base_google_map.libraries'
    )
    google_autocomplete_lang_restrict = fields.Boolean(
        string='Google Autocomplete Language Restriction',
        config_parameter='base_google_map.autocomplete_lang_restrict',
    )
    google_enable_map_place_search = fields.Boolean(
        string='Enable Google Places search',
        config_parameter='base_google_map.enable_map_place_search',
    )
    google_maps_version = fields.Char(
        string='Version',
        config_parameter='base_google_map.version',
    )

    @api.onchange('google_maps_lang_localization')
    def onchange_lang_localization(self):
        if not self.google_maps_lang_localization:
            self.google_maps_region_localization = ''

    @api.onchange('google_enable_map_place_search')
    def onchange_google_enable_map_place_search(self):
        google_map_libraries = (self.google_maps_libraries or '').split(',')
        if (
            self.google_enable_map_place_search
            and 'places' not in google_map_libraries
        ):
            google_map_libraries += ['places']

        self.google_maps_libraries = ','.join(google_map_libraries)
