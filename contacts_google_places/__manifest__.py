# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Places',
    'version': '16.0.1.0.1',
    'author': 'Yopi Angi',
    'license': 'AGPL-3',
    'maintainer': 'Yopi Angi<yopiangi@gmail.com >',
    'support': 'yopiangi@gmail.com ',
    'category': 'Extra Tools',
    'summary': 'Contacts Google Places',
    'description': """
Contacts Google Places
======================

Add Additional information to your contacts.
This module using Google Places as a source data, so the information you would get should be reliable.

You can create a new contact within Google maps by:
1. Click place on Google Maps.
2. By search. You can do search by address, name, or type of place.
""",
    'depends': [
        'base_google_places',
        'contacts_google_map',
    ],
    'website': 'https://github.com/mithnusa',
    'data': ['views/res_partner.xml'],
    'assets': {
        'web.assets_backend': [
            'contacts_google_places/static/src/views/**/*',
        ]
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
