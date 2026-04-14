# Base - Google Maps: Add Place from Map Click

## Overview

This module provides the reusable foundation for creating Odoo records directly from a Google Maps view by clicking on the map. It supplies an abstract model mixin and a map UI component that application modules inherit and integrate.

## What It Does

Adds a click-to-create workflow to Google Maps views. When the map is zoomed in sufficiently, clicking a named Google Place fetches its details from the Places API and opens a pre-populated quick-create form. Clicking on empty map space reverse-geocodes the coordinate and opens a form pre-filled with the resolved address.

This module is a base layer — it does not activate the feature on any model by itself. Application-specific modules (e.g. `contacts_google_map_add_place`) inherit the mixin and wire it into the map view for a particular Odoo model.

## Key Features

- **Abstract Model Mixin**: Provides `google_map.add_place.mixin` with all the logic for fetching place details, parsing addresses, and opening quick-create forms
- **Places API Integration**: Fetches name, address, phone, website, and coordinates from the Google Places API (New) when clicking a named place
- **Reverse Geocoding**: Resolves map coordinates to a structured address via the Google Geocoding API when clicking empty map space
- **Address Mapping**: Maps Google address components to Odoo partner fields (street, city, zip, state, country) with multi-country format support
- **Duplicate Detection**: Checks for an existing record with the same Google Place ID before opening a create form, opening the existing record instead
- **Visual Indicator & Zoom Shortcut**: Injects a map control in the top-right corner that turns green and animates when the feature is active (zoom ≥ 15); clicking it while zoomed out automatically zooms to zoom 15 and pans to the nearest visible marker
- **Auto-reload**: Refreshes the map view automatically after a record is saved

## Dependencies

- `web_view_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure a Google API Key with Maps JavaScript API, Places API (New), and Geocoding API is configured in Settings → General Settings → Google Maps

## Basic Usage

This module is not used directly. Install an application module that extends it, such as `contacts_google_map_add_place`, and open that application's Google Maps view to use the feature.

## Related Modules

- `contacts_google_map_add_place`: Activates the click-to-create feature for Contacts / Partners
- `crm_google_map_add_place`: Activates the click-to-create feature for CRM Leads
- `web_view_google_map`: Base Google Maps view module
