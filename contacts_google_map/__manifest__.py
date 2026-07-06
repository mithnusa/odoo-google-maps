# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Maps',
    'summary': 'Google Maps view for Contacts with nearby search, marker colors, and geocoding cron',
    'description': """
Contacts Google Maps
====================

Adds a Google Maps view to the Contacts application.

Provides:

- ``google_map`` view type added to the Contacts action (alongside list, kanban, and form)
- Contact avatars displayed in the map sidebar and marker info windows
- ``marker_color`` field on ``res.partner`` with a color picker on the Geolocation form page
- Embedded map widget on the contact form's Geolocation page showing the contact's coordinates
- **Nearby Contacts** button on the contact form — opens the map filtered to contacts within a configurable radius, with correct antimeridian wraparound handling
- Scheduled geocoding job (every 12 hours, up to 80 contacts per run) that automatically geocodes contacts that have an address but no coordinates; respects OpenStreetMap Nominatim rate limits with per-record pausing
- ``_delete_coordinates`` override that preserves coordinates when the address is updated from the Google Maps workflow (``is_from_google_maps`` context flag)
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Sales/CRM',
    'version': '19.0.1.0.12',
    'depends': [
        'base_geolocalize',
        'contacts',
        'web_view_google_map',
    ],
    'data': [
        'data/cron_contact_geolocalize.xml',
        'views/res_partner.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'contacts_google_map/static/src/views/google_map/google_map_view.scss',
            'contacts_google_map/static/src/views/google_map/google_map_arch_parser.js',
            'contacts_google_map/static/src/views/google_map/google_map_sidebar.js',
            'contacts_google_map/static/src/views/google_map/google_map_sidebar.xml',
            'contacts_google_map/static/src/views/google_map/google_map_renderer.js',
            'contacts_google_map/static/src/views/google_map/google_map_renderer.xml',
            'contacts_google_map/static/src/views/google_map/google_map_view.js',
        ],
    },
}
