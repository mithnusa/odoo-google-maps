# -*- coding: utf-8 -*-
{
    "name": "Base - Google Maps: Add Place from Map Click",
    "summary": """
        Abstract mixin and UI component for creating Odoo records directly from the Google Maps view by clicking on a place or map location.
    """,
    "description": """
        Provides the reusable foundation for click-to-create workflows on Google Maps views.

        Includes an abstract model mixin (google_map.add_place.mixin) that application
        modules inherit to gain click-to-create behaviour. The mixin handles Google Places API
        detail fetching, reverse geocoding via the Geocoding API, address component mapping to
        Odoo partner fields, and duplicate detection by Google Place ID.

        Also ships the InMapClickAddPlace OWL component: a map overlay that listens for clicks
        when zoomed in sufficiently (zoom >= 15). Clicking a named Google Place fetches its
        details (name, address, phone, website, coordinates) and opens a pre-populated
        quick-create form. Clicking empty map space reverse-geocodes the coordinate and
        pre-populates the form with the resolved address. A visual indicator in the map corner
        shows when the feature is active. After saving, the map view reloads automatically.
    """,
    "license": "AGPL-3",
    "author": "Yopi Angi",
    "website": "https://github.com/mithnusa",
    "support": "yopiangi@gmail.com",
    "category": "Tools",
    "version": "1.0.0",
    "depends": [
        "web_view_google_map",
    ],
    "data": [],
    "assets": {
        "web.assets_backend": [
            "base_google_map_add_place/static/src/components/**/*",
        ]
    },
    "demo": [],
    "installable": True,
    "application": False,
    "auto_install": False,
}
