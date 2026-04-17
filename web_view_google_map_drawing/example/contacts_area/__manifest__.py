# -*- coding: utf-8 -*-
{
    'name': 'Partner Area (Google Maps Drawing demo implementation)',
    'version': '1.0.0',
    'author': 'Yopi Angi',
    'license': 'LGPL-3',
    'maintainer': 'Yopi Angi<yopiangi@gmail.com>',
    'support': 'yopiangi@gmail.com',
    'category': 'Hidden',
    'description': """
Partner Area
============
""",
    'depends': [
        'contacts_google_map',
        'web_view_google_map_drawing',
    ],
    'website': '',
    'data': [
        'security/ir.model.access.csv',
        'views/res_partner_area.xml',
        'views/res_partner.xml',
        'wizard/geojson_upload_wizard_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'contacts_area/static/src/views/*'
        ]
    },
    'demo': [],
    'installable': True,
}
