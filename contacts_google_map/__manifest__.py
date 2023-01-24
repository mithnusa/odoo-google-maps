# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Map',
    'summary': '''
        Short (1 phrase/line) summary of the module's purpose, used as
        subtitle on modules listing or apps.openerp.com''',
    'description': '''
        Long description of module's purpose
    ''',
    'author': 'Yopi Angi',
    'website': 'https://www.yourcompany.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Sales/CRM',
    'version': '0.1',
    'depends': [
        'base_geolocalize',
        'contacts',
        'web_view_google_map',
        'web_widget_google_map',
    ],
    'data': [
        'views/res_partner.xml',
    ],
    'demo': [],
}
