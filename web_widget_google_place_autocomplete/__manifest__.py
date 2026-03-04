# -*- coding: utf-8 -*-
{
    'name': 'Web widget Google Place Autocomplete',
    'summary': '''
        New widget of Google Place Autcomplete using the NEW Place API
    ''',
    'description': '''
        Implementation of Google Places Autocomplete Element through widget
    ''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.6',
    'depends': ['base_google_map'],
    'assets': {
        'web.assets_backend': [
            'web_widget_google_place_autocomplete/static/src/hooks/*',
            'web_widget_google_place_autocomplete/static/src/widgets/**/*',
            'web_widget_google_place_autocomplete/static/src/component/*',
        ],
    },
    'data': [
        'security/ir.model.access.csv',
        'views/res_country.xml',
        'views/google_places_mapping_views.xml',
    ],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
