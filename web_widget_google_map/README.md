# Web Widget Google Maps

## Overview

This module provides a `google_map` form widget that embeds a Google Maps preview directly inside any Odoo form view. An edit button opens an interactive dialog where users can drag a marker or search for a place to update the record's coordinates.

## What It Does

Adds a `google_map` widget for use in form views. It shows an embedded map at the record's stored latitude and longitude. When the field is editable, an edit button opens a full interactive map in a dialog — users can drag the marker to any position or use a place search to navigate and confirm a new location. Saving the dialog writes the updated coordinates back to the record.

## Key Features

- **Embedded Map Preview**: Renders a Google Maps iframe inside the form view at the record's current coordinates, with configurable zoom, map type, width, and height
- **Interactive Edit Dialog**: An edit button opens a dialog with a full interactive Google Map and a draggable marker for precise coordinate selection
- **Draggable Marker**: Drag the marker anywhere on the map to pick new coordinates; the dialog updates on drop and writes the values to the record on save
- **Place Search in Dialog**: A Google Places search box inside the dialog lets users navigate the map to a named location before dropping the marker
- **Street View Side-by-Side Dialog**: Opens an XL dialog showing a Google Map on the left and Google Street View on the right; automatically falls back to a marker-only map when no Street View imagery is available at the given coordinates
- **Read-Only Mode**: When the form field is in read-only mode, the embedded map is shown without an edit button and the dialog marker is non-draggable
- **Shared Map Components**: Bundles `GoogleMapGeolocate` (browser geolocation button) and `GoogleMapSearchPlaces` (in-map Google Places autocomplete) as reusable OWL components; these are consumed directly by `web_view_google_map`'s map view

## Dependencies

- `base_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure a valid Google Maps API key is configured in **Settings → General Settings → Google Maps**

## Basic Usage

Add the widget to any form view using `<widget name="google_map" lat="field_latitude" lng="field_longitude"/>`. The `lat` and `lng` attributes must reference Float fields that are present in the view.

## Related Modules

- `base_google_map`: Provides the API key configuration and Google Maps JavaScript API loader
