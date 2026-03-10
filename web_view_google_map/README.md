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
- **Nearby Records**: From any marker's info window, find other records within a configurable radius
- **Record Actions**: Open, archive, duplicate, delete, or export selected records from the action menu
- **Embedded Map in Forms**: Embed a map inside a form view using the `google_map_one2many` or `google_map_many2many` field widget
- **Dark Mode Support**: Map styles and sidebar automatically adapt to Odoo's dark mode

## Dependencies

- `base_google_map` (provides API key setup and loader)

## Installation

1. Install the module through Odoo Apps
1. Ensure `base_google_map` is configured with a valid Google Maps API key in **Settings → General Settings → Google Maps**
1. Enable **Maps JavaScript API**, **Places API (New)**, and **Geocoding API** in your Google Cloud Console
1. Optionally configure the nearby search radius in **Settings → General Settings → Google Maps**

## Basic Usage

Add `google_map` to the `view_mode` of any `ir.actions.act_window` for a model that has latitude and longitude fields, then define a `<google_map>` view:

```xml
<!-- View -->
<record id="view_res_partner_google_map" model="ir.ui.view">
    <field name="name">view.res.partner.google_map</field>
    <field name="model">res.partner</field>
    <field name="arch" type="xml">
        <google_map string="Contacts" lat="partner_latitude" lng="partner_longitude" sidebar_title="display_name" sidebar_subtitle="contact_address" color="marker_color">
            <field name="partner_latitude"/>
            <field name="partner_longitude"/>
            <field name="display_name"/>
            <field name="contact_address"/>
            <field name="marker_color"/>
        </google_map>
    </field>
</record>

<!-- Action -->
<record id="action_partner_map" model="ir.actions.act_window">
    <field name="name">Contacts (Map)</field>
    <field name="res_model">res.partner</field>
    <field name="view_mode">kanban,tree,form,google_map</field>
</record>
```

## Attributes Reference

- **Required**
  - `lat`: name of the latitude field
  - `lng`: name of the longitude field
  - `sidebar_title`: field to use as the record title in the sidebar (Char or Many2one)
- **Recommended**
  - `string`: header title shown at the top of the sidebar
  - `sidebar_subtitle`: secondary text under the title (Char or Many2one)
- **Visuals**
  - `color`: marker color. Accepts a hex (e.g., `#FF0000`), a CSS color name (e.g., `red`), or a field name (Integer) paired with `widget="color_picker"` in a form view.

    Examples:

    1. Fixed hex color or color name

    ```xml
    <google_map color="#FF0000">...</google_map>
    ```

    1. Color from a field

    ```xml
    <google_map color="marker_color">...</google_map>
    <!-- Make sure the field is paired with widget "color_picker" in form view -->
    <field name="marker_color" widget="color_picker"/>
    ```

- **Map behavior**
  - `map_type`: `roadmap` | `satellite` | `hybrid` | `terrain` (default: `roadmap`)
  - `gesture_handling`: `auto` | `cooperative` | `greedy` | `none` (default: `auto`)
  - `disable_cluster_marker`: set to `1` to disable marker clustering (enabled by default)

    ```xml
    <google_map disable_cluster_marker="1">...</google_map>
    ```

  - `map_id`: Map ID for a specific styled map; overrides the Map ID configured in settings
- **Data and limits**
  - `limit`: max records to load (default: `100`)
  - `count_limit`: show an approximate total above this count
  - `default_order`: default ordering, e.g., `"name desc"`
  - `default_group_by`: group records by a Many2one field (enables grouped sidebar)

## Embedding a Map in a Form View

You can embed a map inside a form view using `google_map_one2many` or `google_map_many2many` widget (commonly used with drawing or shapes modules):

```xml
<field name="shape_line_ids" widget="google_map_drawing_one2many" mode="google_map">
    <google_map js_class="google_map_drawing" sidebar_title="gshape_name" sidebar_subtitle="gshape_description" geojson="gshape_geojson" color="gshape_color" map_type="hybrid" gesture_handling="cooperative">
        <field name="partner_id"/>
        <field name="gshape_name"/>
        <field name="gshape_area"/>
        <field name="gshape_description"/>
        <field name="gshape_geojson"/>
        <field name="gshape_color"/>
    </google_map>
</field>
```

## Handling Multiple Markers at the Same Location

When multiple records share the exact same latitude and longitude, markers are slightly shifted apart to ensure visibility and interactivity. Clicking on a shifted marker will zoom in further to help users see the connection line to the actual location.

![Spread out markers](static/img/spread_out_markers.png)
![Spread out marker info](static/img/spread_out_marker_info.png)

## Related Modules

- `base_google_map`: Core API key configuration and Google Maps JavaScript API loader
- `web_view_google_map_drawing`: Extends the map view with drawing tools (polygons, shapes, areas)
- `contacts_google_map`: Ready-made Google Maps view for the Contacts model
- `crm_google_map`: Ready-made Google Maps view for CRM leads and opportunities

## Authors

- [Yopi Angi](https://www.github.com/gityopie)
