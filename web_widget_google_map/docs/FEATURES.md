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

## Shared Map Components

These components are bundled in this module and re-exported for use by `web_view_google_map`'s map view. They are not directly visible as form widget features but are part of the shared frontend foundation.

### Geolocation Button (`GoogleMapGeolocate`)

**What it does**: Adds a floating geolocation button to any Google Map instance. Clicking it shows the user's current position as a custom marker and zooms the map to that location.

**Why it matters**: Lets users instantly orient themselves relative to their map data — useful in field workflows where the user's physical location is the starting point for exploration.

**How it works**: The component injects a custom button into the map's `RIGHT_BOTTOM` control area via `google.maps.controls`. On click it calls the browser Geolocation API (`enableHighAccuracy: true`, 10 s timeout). On success an `AdvancedMarkerElement` with an SVG pin is placed at the returned coordinates and an info window labelled "Your location" opens on click. Specific `GeolocationPositionError` codes (permission denied, position unavailable, timeout) map to distinct user-facing notification messages. The button DOM element and all event listeners are cleaned up in `onWillUnmount`.

---

### Place Search (`GoogleMapSearchPlaces`)

**What it does**: Adds a Google Places autocomplete search box to any Google Map instance. Selecting a result pans the map to the location and shows a search-marker info window with the place name and address.

**Why it matters**: Lets users navigate a large map to any address or landmark by name, without panning manually or knowing the coordinates in advance.

**How it works**: The component renders a `<gmp-place-autocomplete>` element (`PlaceAutocompleteElement`, Places API New) into the map's `TOP_RIGHT` control area once the map fires its first `idle` event. It respects `restrict_language`, `autocomplete_restrict_country`, and `region` settings from `base_google_map`. The current map bounds are passed as `locationRestriction` and updated on every `bounds_changed` event. On selection a `fetchFields` call retrieves `displayName`, `formattedAddress`, and `location`; the map then pans (or fits the viewport) and an orange pin marker with an info window is placed at the result. All listeners and DOM nodes are removed in `onWillUnmount`.

---

## Street View

### Street View Side-by-Side Dialog

**What it does**: Opens an XL dialog displaying a Google Map on the left panel and Google Street View on the right panel for the same coordinates.

**Why it matters**: Lets users visually verify a record's exact location using street-level imagery alongside the standard map, without leaving the form.

**How it works**: `GoogleMapStreetViewSideBySideDialog` loads the `maps` and `marker` libraries in parallel (Street View classes are part of `maps`). Before initialising the panorama it calls `StreetViewService.getPanorama()` to check imagery coverage within 50 metres of the coordinates. If coverage is confirmed (`StreetViewStatus.OK`) the panorama is created and linked to the map via `map.setStreetView()`. If no imagery is available the right panel is replaced by a styled placeholder and an `AdvancedMarkerElement` is placed on the map to indicate the exact position. Configurable `heading`, `pitch`, and `zoom` props control the initial Street View point-of-view.
