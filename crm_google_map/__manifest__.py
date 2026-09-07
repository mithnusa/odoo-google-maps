{
    "name": "CRM Google Maps",
    "summary": "Google Maps view for CRM Leads and Opportunities with geolocation and marker colors",
    "description": """
CRM Google Maps
===============

Adds a Google Maps view to the CRM application for Leads and Opportunities.

Provides:

- ``customer_latitude``, ``customer_longitude``, ``customer_address``, and ``marker_color`` fields on ``crm.lead``
- ``_compute_customer_geo``: mirrors the linked partner's coordinates when the lead address is in sync; resets to ``(0, 0)`` when they diverge so the cron re-geocodes
- ``_compute_customer_address``: computed formatted address using the country's address format
- ``geo_localize()``: manual geocoding from the lead's address fields with a user notification when no result is found
- Scheduled geocoding job (every 12 hours, up to 80 leads per run) with OpenStreetMap rate-limit handling
- ``google_map`` view type added to the Leads, Opportunities, My Activities, Pipeline, and Forecast CRM actions
- CRM-specific marker cards showing deal name, stage, address, company, contact, phone, salesperson, expected revenue, probability, and closing date
- Activity scheduling buttons in each marker info window (schedule a new activity, view existing scheduled activities)
- Overlap-offset rendering so stacked markers remain individually clickable
- Sidebar listing leads with expected revenue and stage
- Geolocation tab on the lead form with coordinate display, geocode buttons, marker color picker, and an embedded map preview
""",
    "license": "LGPL-3",
    "author": "Yopi Angi",
    "website": "https://github.com/mithnusa",
    "support": "yopiangi@gmail.com",
    "category": "Sales/CRM",
    "version": "19.0.1.0.12",
    "depends": [
        "crm",
        "web_view_google_map",
    ],
    "data": [
        "data/cron_crm_lead_geolocalize.xml",
        "views/crm_lead.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "crm_google_map/static/src/views/google_map/google_map_view.scss",
            "crm_google_map/static/src/views/google_map/google_map_sidebar.scss",
            "crm_google_map/static/src/views/google_map/google_map_sidebar.js",
            "crm_google_map/static/src/views/google_map/google_map_sidebar.xml",
            "crm_google_map/static/src/views/google_map/google_map_renderer.js",
            "crm_google_map/static/src/views/google_map/google_map_renderer.xml",
            "crm_google_map/static/src/views/google_map/google_map_controller.js",
            "crm_google_map/static/src/views/google_map/google_map_view.js",
        ],
    },
}
