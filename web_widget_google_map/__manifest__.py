# -*- coding: utf-8 -*-
{
    'name': 'Web widget Google Maps',
    'summary': '''
        Two new widget of Google autocomplete
    ''',
    'description': '''
        Implementation of Google Autocomplete Address form and
        Google Places autocomplete through widget
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '16.0.1.1.2',
    'depends': ['base_google_map'],
    'assets': {
        'web.assets_backend': [
            'web_widget_google_map/static/src/widgets/**/*',
        ],
    },
    'data': ['data/gmap_libraries.xml'],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
