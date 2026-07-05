# Web Widget Google Maps

## Overview

This module provides a `google_map` form widget that adds a single map button to any Odoo form view. Clicking the button opens an interactive Google Maps dialog where users can view the record's location and, in edit mode, drag a marker or search for a place to update the coordinates.

## What It Does

Adds a `google_map` widget for use in form views. A single button — "View on Map" in read-only mode, "Update on Map" in edit mode — opens a full interactive Google Map dialog centred on the record's stored latitude and longitude. In edit mode, users can drag the marker or use the built-in place search to pick a new location; saving the dialog writes the updated coordinates back to the record.

## Key Features

- **Single-Click Map Access**: One button opens the interactive map dialog directly — no extra toggle or step required
- **Interactive Edit Dialog**: Full Google Map in a dialog with a draggable marker for precise coordinate selection
- **Draggable Marker**: Drag the marker anywhere on the map to pick new coordinates; values are written to the record on Save
- **Place Search in Dialog**: A Google Places search box inside the dialog lets users navigate to any address or landmark before placing the marker
- **Read-Only Mode**: In read-only contexts the dialog opens in view-only mode — the marker is fixed and no Save button is shown
- **Open in Google Maps**: A link in the dialog footer opens the current coordinates in the Google Maps website
- **Street View Side-by-Side Dialog (component)**: Provides `GoogleMapStreetViewSideBySideDialog`, an XL dialog showing a Google Map and Google Street View side by side; falls back gracefully when no Street View imagery is available
- **Shared Map Components**: Bundles `GoogleMapGeolocate` (browser geolocation button) and `GoogleMapSearchPlaces` (in-map Google Places autocomplete) as reusable OWL components consumed by `web_view_google_map`'s map view

## Dependencies

- `base_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure a valid Google Maps API key is configured in **Settings → General Settings → Google Maps**

## Basic Usage

Add the widget to any form view:

```xml
<widget name="google_map" lat="partner_latitude" lng="partner_longitude"/>
```

The `lat` and `lng` attributes must reference Float fields that are present in the view. An optional `maptype` attribute accepts `roadmap` (default) or `satellite`.

## Related Modules

- `base_google_map`: Provides the API key configuration and Google Maps JavaScript API loader
- `web_view_google_map`: Map view for Odoo records; consumes the shared components bundled here
