# Project Google Map

## Overview

This module adds a Google Maps view to Odoo's Project application. It lets you assign a physical site location to each project and view all projects as markers on an interactive map, with colors that reflect each project's current status.

## What It Does

Extends the standard Project app with site location support. Each project can be linked to a site address, and those projects can then be viewed on a Google Map. Marker colors automatically reflect the project's health status, giving a quick visual overview of your project portfolio across locations.

## Key Features

- **Map View for Projects**: Adds a "Map" view to the Projects list, showing each project as a marker at its site location
- **Status-Colored Markers**: Markers are color-coded by project status — green (on track), orange (at risk), red (off track), cyan (on hold), and purple (done)
- **Site Address Field**: Adds a "Site" tab to the project form for linking the project to a site address
- **Embedded Map in Form**: The project form displays a satellite map of the site location directly on the Site tab
- **Site Partner Type**: Introduces a "Site" type for partners, with a dedicated icon, to keep site addresses organized separately from regular contacts

## Dependencies

- `project`
- `web_view_google_map`
- `web_widget_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure a Google API Key is configured in Settings → General Settings → Google Maps

## Basic Usage

1. Open a project and go to the **Site** tab
2. The embedded map on the same tab shows the selected location
3. From the Projects list, switch to the **Map** view to see all projects on a map

## Related Modules

- `web_view_google_map`: Provides the Google Map view type used by this module
- `base_google_map`: Core module that manages the Google API Key configuration
- `web_widget_google_map`: Provides the Google Map widget used in the project form
