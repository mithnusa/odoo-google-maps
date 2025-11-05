# -*- coding: utf-8 -*-
{
    'name': 'Web View Google Map Drawing',
    'summary': '''
        Present your geographical data in a new view "Google Maps"
    ''',
    'description': '''
        A view that allows you to add Google Maps in Odoo and gives a
        possibility to see your geographical data in Google maps without
        leaving Odoo
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.1',
    'depends': ['web_view_google_map'],
    'data': ['data/gmap_libraries.xml'],
    'assets': {
        'web.assets_backend': [
            'web_view_google_map_drawing/static/src/utils/**/*',
            'web_view_google_map_drawing/static/src/views/**/*',
            'web_view_google_map_drawing/static/src/fields/**/*',
            'web_view_google_map_drawing/static/src/widget/**/*',
        ]
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
