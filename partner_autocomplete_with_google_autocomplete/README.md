# Partner Autocomplete with Google Autocomplete

## Overview

This module combines Odoo's built-in partner autocomplete with Google Places autocomplete on the Contact (partner) form. It replaces the standard name field widget so users have both Odoo's company database lookup and a Google Places search available side by side.

## What It Does

Automatically applies a combined widget to the `name` field on all partner form views. A toggle button (Google icon) next to the name field opens a collapsible Google Places autocomplete panel. Selecting a place fills in the partner's address fields and coordinates without replacing the Odoo partner autocomplete, which remains available on the same field.

## Key Features

- **Combined Widget on Partner Name**: Replaces the `name` field widget on all `res.partner` form views automatically — no view XML changes required
- **Google Places Toggle Panel**: A collapsible panel with a Google Places autocomplete input opens when the Google icon button is clicked, and closes after a selection is made
- **Full Address Auto-Fill**: Selecting a place populates street, street2, city, state, zip, and country automatically
- **Geolocation Auto-Fill**: Latitude and longitude are stored automatically from the selected place's coordinates
- **Place Details Auto-Fill** (places mode): Also populates phone and website when a business is selected
- **Optional Read-Only Name Field**: A `no_manual_edit` option prevents direct typing in the name field, requiring users to select from autocomplete
- **Mapping Config Validation**: Shows a clear error in the panel if no valid mapping configuration is found, rather than silently failing

## Dependencies

- `partner_autocomplete`
- `contacts_google_autocomplete`

## Installation

1. Install the module through Odoo Apps
2. Ensure a valid Google Maps API Key is configured in Settings → General Settings → Google Maps
3. Ensure the Places API (New) is enabled in your Google Cloud Console
4. The Google Places mapping for `res.partner` must exist — it is created automatically when `contacts_google_autocomplete` is installed

## Basic Usage

Open any Contact form. The name field now has a Google icon toggle button beside it. Click the button to expand the Google Places autocomplete panel, type a business name or address, and select a result to auto-fill the partner details.

## Related Modules

- `partner_autocomplete`: Provides the base Odoo partner autocomplete widget that this module extends
- `contacts_google_autocomplete`: Provides the Google Places mapping for `res.partner` and the `web_widget_google_place_autocomplete` dependency
- `web_widget_google_place_autocomplete`: Provides the `GooglePlaceAutocompleteElement` component used in the panel
