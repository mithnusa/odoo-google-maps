# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Autocomplete Address form extended',
    'summary': '''
        Extended version of Contacts Google Autocomplete Address form
    ''',
    'description': '''
        Extended version of Contacts Google Autocomplete Address form
        Added some more info (Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus code URL, Vicinity) of a place from Google place into Odoo
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '16.0.1.0.0',
    'depends': [
        'contacts_gautocomplete_address_form',
        'web_widget_google_places',
        'contacts_google_places',
    ],
    'data': ['views/res_partner.xml'],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
