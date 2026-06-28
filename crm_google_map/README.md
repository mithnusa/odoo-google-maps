# CRM Google Maps

## Overview

This module adds a Google Maps view to the CRM application, letting you visualize your leads and opportunities as markers on an interactive map. It extends the standard CRM views with map-specific fields, custom CRM markers, and geolocation tools on the lead form.

## What It Does

Adds the `google_map` view type to the Leads, Opportunities, My Activities, Pipeline, and Forecast menus in CRM. Each lead or opportunity appears as a color-coded marker showing key deal information directly on the map. The lead form also gains a Geolocation tab with an embedded map preview and tools to set or compute coordinates.

## Key Features

- **Google Map View**: Adds a Map view to Leads, Opportunities, My Activities, Pipeline, and Forecast menus, alongside the existing list, kanban, and calendar views
- **CRM Marker Cards**: Each marker displays the lead name, stage, address, company, contact, phone, salesperson, expected revenue, probability, and expected closing date — visible directly on the map without opening the record
- **Activity Scheduling from Map**: Each lead's info window includes buttons to schedule a new activity or view a list of existing scheduled activities, all without leaving the map view
- **Marker Color Customization**: Each lead has a configurable marker color, set via a color picker on the lead form's Geolocation tab
- **Overlap Handling**: When multiple leads share the same address, markers are slightly offset so each remains individually clickable; an indicator icon flags shifted markers
- **Sidebar with CRM Details**: The map sidebar lists all leads in the current view with their expected revenue and pipeline stage shown beneath each entry
- **Automatic Geolocation from Partner**: When a contact is linked to a lead, the lead's latitude and longitude are automatically set from the partner's stored coordinates
- **Geocode from Address**: A button on the Geolocation tab computes coordinates from the lead's address fields using Odoo's geocoding service
- **Geolocation Tab**: Adds a dedicated tab to the lead form showing coordinates, a geocode button, a marker color picker, and an embedded map preview of the lead's location

## Dependencies

- `crm`
- `web_view_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure a valid Google Maps API Key is configured in Settings → General Settings → Google Maps
3. Enable the Maps JavaScript API and Geocoding API in your Google Cloud Console

## Basic Usage

1. Open **CRM → Leads** or **CRM → Opportunities** and click the **Map** view button
2. Leads with geolocation data appear as colored marker cards on the map
3. Click any marker to highlight it and view the deal summary
4. Open a lead's form and go to the **Geolocation** tab to set or compute coordinates and choose a marker color

## Related Modules

- `web_view_google_map`: Provides the core Google Map view type
- `crm_google_map_add_place`: Adds click-to-create leads directly from the map
- `crm_google_autocomplete`: Adds Google Places autocomplete to the Lead form
