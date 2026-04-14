# Base Google Map

## Overview

`base_google_map` is the foundation module for Google Maps integration in Odoo. It centralizes API key configuration, provides the Google Maps JavaScript API loader, and supplies base components used by all other Google Maps modules in this suite.

## What It Does

Adds a Google Maps configuration section to Odoo's General Settings where administrators manage the API key and all map-related options. Other modules in this suite depend on this module to load the Google Maps API consistently and inherit its settings.

## Key Features

- **API Key Configuration**: Store your Google Maps API key centrally in Settings → General Settings → Google Maps
- **Map ID Configuration**: Store a Google Cloud Map ID for advanced map features (visible only when `web_view_google_map` is installed)
- **Multi-Language Support**: Choose from 84 language options including regional variants (e.g., Chinese Simplified/Traditional, English AU/GB, Portuguese BR/PT); visible only when `web_view_google_map` is installed
- **Region Localization**: Set a region code to comply with local Google Maps display requirements
- **Color Scheme Control**: Display maps in Light, Dark, or System (auto) color scheme; visible only when `web_view_google_map` is installed
- **Autocomplete Language Restriction**: Optionally restrict place autocomplete results to the configured map language
- **Country Restriction for Autocomplete**: Limit autocomplete suggestions to up to 5 countries
- **In-Map Place Search**: Toggle Google Places search functionality within map views; visible only when `web_view_google_map` is installed
- **Base Map Component**: Shared OWL component providing consistent map rendering, error handling, offline detection, and accessibility support for all map views
- **MarkerClusterer**: Bundled marker clustering library for efficiently displaying large numbers of map markers

## Dependencies

- `web`
- `base_geolocalize`

## Installation

1. Install the module through Odoo Apps
2. Go to **Settings → General Settings → Google Maps**
3. Enter your Google Maps API Key and save
4. Optionally configure Map ID, language, region, color scheme, and autocomplete restrictions

### Required Google Cloud APIs

Enable these APIs in your Google Cloud Console:

- Maps JavaScript API (required)
- Places API (New) (required for in-map place search and autocomplete)
- Geocoding API (required for address geocoding features)

## Basic Usage

After installation and configuration, all other `*_google_map` modules automatically use the settings configured here. No additional setup is needed per module — install a dependent module and it will inherit the API key and options from this module.

## Related Modules

- `web_view_google_map`: Adds a Google Map view type to display Odoo records on an interactive map
- `web_widget_google_map`: Provides Google Maps autocomplete widgets for address and place fields
- `base_google_places`: Abstract model for Google Places data storage and API integration
