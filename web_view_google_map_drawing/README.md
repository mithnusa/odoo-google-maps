# Web View Google Map Drawing

## Overview

This module extends the Google Map view with geographic shape drawing capabilities. Users can draw, edit, and store geospatial shapes directly on a Google Map inside Odoo, with automatic switching between an editable mode and a GPU-accelerated viewer based on data complexity.

Google's built-in Maps Drawing Library was deprecated in August 2025. This module uses [Terra Draw](https://terradraw.io/) as a replacement — the same alternative recommended by Google. For large or complex datasets that exceed Terra Draw's editing limits, [Deck.gl](https://deck.gl/) takes over as a GPU-accelerated read-only renderer. Geospatial measurements are handled by [Turf.js](https://turfjs.org/). All three libraries are bundled locally so the module works without external CDN dependencies.

## What It Does

Adds a `google_map_drawing` view variant and a `google_map_terra_draw` form widget. The drawing view displays records with stored GeoJSON shapes as an interactive map layer. The form widget embeds a full drawing canvas inside any record form, letting users create and edit shapes with live area measurement.

## Key Features

- **Drawing Tools**: Seven interactive drawing modes — Point, LineString, Polygon, Rectangle, Circle, Freehand, and Select — with keyboard shortcuts for every action
- **GeoJSON Storage**: Drawn shapes are stored as GeoJSON in an Odoo field using a custom field type that supports geographic filter operators for server-side queries
- **Drawing Shape Mixin**: A reusable base model (`google.drawing.shape`) that adds shape name, GeoJSON, area, and color fields to any model with a single inheritance declaration
- **Smart Rendering**: Automatically switches between Terra Draw (fully editable) and Deck.gl (GPU-accelerated, read-only viewer) based on geometry complexity and dataset size
- **Real-Time Measurements**: Area and perimeter are calculated and displayed live as shapes are drawn, in metric or imperial units
- **Import/Export GeoJSON**: Upload `.geojson` files created in external GIS tools and download current shapes as a clean GeoJSON file
- **Geometry Simplification**: Reduce vertex count on complex imported shapes to bring them within editing limits while preserving the overall form
- **Undo/Redo**: Full drawing history managed per session
- **Embedded Drawing Widget**: Embed the drawing canvas inside form views on One2many or Many2many fields using dedicated widgets

## Dependencies

- `web_view_google_map`

## Installation

1. Install the module through Odoo Apps
2. Ensure `web_view_google_map` is installed and configured with a valid Google Maps API key

## Basic Usage

Apply `js_class="google_map_drawing"` to a `<google_map>` view definition and set the `geojson` attribute to point to the GeoJSON field on the model. To embed drawing in a form view, apply the `google_map_terra_draw` widget to a JSON field.

## Related Modules

- `web_view_google_map`: Provides the base Google Map view type that this module extends
