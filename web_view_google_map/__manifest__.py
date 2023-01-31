# -*- coding: utf-8 -*-
{
    'name': 'Web View Google Map',
    'summary': '''
        A new view 'Google maps'
        Present your geographical data in Google maps without leave Odoo app
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
    'version': '0.1',
    'depends': ['base_google_map'],
    'data': [
        'data/gmap_libraries.xml',
    ],
    'assets': {
        'web.assets_backend': ['web_view_google_map/static/src/views/**/*'],
    },
    'demo': [],
}
