# -*- coding: utf-8 -*-
{
    'name': 'Web View Google Map WebGL',
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
    'version': '16.0.1.0.0',
    'depends': ['web_view_google_map', 'contacts_google_places', 'contacts_google_map'],
    'data': ['views/res_partner.xml'],
    'assets': {
        'web.assets_backend': [
            'web_view_google_map_webgl/static/src/views/**/*',
        ]
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
