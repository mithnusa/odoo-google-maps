# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Map',
    'summary': '''
        Show your contacts in Google maps view
    ''',
    'description': '''
        A new view 'Google maps' added on Contacts, gives you
        an ability to show your contact location in Google maps
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Sales/CRM',
    'version': '16.0.1.1.2',
    'depends': [
        'base_geolocalize',
        'contacts',
        'web_view_google_map',
    ],
    'data': ['data/cron_contact_geolocalize.xml', 'views/res_partner.xml'],
    'assets': {
        'web.assets_backend': [
            'contacts_google_map/static/src/views/google_map/*',
        ]
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
