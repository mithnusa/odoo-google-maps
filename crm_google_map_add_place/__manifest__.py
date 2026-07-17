# -*- coding: utf-8 -*-
{
    "name": "CRM - Google Maps: Add Lead from Map Click",
    "summary": "Create CRM leads directly from the Google Maps view by clicking on any place or location",
    "description": """
CRM - Google Maps: Add Lead from Map Click
==========================================

Extends the CRM Google Maps view with a click-to-create workflow for leads.

Provides:

- ``crm.lead`` inherits ``google_map.add_place.mixin``, activating the click-to-create server-side methods for the CRM Lead model
- CRM-specific field mapping: place name → ``contact_name``, coordinates → ``customer_latitude`` / ``customer_longitude``, all address fields pre-filled
- ``action_in_map_google_place_create`` override that automatically sets the lead ``name`` to "<Place Name>'s opportunity" when creating from a named place
- Patches the CRM map renderer to include the ``InMapClickAddPlace`` component: clicking a named Google Place opens a pre-populated lead form; clicking empty map space reverse-geocodes the coordinate and pre-fills the form with the address
- Duplicate detection: if a lead with the same Google Place ID already exists, that record opens instead of creating a new one
- ``gplace_id`` stored on each lead created from a named Google Place
- Visual indicator in the map's top-right corner with one-click zoom shortcut
- Map view reloads automatically after save with a notification linking to the new lead
""",
    "license": "LGPL-3",
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
    "assets": {
        "web.assets_backend": [
            "crm_google_map_add_place/static/src/views/google_map/google_map_renderer.js",
            "crm_google_map_add_place/static/src/views/google_map/google_map_renderer.xml",
        ],
    },
}
