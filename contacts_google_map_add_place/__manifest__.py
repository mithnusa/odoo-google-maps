# -*- coding: utf-8 -*-
{
    "name": "Contacts - Google Maps: Click to Add Place",
    "summary": """
        Create new contacts directly from the Google Maps view by clicking on any place or map location.
    """,
    "description": """
        Extends the Google Maps view for Contacts with a click-to-create workflow.
        When zoomed in sufficiently, clicking a named Google Place fetches its details
        (name, address, phone, website) via the Places API and pre-populates a quick-create
        form. Clicking on empty map space performs a reverse geocode and pre-populates the
        form with the resolved address. A visual indicator in the map corner signals when
        the feature is active. After saving, the map view reloads automatically to reflect
        the new or updated contact.
    """,
    "license": "LGPL-3",
    "author": "Yopi Angi",
    "website": "https://github.com/mithnusa",
    "support": "yopiangi@gmail.com",
    "category": "Tools",
    "version": "1.0.1",
    "depends": [
        "web_view_google_map",
        "base_google_map_add_place",
        "contacts_google_map",
    ],
    "data": [],
    "assets": {
        "web.assets_backend": [
            "contacts_google_map_add_place/static/src/views/**/*",
        ]
    },
    "demo": [],
    "installable": True,
    "application": False,
    "auto_install": False,
}
