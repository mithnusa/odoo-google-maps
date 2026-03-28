# -*- coding: utf-8 -*-
{
    "name": "CRM - Google Maps: Add Lead from Map Click",
    "summary": """
        Create new CRM leads directly from the Google Maps view by clicking on any place or map location.
    """,
    "description": """
        Activates the click-to-create workflow on the CRM Google Maps view by inheriting
        the google_map.add_place.mixin into crm.lead.

        When zoomed in sufficiently (zoom >= 15), clicking a named Google Place fetches its
        details (place name, address, phone, website, coordinates) via the Places API and
        opens a pre-populated quick-create form for a new lead. The place display name is
        automatically used to set the opportunity name (e.g. "Acme Corp's opportunity").
        Clicking empty map space performs a reverse geocode and pre-populates the form with
        the resolved address and coordinates.

        Field mapping is adapted for crm.lead: place name populates contact_name,
        coordinates map to customer_latitude/customer_longitude, and all standard address
        fields (street, city, zip, state, country) are pre-filled. Duplicate detection
        by Google Place ID is inherited from the base mixin.
    """,
    "license": "AGPL-3",
    "author": "Yopi Angi",
    "website": "https://github.com/mithnusa",
    "support": "yopiangi@gmail.com",
    "category": "Tools",
    "version": "1.0.0",
    "depends": [
        "web_view_google_map",
        "base_google_map_add_place",
        "crm_google_map",
    ],
    "data": [],
    "assets": {
        "web.assets_backend": [
            "crm_google_map_add_place/static/src/views/**/*",
        ]
    },
    "demo": [],
    "installable": True,
    "application": False,
    "auto_install": False,
}
