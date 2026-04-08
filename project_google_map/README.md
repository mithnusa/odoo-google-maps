# Project Google Map

## Overview

This module adds Google Maps views to Odoo's Project application. It lets you assign physical site locations to both projects and tasks, then view them as markers on interactive maps. Project markers are automatically color-coded by health status, giving a quick visual overview of your portfolio across locations.

## What It Does

Extends the standard Project app with site location support for both projects and tasks. Projects and tasks can each be linked to a site address and viewed on a Google Map. Project markers change color automatically based on project status, while task markers can be customized with individual colors.

## Key Features

### Projects

- **Map View**: Adds a "Map" view to the Projects list showing each project as a marker at its site location
- **Status-Colored Markers**: Markers are automatically color-coded by project health status — green (on track), orange (at risk), red (off track), cyan (on hold), purple (done)
- **Site Address Field**: Adds a "Site" tab to the project form for linking a site address to the project
- **Embedded Map**: The project form's Site tab displays a satellite map of the selected site location
- **Quick Task Access**: A "View Tasks" button in the map marker and sidebar opens the task list for that project

### Tasks

- **Map View**: Adds a "Map" view to the task list within a project, showing tasks by their site locations
- **Custom Marker Color**: Each task can have an individually set marker color using a color picker
- **Site Information**: Task form includes a site address field, coordinates display, and embedded satellite map under Extra Info → Site Information

### General

- **Site Partner Type**: Introduces a "Site" partner type with a dedicated icon, keeping site addresses organized separately from regular contacts

## Dependencies

- `project`
- `web_view_google_map`
- `web_widget_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure a Google API Key is configured in Settings → General Settings → Google Maps

## Basic Usage

### For Projects

1. Open a project and go to the **Site** tab
2. Select a site address (you can create a new "Site" type partner)
3. The embedded satellite map on the same tab shows the selected location
4. From the Projects list, switch to the **Map** view to see all projects on a map
5. Click a project marker to view details and use the "View Tasks" button

### For Tasks

1. Open a task and go to the **Extra Info** tab
2. Under "Site Information", select a site address for the task
3. Optionally set a custom marker color using the color picker
4. From a project's task list, switch to the **Map** view to see all tasks on a map

## Related Modules

- `web_view_google_map`: Provides the Google Map view type used by this module
- `base_google_map`: Core module that manages the Google API Key configuration
- `web_widget_google_map`: Provides the embedded Google Map widget used in project and task forms
