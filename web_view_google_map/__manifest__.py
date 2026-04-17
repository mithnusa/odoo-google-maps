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
    'license': 'LGPL-3',
    'author': 'Yopi Angi (Mithnusa), Brian McMaster (McMaster Lawn & Pest Services)',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.23',
    'depends': ['base_google_map'],
    'data': ['views/res_config_settings.xml'],
    'assets': {
        'web.assets_backend': [
            'web_view_google_map/static/src/views/**/*',
            'web_view_google_map/static/src/fields/**/*',
            'web_view_google_map/static/src/helpers/*',
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
