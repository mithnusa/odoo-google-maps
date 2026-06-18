# -*- coding: utf-8 -*-
{
    'name': 'Delivery Google Maps',
    'summary': 'Google Maps view for Delivery Orders and stock pickings plotted by delivery address',
    'description': """
Delivery Google Maps
====================

Adds a Google Maps view to Delivery Orders and other stock picking lists
in Odoo's Inventory application.

Provides:

- ``partner_latitude``, ``partner_longitude``, and ``partner_contact_address`` related fields on ``stock.picking``, proxying the delivery partner's geolocation and formatted address
- ``google_map`` view for ``stock.picking`` with teal markers, sidebar title set to picking reference (``name``), and sidebar subtitle set to the delivery contact address (``partner_contact_address``)
- Map view added to 6 Inventory actions: Deliveries, Ready to Transfer, All Operations, Waiting Transfer, Late Transfers, and Backorders
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Inventory',
    'version': '1.0.1',
    'depends': ['sale_stock', 'stock_delivery', 'web_view_google_map'],
    'data': ['views/stock_picking.xml'],
    'installable': True,
    'application': False,
    'auto_install': False,
}
