# -*- coding: utf-8 -*-
{
    'name': 'CRM Google Autocomplete Places Extended',
    'summary': '''
        Extended version of CRM Google Autocomplete Places
    ''',
    'description': '''
        Extended version of CRM Google Autocomplete Places
        Added some more info (Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus code URL, Vicinity) of a place from Google place into Odoo
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '16.0.1.0.0',
    'depends': [
        'crm_google_places',
        'crm_gautocomplete_places',
        'web_widget_google_places',
    ],
    'data': ['views/crm_lead.xml'],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
