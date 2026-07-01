# -*- coding: utf-8 -*-
{
    "name": "Base - Google Maps: Add Place from Map Click",
    "summary": "Abstract mixin and UI component for creating Odoo records by clicking on a Google Maps view",
    "description": """
Base - Google Maps: Add Place from Map Click
============================================

Reusable foundation for click-to-create workflows on Google Maps views.

Provides:

- ``google_map.add_place.mixin`` — abstract model mixin with server-side methods for place detail fetching, address component mapping, reverse geocoding, and duplicate detection
- ``gplace_id`` Char field added to any inheriting model for Google Place ID storage
- Address parsing from the adr microformat (Places API New) and plain-text ``formatted_address`` (Geocoding API), with multi-country postal code support
- ``InMapClickAddPlace`` OWL component — map overlay listening for Shift+clicks at zoom ≥ 15, fetching place or reverse-geocoded data, and opening a pre-populated quick-create form; exposes a ``controlPosition`` getter for subclasses to relocate the indicator without patching the component
- Visual indicator injected into the map corner (``RIGHT_TOP`` by default) showing when map-click-to-create is active, with a one-click zoom shortcut
""",
    "license": "LGPL-3",
    "author": "Yopi Angi",
    "website": "https://github.com/mithnusa",
    "support": "yopiangi@gmail.com",
    "category": "Tools",
    "version": "19.0.1.0.5",
    "depends": [
        "web_view_google_map",
    ],
    "assets": {
        "web.assets_backend": [
            "base_google_map_add_place/static/src/components/in_map_click_add_place/in_map_click_add_place.js",
            "base_google_map_add_place/static/src/components/in_map_click_add_place/in_map_click_add_place.xml",
            "base_google_map_add_place/static/src/components/in_map_click_add_place/in_map_click_add_place.scss",
        ],
    },
}
