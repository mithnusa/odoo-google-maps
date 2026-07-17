# -*- coding: utf-8 -*-
{
    'name': 'Sales Google Maps',
    'summary': 'Google Maps view for Sales Orders grouped by customer with totals and nearby search',
    'description': """
Sales Google Maps
=================

Adds a customer-grouped Google Maps view to Quotations, Orders, Orders to Invoice,
Orders to Upsell, and the Customers list.

Provides:

- ``partner_latitude`` and ``partner_longitude`` stored related Float fields on ``sale.order``, proxying the customer partner's geolocation so orders can be placed on the map without a separate geocoding step
- One ``AdvancedMarkerElement`` per customer group showing the customer name, order count, aggregated ``amount_total``, and ``avatar_128``
- Overlap-offset detection: same-address customers are shifted apart; the shifted marker displays an info indicator with a tooltip explaining the adjustment
- Marker hover animation (``mouseenter`` / ``touchstart``) that lifts and glows the marker; auto-triggered for 1 s after the map pans to a marker via the sidebar
- Grouped-only enforcement: if no group-by is active the map renders no markers and a notification guides the user to apply one
- Automatic group loading via ``openGroupsByDefault`` so all markers are visible on first render without manual group expansion
- Sidebar listing every customer group with avatar, name, and aggregated total; clicking a row pans and zooms the map to that customer's marker
- Arrow (→) button on each marker and sidebar entry opens the filtered order list for that customer; location-arrow button triggers nearby-customer search
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Sales/Sales',
    'version': '1.0.0',
    'depends': ['sale_management', 'web_view_google_map'],
    'data': ['views/sale_order.xml', 'views/res_partner.xml'],
    'assets': {
        'web.assets_backend': [
            'sale_google_map/static/src/views/google_map/google_map_view.scss',
            'sale_google_map/static/src/views/google_map/google_map_sidebar.js',
            'sale_google_map/static/src/views/google_map/google_map_sidebar.xml',
            'sale_google_map/static/src/views/google_map/google_map_renderer.js',
            'sale_google_map/static/src/views/google_map/google_map_controller.js',
            'sale_google_map/static/src/views/google_map/google_map_view.js',
        ],
    },
}
