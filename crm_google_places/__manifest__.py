# -*- coding: utf-8 -*-
{
    'name': 'CRM Google Places',
    'version': '16.0.1.0.1',
    'author': 'Yopi Angi',
    'license': 'AGPL-3',
    'maintainer': 'Yopi Angi<yopiangi@gmail.com>',
    'support': 'yopiangi@gmail.com ',
    'category': 'Sales/CRM',
    'sequence': 1000,
    'summary': 'CRM Google Places',
    'description': """
CRM Google Places
=================

Add Additional information to your leads/opportunity.
This module using Google Places as a source data, so the information you get should be reliable.

You can create a new leads within Google maps by:
1. Click place or any location on Google Maps.
2. By search. You do search by address, name, or type of place.
""",
    'depends': [
        'base_google_places',
        'crm_google_map',
    ],
    'website': 'https://github.com/mithnusa',
    'data': ['views/crm_lead.xml'],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'active': True,
}
