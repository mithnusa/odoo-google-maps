# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Places Autocomplete',
    'summary': '''
        Enable Google Places autocomplete on contact name
    ''',
    'description': '''
        Help you find contact by using Google places autocomplete
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.0',
    'depends': ['partner_autocomplete', 'web_widget_google_map'],
    'data': [
        # 'views/res_partner.xml'
    ],
    'assets': {
        'web.assets_backend': [
            'contacts_gautocomplete_places/static/src/widgets/partner_autocomplete_with_google_place/*',
        ],
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
