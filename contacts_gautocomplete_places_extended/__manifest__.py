# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Places Autocomplete Extended',
    'summary': '''
        Extended version of Contacts Google Places Autocomplete Extended
    ''',
    'description': '''
        Extended version of Contacts Google Places Autocomplete Extended
        Added some more info (Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus code URL, Vicinity) of a place from Google place into Odoo
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '16.0.1.0.0',
    'depends': [
        'contacts_gautocomplete_places',
        'web_widget_google_places',
        'contacts_google_places',
    ],
    'data': ['views/res_partner.xml'],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
