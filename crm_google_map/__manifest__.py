# -*- coding: utf-8 -*-
{
    'name': 'CRM Google Maps',
    'summary': '''
        Show leads or opportunities in Google Maps view
    ''',
    'description': '''
        A new view 'Google Maps' added on leads or opportunities, gives you
        an ability to show the location in Google Maps
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Sales/CRM',
    'version': '1.0.2',
    'depends': [
        'crm',
        'web_view_google_map',
        'web_widget_google_map',
    ],
    'data': ['views/crm_lead.xml'],
    'assets': {
        'web.assets_backend': [
            'crm_google_map/static/src/views/**/*',
        ]
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
