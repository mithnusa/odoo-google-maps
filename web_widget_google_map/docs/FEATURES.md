# Web Widget Google Maps - Features

## Embedded Map Preview

### Map Display in Form View
**What it does**: Renders a Google Maps iframe at the record's current coordinates directly inside a form view.

**Why it matters**: Gives users an immediate spatial view of a record's location without leaving the form or opening a separate map view.

**How it works**: The widget uses the Google Maps Embed API to generate an iframe pointing to the stored latitude and longitude. When coordinates are 0,0 (unset), the map defaults to a world-level zoom. Configurable attributes control the display: `zoom` (default: 14), `maptype` (`roadmap` or `satellite`, default: `roadmap`), `width` (default: 400), and `height` (default: 200).

---

### Read-Only Display Mode
**What it does**: Shows the embedded map without an edit button when the form field is in read-only mode.

**Why it matters**: Ensures the map is visible for reference in read-only contexts (e.g. portal views, locked records) without exposing editing controls.

**How it works**: The widget checks `props.readonly`; when true, the edit button is hidden and no dialog can be opened.

---

## Edit Dialog

### Interactive Edit Dialog
**What it does**: An edit button on the widget opens a dialog containing a full interactive Google Map for updating the record's coordinates.

**Why it matters**: The embedded iframe is not interactive — the dialog provides a proper map experience for precise location selection before writing any changes to the record.

**How it works**: Clicking the edit button opens a `GeolocationEditDialog`. The dialog initializes a Google Maps JavaScript API instance at the current coordinates (zoom 16 if coordinates are set, zoom 3 if unset). A save button writes the confirmed coordinates to the record's latitude and longitude fields; cancel discards any changes.

---

### Draggable Marker
**What it does**: Displays a draggable marker in the edit dialog that the user can move to any position on the map to select new coordinates.

**Why it matters**: Allows precise visual placement of a location rather than requiring manual entry of latitude and longitude values.

**How it works**: An `AdvancedMarkerElement` is placed at the current coordinates with `gmpDraggable: true`. On drag end, the marker's new position is stored locally. When the user clicks Save, these coordinates are written to the record via `record.update()`. In read-only mode, `gmpDraggable` is false and the marker is fixed.

---

### Place Search in Edit Dialog
**What it does**: A Google Places search box inside the edit dialog lets users navigate the map to a named location or address before setting the marker.

**Why it matters**: Finding a precise location by name is faster than manually panning the map, especially for new or unfamiliar addresses.

**How it works**: The dialog reuses the `GoogleMapSearchPlaces` component. Selecting a result from the autocomplete pans the map to that location, after which the user can fine-tune the marker position by dragging before saving.

---

## Street View

### Street View Side-by-Side Dialog

**What it does**: Opens an XL dialog displaying a Google Map on the left panel and Google Street View on the right panel for the same coordinates.

**Why it matters**: Lets users visually verify a record's exact location using street-level imagery alongside the standard map, without leaving the form.

**How it works**: `GoogleMapStreetViewSideBySideDialog` loads the `maps`, `streetView`, and `marker` libraries in parallel. Before initialising the panorama it calls `StreetViewService.getPanorama()` to check imagery coverage within 50 metres of the coordinates. If coverage is confirmed (`StreetViewStatus.OK`) the panorama is created and linked to the map via `map.setStreetView()`. If no imagery is available the right panel is replaced by a styled placeholder and an `AdvancedMarkerElement` is placed on the map to indicate the exact position. Configurable `heading`, `pitch`, and `zoom` props control the initial Street View point-of-view.
