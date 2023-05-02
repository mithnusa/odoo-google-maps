# -*- coding: utf-8 -*-
{
    'name': 'Web widget Google Places',
    'summary': '''
        Widget google places extended
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
    'version': '16.0.1.1.0',
    'depends': ['base_google_places', 'web_widget_google_map'],
    'assets': {
        'web.assets_backend': [
            'web_widget_google_places/static/src/widgets/**/*',
        ],
    },
    'data': [],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
