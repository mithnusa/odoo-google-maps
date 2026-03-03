# -*- coding: utf-8 -*-
{
    'name': 'Web widget Google Maps',
    'summary': '''
        A new widget for Google Maps integration
    ''',
    'description': '''
        A widget that allows you to display Google Maps in form view and be able to edit the geolocation (lat & lng)
    ''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.3',
    'depends': ['base_google_map', 'web_view_google_map'],
    'assets': {
        'web.assets_backend': [
            'web_widget_google_map/static/src/widgets/**/*',
        ],
    },
    'data': [],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
