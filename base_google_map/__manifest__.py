# -*- coding: utf-8 -*-
{
    'name': 'Base Google Maps',
    'summary': '''
        Base module for Google Maps integration
    ''',
    'description': '''
        Base module for Google Maps integration,
        only contain a config to setup Google API Key
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.7',
    'depends': ['web', 'base_geolocalize'],
    'data': [
        'data/google_map.xml',
        'views/res_config_settings.xml',
        'views/templates.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'base_google_map/static/src/utils/*',
        ]
    },
    'demo': [],
    'application': False,
    'auto_install': False,
}
