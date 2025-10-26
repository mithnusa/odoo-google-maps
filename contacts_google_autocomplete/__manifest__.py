# -*- coding: utf-8 -*-
{
    'name': 'Contact Google Autocomplete',
    'summary': '''
        Adds Google Places autocomplete functionality to the Contact form.
        It enhances the name and street fields with Google Places autocomplete,
        allowing users to quickly fill in contact information by selecting from Google Places suggestions
    ''',
    'description': '''
        Adds Google Autocomplete to name and street in Contact form
    ''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.0',
    'depends': ['contacts', 'web_widget_google_place_autocomplete'],
    'data': ['views/res_partner_views.xml'],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'post_init_hook': '_post_install_hook_configure_contact_google_place_mapping',
}
