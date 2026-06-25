# Web View Google Map

## Overview

This module adds an interactive Google Maps view type to Odoo, allowing any model with latitude and longitude fields to display its records as markers on a map. Users can browse, search, select, and act on records directly from the map interface.

## What It Does

Registers a new `google_map` view type alongside Odoo's standard list, form, and kanban views. When added to a model's action, users see a map with one marker per record, a synchronized sidebar listing, and tools for navigating, filtering, and acting on records without leaving the map.

## Key Features

- **Map View Type**: Adds `google_map` as a valid Odoo view type — displayed alongside list, kanban, and form in the view switcher
- **Record Markers**: Displays each record as a pin-style marker with the record's first initial; color-coded by field value or fixed color
- **Sidebar Panel**: Shows a list of records beside the map; clicking a record in the sidebar highlights its marker, and vice versa
- **Marker Clustering**: Automatically groups nearby markers at low zoom levels using MarkerClusterer to keep the map readable
- **Overlapping Marker Handling**: When records share identical coordinates, markers are spread apart for visibility; clicking one zooms in to reveal the connection
- **Grouping**: Group records by a Many2one field — the sidebar shows collapsible groups and each group gets a distinct marker color
- **Multi-Selection**: Hold Alt (or Cmd on Mac) and drag on the map to draw a selection box around multiple markers
- **In-Map Place Search**: Search for any location on the map using Google Places autocomplete (requires Places API New)
- **Geolocation Button**: Show the user's current location on the map with a single click
- **Nearby Records**: From any marker's info window or sidebar row, find other records within a configurable radius; a rectangle overlay shows the search area on the map
- **Record Actions**: Open, archive, duplicate, delete, or export selected records from the action menu
- **Google Maps Links**: Each marker info window includes direct links to open Google Maps navigation to that location and to view it on the Google Maps website
- **Street View from Marker**: A Street View button in each marker info window opens a side-by-side dialog showing a Google Map alongside street-level imagery for that location; falls back gracefully when no coverage is available
- **Embedded Map in Forms**: Embed a map inside a form view using the `google_map_one2many` or `google_map_many2many` field widget
- **Dark Mode Support**: Map styles and sidebar automatically adapt to Odoo's dark mode

## Dependencies

- `base_google_map`
- `web_widget_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure `base_google_map` is configured with a valid Google Maps API key in **Settings → General Settings → Google Maps**
3. Enable **Maps JavaScript API**, **Places API (New)**, and **Geocoding API** in your Google Cloud Console
4. Optionally configure the nearby search radius in **Settings → General Settings → Google Maps**

## Basic Usage

Add `google_map` to the `view_mode` of any action for a model that has latitude and longitude fields, then define a `<google_map>` view specifying the `lat`, `lng`, `sidebar_title`, and optionally `color` attributes. Records without valid coordinates are automatically excluded from the map.

## Related Modules

- `base_google_map`: Core API key configuration and Google Maps JavaScript API loader
- `web_widget_google_map`: Provides the Street View side-by-side dialog, the geolocation button component, and the in-map place search component consumed by this module
- `web_view_google_map_drawing`: Extends the map view with drawing tools (polygons, shapes, areas)
- `contacts_google_map`: Ready-made Google Maps view for the Contacts model
- `crm_google_map`: Ready-made Google Maps view for CRM leads and opportunities
