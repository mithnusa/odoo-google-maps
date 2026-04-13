# -*- coding: utf-8 -*-
{
    'name': 'Sales Google Maps',
    'summary': 'Visualize sale orders and customers on an interactive Google Maps view',
    'description': """
Sales Google Maps
=================
Adds a Google Maps view to Sale Orders and Quotations, grouping orders by customer
and placing each customer as a marker on the map.

Key features:
- Interactive map view available on Quotations, Orders, Orders to Invoice, and Orders to Upsell
- Markers show customer name and aggregated order total at a glance
- Click a marker to open the customer's sale orders in a list
- "Find Nearby" button on each marker to locate other customers in the area
- Partner avatar displayed on each marker for quick visual identification
- Sidebar listing all customers with totals, synced with the map

Requires a Google API Key configured in Settings → General Settings → Google Maps.
    """,
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Sales/Sales',
    'version': '1.0.10',
    'depends': ['sale_management', 'web_view_google_map'],
    'data': ['views/sale_order.xml', 'views/res_partner.xml'],
    'assets': {
        'web.assets_backend': [
            'sale_google_map/static/src/views/**/*',
        ]
    },
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
}
