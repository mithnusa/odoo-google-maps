# -*- coding: utf-8 -*-
{
    'name': 'Sales Google Maps',
    'summary': 'Show your Sales on Google Maps',
    'description': '',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Sales/Sales',
    'version': '16.0.1.1.0',
    'depends': ['sale_management', 'web_view_google_map'],
    'data': ['views/sale_order.xml'],
    'assets': {
        'web.assets_backend': [
            'sale_google_map/static/src/views/**/*',
        ],
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
