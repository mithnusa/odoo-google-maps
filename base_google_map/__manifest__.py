# -*- coding: utf-8 -*-
{
    'name': 'Base Google Map',
    'summary': '''
        Base module for Google maps integration,
        containing a config to setup Google API Key
    ''',
    'description': '''
        This module assumed you already have a Google API Key configured,
        if not please check this link
        https://developers.google.com/maps/documentation/javascript/get-api-key
        Once you have it, go to Settings > General Settings find a section
        Google Maps View and then enter your Google API Key.
        Note, there is no functionality that you can find by just installed
        this module.
    ''',
    'author': 'Yopi Angi',
    'website': 'https://www.yourcompany.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '0.1',
    'depends': ['base_setup'],
    'data': [
        'views/res_config_settings.xml',
        'views/templates.xml',
    ],
    'demo': [],
}
