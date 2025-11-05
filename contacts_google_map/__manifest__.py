# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Maps',
    'summary': '''
        Show your contacts in a new view Google Maps
    ''',
    'description': '''
        A new view 'Google Maps' added on Contacts, gives you
        an ability to show your contact location in Google Maps
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Sales/CRM',
    'version': '1.0.1',
    'depends': [
        'base_geolocalize',
        'contacts',
        'web_view_google_map',
        'web_widget_google_map',
    ],
    'data': ['data/cron_contact_geolocalize.xml', 'views/res_partner.xml'],
    'assets': {
        'web.assets_backend': [
            'contacts_google_map/static/src/views/**/*',
        ]
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
