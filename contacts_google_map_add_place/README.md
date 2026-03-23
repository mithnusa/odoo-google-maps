# Contacts - Google Maps: Click to Add Place

## Overview

This module extends the Contacts Google Maps view with the ability to create new contacts directly from the map. Simply zoom in and click on any location — a named business or an empty street — and a pre-filled contact form opens instantly.

## What It Does

Adds a click-to-create workflow to the Google Maps view in Contacts. When you are zoomed in enough on the map, clicking a known Google Place (a shop, restaurant, office, etc.) fetches its name, address, phone number, and website from Google and opens a pre-populated quick-create form. Clicking on an unnamed location (an intersection, a building, an empty lot) reverse-geocodes the coordinate and pre-populates the form with the resolved address. After saving, the map refreshes automatically to show the new or updated contact as a marker.

## Key Features

- **Click-to-create on named places**: Clicking a Google Place on the map fetches its name, full address, phone number, and website, then opens a pre-filled contact form.
- **Click-to-create on any location**: Clicking anywhere on the map (not just named places) reverse-geocodes the coordinate and opens a contact form pre-filled with the resolved address.
- **Duplicate detection**: If a contact with the same Google Place ID already exists, the module opens that existing record instead of creating a duplicate.
- **Google Place ID stored on contact**: Each contact created from a Google Place has its Place ID saved, linking the Odoo record to the exact Google Maps location.
- **Visual activity indicator**: A map control in the top-right corner turns green when the zoom level is sufficient for click-to-create to be active.
- **Automatic map refresh**: After a contact is saved, the map view reloads automatically and a notification appears with a direct link to open the new or updated contact.

## Use Cases

### Adding a new business contact on the spot
While browsing the map, you spot a supplier's office or a prospect's location. Zoom in, click the marker, review the pre-filled form, and save — the contact is created without leaving the map.

### Capturing a precise address for a location without a Google listing
Click on a building or address that has no Google Place listing. The module reverse-geocodes the coordinate and fills in the street, city, postal code, and country automatically.

## Dependencies

- `web_view_google_map`
- `contacts_google_map`

## Installation

1. Install the module through Odoo Apps.
2. Ensure a valid Google API Key is configured in **Settings → General Settings → Google Maps** (Maps JavaScript API, Places API (New), and Geocoding API must all be enabled on the key).

## Basic Usage

1. Open **Contacts** and switch to the **Map** view.
2. Zoom into the area where you want to add a contact until the indicator button in the top-right corner turns green.
3. Click any location on the map.
4. Review the pre-filled contact form and save.
5. The map refreshes and a notification confirms the new contact with a link to open it.

## Related Modules

- `web_view_google_map`: Provides the core Google Map view type used by this module.
- `contacts_google_map`: Provides the Contacts-specific Google Maps view that this module extends.
- `contacts_google_map_add_place_extended`: Adds extra Google Places data fields to contacts created through this workflow (if installed).
