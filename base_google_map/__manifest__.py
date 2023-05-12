# -*- coding: utf-8 -*-
{
    'name': 'Base Google Map',
    'summary': '''
        Base module for Google maps integration
    ''',
    'description': '''
        Base module for Google maps integration,
        only contain a config to setup Google API Key
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '16.0.1.2.1',
    'depends': ['base_setup'],
    'data': [
        'data/google_map.xml',
        'views/res_config_settings.xml',
        'views/templates.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'base_google_map/static/src/utils/*.js',
        ]
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
