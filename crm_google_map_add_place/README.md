# CRM - Google Maps: Add Lead from Map Click

## Overview

This module activates the click-to-create workflow on the CRM Google Maps view. Users can click any named place or map location to instantly open a pre-populated lead creation form without leaving the map.

## What It Does

Extends `crm.lead` with the `google.map.add.place.partner.mixin` and patches the CRM Google Maps renderer to include the click-to-create UI component. When the map is zoomed in sufficiently, clicking a named Google Place or an empty location on the map opens a quick-create form with address, contact, and location details already filled in.

## Key Features

- **Click Named Places**: Click any Google Place on the map to fetch its name, address, phone, website, and coordinates and open a pre-populated lead form
- **Auto Lead Name**: The opportunity name is automatically set from the place's display name (e.g. "Acme Corp's opportunity")
- **Click Empty Map Space**: Click anywhere on the map to reverse-geocode the coordinate and open a lead form pre-filled with the resolved address
- **CRM Field Mapping**: Place name populates `contact_name`, coordinates map to `customer_latitude` / `customer_longitude`, and all address fields are pre-filled
- **Duplicate Detection**: If a lead with the same Google Place ID already exists, the existing record is opened instead of creating a duplicate
- **Visual Indicator**: A map control in the top-right corner turns green when the feature is active (zoom ≥ 15)
- **Auto-reload**: The map view reloads automatically after saving so the new lead appears on the map immediately

## Dependencies

- `web_view_google_map`
- `base_google_map_add_place`
- `crm_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure a Google API Key with Maps JavaScript API, Places API (New), and Geocoding API is configured in Settings → General Settings → Google Maps

## Basic Usage

1. Open CRM and switch to the Google Maps view
2. Zoom in until the indicator in the top-right corner turns green
3. Click any named place or empty map location
4. Review the pre-populated lead form and save

## Related Modules

- `base_google_map_add_place`: Abstract mixin and UI component providing the core click-to-create logic
- `crm_google_map`: Base CRM Google Maps view
- `contacts_google_map_add_place`: Same click-to-create feature for Contacts / Partners
