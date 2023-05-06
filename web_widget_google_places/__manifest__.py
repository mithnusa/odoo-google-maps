# -*- coding: utf-8 -*-
{
    'name': 'Web Widget Google Places',
    'summary': '''
        Widget Google Places Extended
    ''',
    'description': '''
        Extend widget Google Autocomplete Address form and
        Google Places Autocomplete by automatically fulfill Google Places fields (base_google_places)
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '16.0.1.0.0',
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
