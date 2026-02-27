# -*- coding: utf-8 -*-
{
    'name': 'Partner Autocomplete with Google Autocomplete',
    'summary': '''
        Add Google Place Autocomplete to partner form
    ''',
    'description': '''
        Implementation of Google Autocomplete Element through widget
    ''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.2',
    'depends': ['partner_autocomplete', 'contacts_google_autocomplete'],
    'assets': {
        'web.assets_backend': [
            'partner_autocomplete_with_google_autocomplete/static/src/js/*',
        ],
    },
    'data': [],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
