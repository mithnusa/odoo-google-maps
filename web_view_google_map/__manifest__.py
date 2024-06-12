# -*- coding: utf-8 -*-
{
    'name': 'Web View Google Map',
    'summary': '''
        Present your geographical data in a new view "Google maps"
    ''',
    'description': '''
        A view that allows you to add Google maps in Odoo and gives a
        possibility to see your geographical data in Google maps without
        leaving Odoo
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi (Mithnusa), Brian McMaster (McMaster Lawn & Pest Services)',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '16.0.4.1.4',
    'depends': ['base_google_map'],
    'data': ['data/gmap_libraries.xml'],
    'assets': {
        'web.assets_backend': [
            'web_view_google_map/static/src/views/**/*',
            'web_view_google_map/static/src/fields/**/*',
            ('remove', 'web_view_google_map/static/src/views/**/*.dark.scss'),
        ],
        'web.dark_mode_assets_backend': [
            'web_view_google_map/static/src/views/**/*.dark.scss'
        ],
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'uninstall_hook': '_uninstall_view_google_map',
}
