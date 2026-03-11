# Contacts Google Maps

## Overview

This module adds a Google Maps view to the Contacts application, allowing you to visualize your contacts as markers on an interactive map. It extends the standard Contacts model with map-specific fields, a nearby contacts search, an embedded map on the contact form, and an automatic geocoding job.

## What It Does

Adds the `google_map` view type to Contacts so you can see all your contacts pinned on a Google Map alongside the standard list, kanban, and form views. Each contact appears as a color-coded pin with their avatar, and you can search for contacts near any given location directly from the map or from a contact's form.

## Key Features

- **Google Map View for Contacts**: Adds a Map view to Contacts accessible from the view switcher alongside list, kanban, and form
- **Contact Avatars**: Contact profile photos are shown in sidebar record rows and in marker info windows for quick identification
- **Marker Color Customization**: Each contact can have a custom marker color set via a color picker on the contact form
- **Nearby Contacts Search**: "Nearby Contacts" button on the contact form opens the map filtered to contacts within a configurable radius of that contact's location
- **Embedded Map in Contact Form**: The Geolocation page of the contact form shows an embedded map at the contact's coordinates
- **Automatic Geocoding Cron**: An optional scheduled job (inactive by default) automatically geocodes up to 500 contacts per day that have a country but no coordinates

## Dependencies

- `base_geolocalize`
- `contacts`
- `web_view_google_map`
- `web_widget_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure `base_google_map` is configured with a valid Google Maps API key in **Settings → General Settings → Google Maps**
3. Enable **Maps JavaScript API**, **Places API (New)**, **Maps Embed API**, and **Geocoding API** in your Google Cloud Console
4. Optionally activate the geocoding cron job in **Settings → Technical → Scheduled Actions → Auto Geolocalize Contacts**

## Basic Usage

1. Open **Contacts** and click the **Map** view button in the top-right view switcher
2. Your contacts with geolocation data appear as colored pin markers on the map
3. Click any marker or sidebar row to highlight the contact and view their details
4. Open a contact's form and click **Nearby Contacts** (shown when the contact has coordinates) to see other contacts nearby on the map

## Related Modules

- `base_google_map`: Core API key configuration and Google Maps JavaScript API loader
- `web_view_google_map`: Base Google Map view type (required)
- `web_widget_google_map`: Google Maps widgets (required)
- `contacts_google_map_extended`: Adds additional Google Places data fields to contacts

## Authors

- [Yopi Angi](https://www.github.com/gityopie)
