# -*- coding: utf-8 -*-
{
    'name': 'CRM Google Autocomplete',
    'summary': '''
        Add Google Places Autocomplete to Company Name and Street in Lead form
    ''',
    'description': '''
        Add Google Places Autocomplete to Company Name and Street in Lead form
    ''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.0',
    'depends': ['crm', 'web_widget_google_place_autocomplete'],
    'data': ['views/crm_lead_views.xml'],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'post_init_hook': '_post_install_hook_configure_crm_google_place_mapping',
}
