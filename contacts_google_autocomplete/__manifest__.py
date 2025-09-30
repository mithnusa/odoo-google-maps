# -*- coding: utf-8 -*-
{
    'name': 'Partner Google Autocomplete',
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
    'version': '1.0.0',
    'depends': ['contacts', 'web_widget_google_map'],
    'data': ['views/res_partner_views.xml'],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'post_init_hook': '_post_install_hook_configure_contact_google_place_mapping',
}
