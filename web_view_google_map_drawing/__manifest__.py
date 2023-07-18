# -*- coding: utf-8 -*-
{
    'name': 'Web View Google Map Drawing',
    'summary': '''
        Present your geographical data in a new view "Google maps"
    ''',
    'description': '''
        A view that allows you to add Google maps in Odoo and gives a
        possibility to see your geographical data in Google maps without
        leaving Odoo
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '16.0.1.4.2',
    'depends': ['web_view_google_map'],
    'data': ['data/polygon_lines.xml', 'data/gmap_libraries.xml'],
    'assets': {
        'web.assets_backend': [
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
