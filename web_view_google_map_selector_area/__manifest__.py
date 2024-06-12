# -*- coding: utf-8 -*-
{
    'name': 'Web View Google Map Selector Area',
    'summary': '''Web View Google Map Selector Area''',
    'description': '''
Web View Google Map Selector Area
=================================

An extension feature added to the Google Map view. It allows users to select an area on the map and capture all markers within that area.
''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi (Mithnusa), Brian McMaster (McMaster Lawn & Pest Services)',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '16.0.1.1.1',
    'depends': ['web_view_google_map'],
    'assets': {
        'web.assets_backend': [
            'web_view_google_map_selector_area/static/src/views/**/*',
        ]
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
