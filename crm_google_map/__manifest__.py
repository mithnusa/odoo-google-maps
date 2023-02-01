# -*- coding: utf-8 -*-
{
    'name': 'CRM Google Map',
    'summary': '''
        Show leads or opportunities in Google maps view
    ''',
    'description': '''
        A new view 'Google maps' added on leads or opportunities, gives you
        an ability to show the location in Google maps
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Sales/CRM',
    'version': '16.0.1.0.0',
    'depends': [
        'crm',
        'web_view_google_map',
    ],
    'data': ['views/crm_lead.xml'],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
