# Project Google Map

## Overview

This module adds map-based site drawing to Odoo's Project application. Instead of a single pin, each project and task can have its own area — a shape drawn directly on a satellite map — marking exactly where the work takes place. Areas are shown on dedicated map views for both Projects and Tasks, with the area size calculated automatically.

## What It Does

Extends the standard Project app so that projects and tasks can each have a site area drawn on a map, rather than just a text address. A project's area is color-coded by its health status. A task's area is drawn with the parent project's boundary shown underneath as a reference guide, so you always know where the task sits relative to the project.

## Key Features

### Projects

- **Map View ("Project Sites")**: Adds a "Map" view to the Projects list, showing each project's drawn area
- **Status-Colored Areas**: A project's area is automatically color-coded by its health status — green (on track), orange (at risk), red (off track), cyan (on hold), purple (done), gray (no status)
- **Draw Project Area**: The project form's Site tab lets you draw the project's boundary directly on a satellite map, with the area (m²) calculated and displayed automatically
- **Quick Task Access**: A "View Tasks" button on the map marker and sidebar opens the task list for that project

### Tasks

- **Map View ("Task Sites")**: Adds a "Map" view to the task list within a project, showing each task's drawn area alongside its project's boundary
- **Draw Task Area with Project Reference**: The task form's Site Information tab lets you draw the task's own area. The parent project's boundary is shown underneath as a dotted, reference-only outline — it is never editable, so you can see exactly where the project's area is while placing the task's shape on top of or around it
- **Auto-Focus on Project Area**: If a task doesn't have an area drawn yet, the map automatically centers on the project's boundary instead of a default world view, so you immediately see where to draw
- **Custom Area Color**: Each task's area can be given its own color using a color picker

## Dependencies

- `project`
- `web_view_google_map_drawing`

## Installation

1. Install the module through Odoo Apps
2. Ensure a Google API Key is configured in Settings → General Settings → Google Maps

## Basic Usage

### For Projects

1. Open a project and go to the **Site** tab
2. Draw the project's area on the map — the area (m²) is calculated automatically as you draw
3. From the Projects list, switch to the **Map** view to see all project areas, color-coded by status
4. Click a project's area to view details and use the "View Tasks" button

### For Tasks

1. Open a task and go to the **Extra Info → Site** tab
2. The parent project's boundary appears as a dotted outline for reference; if the task has no area yet, the map centers on it automatically
3. Draw the task's own area on the map, optionally choosing a custom color
4. From a project's task list, switch to the **Map** view to see all task areas together with their project's boundary

## Related Modules

- `web_view_google_map_drawing`: Provides the map drawing view type and drawing widget used by this module
- `base_google_map`: Core module that manages the Google API Key configuration
