# Web View Google Map - Features

## Map View Type

**What it does**: Adds `google_map` as a selectable view type in Odoo, alongside list, kanban, form, and other standard views.

**Why it matters**: Allows any model that has latitude and longitude fields to be visualized spatially, making geographic patterns immediately visible without building custom dashboards.

**How it works**: Register the view in any `ir.actions.act_window` by adding `google_map` to the `view_mode` field, then define a `<google_map>` view with the required `lat`, `lng`, and `sidebar_title` attributes. Records without valid coordinates are automatically filtered out.

---

## Record Markers

**What it does**: Displays each record as a pin-style marker on the map, showing the record's first initial as a glyph inside the pin.

**Why it matters**: Makes individual records immediately identifiable on the map without opening them, while keeping the map uncluttered.

**How it works**: Each record is rendered using Google's `AdvancedMarkerElement` with a `PinElement` glyph. Marker color is driven by a configured field (Integer field with `color_picker` widget) or a fixed hex/CSS color value set in the view definition.

---

## Sidebar Panel

**What it does**: Displays a scrollable list of records beside the map. Clicking a record in the sidebar highlights its marker on the map; clicking a marker highlights its row in the sidebar.

**Why it matters**: Gives users two ways to navigate data simultaneously — spatially on the map and as a structured list — without switching views.

**How it works**: The sidebar is a collapsible panel on the right side of the map. It shows the `sidebar_title` and `sidebar_subtitle` fields for each record. Selecting a record in the sidebar pans and zooms the map to its marker.

---

## Marker Clustering

**What it does**: Groups nearby markers into a single cluster icon at low zoom levels, showing the count of records in the cluster.

**Why it matters**: Prevents the map from becoming unreadable when displaying large numbers of records spread across the same region.

**How it works**: Uses the MarkerClusterer library (bundled in `web_view_google_map`). As the user zooms in, clusters expand into individual markers. Clustering can be disabled per view using `disable_cluster_marker="1"` in the view definition.

---

## Overlapping Marker Handling

**What it does**: When multiple records share identical coordinates, their markers are slightly spread apart in a circular pattern so each one is individually clickable.

**Why it matters**: Stacked markers at the same location would be impossible to interact with individually without this spreading behavior.

**How it works**: The renderer detects coordinate collisions and applies a small offset (approximately 10 meters) to each marker in a group. Clicking a spread marker zooms the map further in and draws a line connecting the marker back to the actual coordinate.

---

## Grouping

**What it does**: Groups records by a Many2one field. The sidebar shows collapsible group headers, and each group's markers are rendered in a distinct color.

**Why it matters**: Allows users to visualize which records belong to the same category, territory, salesperson, or any other grouping field — directly on the map.

**How it works**: Enable grouping via the Odoo search bar's Group By options, or set a default with `default_group_by` in the view definition. Only a single level of grouping is supported. Each group is assigned a color from a palette of 20 distinct colors.

---

## Multi-Selection (Box Select)

**What it does**: Allows users to draw a rectangular selection box on the map by holding Alt (or Cmd on Mac) and dragging, selecting all markers within the box.

**Why it matters**: Makes bulk operations (archive, delete, export) on geographically clustered records fast and intuitive — no need to select records one by one from the sidebar.

**How it works**: Holding Alt/Cmd activates selection mode (indicated by a cursor change and instruction overlay). Dragging draws a visible selection rectangle. All markers whose coordinates fall within the rectangle are selected. Hold Shift while dragging to add to an existing selection.

---

## In-Map Place Search

**What it does**: Adds a search box inside the map (top area) that searches for any Google Places location and pans the map to the result, placing a distinctive orange marker at that location.

**Why it matters**: Lets users navigate the map to any address or landmark without leaving the view, making it easy to explore data in a specific area.

**How it works**: Uses Google's `PlaceAutocompleteElement` (Places API New). The search respects the language and country restriction settings configured in `base_google_map`. Requires the **Places API (New)** to be enabled in Google Cloud Console and the "Enable Google Places Search" toggle to be on in settings.

---

## Geolocation Button

**What it does**: Adds a button to the map that shows the user's current location as a marker and zooms the map to that location.

**Why it matters**: Helps field users quickly orient themselves on the map relative to their nearby records.

**How it works**: Clicking the button triggers the browser's Geolocation API. On success, an `AdvancedMarkerElement` is placed at the user's coordinates with an info window labelled "Your location". Requires browser location permission.

---

## Nearby Records Search

**What it does**: From any record's info window or sidebar row, a "Show nearby" button filters the view to display only records within a configurable radius of that record's location.

**Why it matters**: Enables proximity-based workflows — for example, finding all customers near a delivery location, or identifying leads in the same area as an existing client.

**How it works**: Clicking "Show nearby" computes a bounding box around the selected record's coordinates using the configured radius (default: 1000 meters, adjustable in **Settings → General Settings → Google Maps → Nearby Search Radius**). The view domain is updated to return only records within that bounding box, and a rectangle overlay is drawn on the map showing the exact search area. The view title updates to indicate the search context (e.g., "Nearby Contacts (within 1 km)").

---

## Record Actions

**What it does**: The action menu (cog icon) and control panel provide bulk operations on selected records: export, archive, unarchive, duplicate, and delete.

**Why it matters**: Allows users to act on geographically selected records without switching to a list view.

**How it works**: Actions apply to all currently selected records (those highlighted on the map and in the sidebar). Delete and archive actions include a confirmation step. Export uses Odoo's standard export dialog. Custom actions defined in the view's `<header>` block are also rendered in the control panel.

---

## Embedded Map in Form Views

**What it does**: Allows a Google Map view to be embedded inside a form view as a One2many or Many2many field widget.

**Why it matters**: Enables spatial visualization of related records directly on a parent record's form — for example, showing all delivery stops on a route form.

**How it works**: Use `widget="google_map_one2many"` or `widget="google_map_many2many"` on the field in the form view's arch XML, with `mode="google_map"` and a `<google_map>` child element defining the view configuration.

---

## Dark Mode Support

**What it does**: Automatically adapts map styles, sidebar colors, and UI elements to Odoo's dark mode.

**Why it matters**: Ensures the map view is comfortable to use in low-light environments and matches the rest of the Odoo interface when dark mode is active.

**How it works**: A separate dark mode stylesheet is loaded via Odoo's `web.dark_mode_assets_backend` asset bundle, overriding colors for the map container, sidebar, markers, and info windows.
