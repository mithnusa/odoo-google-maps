{
    "name": "Contacts - Google Maps: Click to Add Place",
    "summary": "Create contacts directly from the Google Maps view by clicking on any place or location",
    "description": """
Contacts - Google Maps: Click to Add Place
==========================================

Extends the Contacts Google Maps view with a click-to-create workflow.

Provides:

- ``res.partner`` inherits ``google_map.add_place.mixin``, activating the click-to-create server-side methods for the Contact model
- Patches the Contacts map renderer to include the ``InMapClickAddPlace`` component: clicking a named Google Place fetches name, address, phone, and website via the Places API (New) and opens a pre-populated quick-create form; clicking empty map space reverse-geocodes the coordinate and pre-fills the form with the resolved address
- Duplicate detection: if a contact with the same Google Place ID already exists, that record opens instead of creating a new one
- ``gplace_id`` stored on each contact created from a named Google Place
- Visual indicator in the map's top-right corner with one-click zoom shortcut
- Map view reloads automatically after save with a notification linking to the new contact
""",
    "license": "LGPL-3",
    "author": "Yopi Angi",
    "website": "https://www.mithnusa.com",
    "support": "yopiangi@gmail.com",
    "category": "Tools",
    "version": "19.0.1.0.3",
    "depends": [
        "web_view_google_map",
        "base_google_map_add_place",
        "contacts_google_map",
    ],
    "assets": {
        "web.assets_backend": [
            "contacts_google_map_add_place/static/src/views/google_map/google_map_renderer.js",
            "contacts_google_map_add_place/static/src/views/google_map/google_map_renderer.xml",
        ],
    },
}
