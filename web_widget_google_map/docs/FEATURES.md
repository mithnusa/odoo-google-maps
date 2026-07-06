# Web Widget Google Maps - Features

## Widget Button

### Single Map Button

**What it does**: Renders a single button on the form view that opens the interactive map dialog in one click.

**Why it matters**: Eliminates the extra toggle step — users get directly to the map without first revealing a preview image.

**How it works**: The button label and icon adapt to the context: "View on Map" (read-only) or "Update on Map" (edit mode). Clicking always opens `GeolocationEditDialog` centred on the record's current coordinates.

---

### Read-Only Mode

**What it does**: In read-only contexts the dialog opens in view-only mode — the marker is fixed, the Save button is hidden, and only the "Open in Google Maps" link is active.

**Why it matters**: Ensures the map is visible for reference in read-only contexts (portal views, locked records) without exposing editing controls.

**How it works**: The widget passes `readonly: true` to the dialog, which disables `gmpDraggable` on the marker and hides the footer Save/Cancel buttons.

---

## Edit Dialog

### Interactive Edit Dialog

**What it does**: Opens a full-screen Google Map dialog for viewing or updating the record's coordinates.

**Why it matters**: Provides a proper interactive map experience — panning, zooming, place search, and marker drag — before any values are written to the record.

**How it works**: `GeolocationEditDialog` initialises a Google Maps JavaScript API instance at the current coordinates (zoom 17 if coordinates are set, zoom 3 if unset). A Save button writes the confirmed coordinates to the record's latitude and longitude fields via `record.update()`; Cancel discards any changes.

---

### Draggable Marker

**What it does**: Displays a draggable marker in the edit dialog that the user can move to any position on the map to select new coordinates.

**Why it matters**: Allows precise visual placement of a location rather than requiring manual entry of latitude and longitude values.

**How it works**: An `AdvancedMarkerElement` is placed at the current coordinates with `gmpDraggable: true`. On drag end, the marker's new position is stored locally. When the user clicks Save, these coordinates are written to the record. In read-only mode, `gmpDraggable` is false and the marker is fixed.

---

### Place Search in Edit Dialog

**What it does**: A Google Places search box inside the edit dialog lets users navigate the map to a named location or address before setting the marker.

**Why it matters**: Finding a precise location by name is faster than manually panning the map, especially for new or unfamiliar addresses.

**How it works**: The dialog includes the `GoogleMapSearchPlaces` component. Selecting a result from the autocomplete pans the map to that location, after which the user can fine-tune the marker position by dragging before saving.

---

### Open in Google Maps

**What it does**: A link in the dialog footer opens the current marker coordinates directly in the Google Maps website in a new tab.

**Why it matters**: Lets users cross-check the location or get directions without leaving Odoo.

**How it works**: The link is always visible in the dialog footer (both readonly and edit mode) and uses the stored local coordinates at the time of clicking.

---

## Shared Map Components

These components are bundled in this module and re-exported for use by `web_view_google_map`'s map view. They are not directly visible as form widget features but are part of the shared frontend foundation.

### Geolocation Button (`GoogleMapGeolocate`)

**What it does**: Adds a floating geolocation button to any Google Map instance. Clicking it shows the user's current position as a marker and zooms the map to that location.

**Why it matters**: Lets users instantly orient themselves relative to their map data — useful in field workflows where the user's physical location is the starting point for exploration.

**How it works**: The component injects a custom button into the map's `RIGHT_BOTTOM` control area. On click it calls the browser Geolocation API (`enableHighAccuracy: true`, 10 s timeout). On success an `AdvancedMarkerElement` is placed at the returned coordinates and an info window opens on click. Specific error codes (permission denied, position unavailable, timeout) map to distinct user-facing notifications. All DOM nodes and event listeners are cleaned up on unmount.

---

### Place Search (`GoogleMapSearchPlaces`)

**What it does**: Adds a Google Places autocomplete search box to any Google Map instance. Selecting a result pans the map to the location and shows a search-marker info window with the place name and address.

**Why it matters**: Lets users navigate a large map to any address or landmark by name, without panning manually or knowing the coordinates in advance.

**How it works**: The component renders a `PlaceAutocompleteElement` (Places API New) into the map's `TOP_RIGHT` control area once the map is ready. It respects language, region, and country-restriction settings from `base_google_map`. On selection a `fetchFields` call retrieves `displayName`, `formattedAddress`, and `location`; the map then pans to the result and places a marker with an info window. All listeners and DOM nodes are removed on unmount.

---

## Street View

### Street View Side-by-Side Dialog

**What it does**: Opens an XL dialog displaying a Google Map on the left panel and Google Street View on the right panel for the same coordinates.

**Why it matters**: Lets users visually verify a record's exact location using street-level imagery alongside the standard map, without leaving the form.

**How it works**: `GoogleMapStreetViewSideBySideDialog` checks Street View imagery coverage via `StreetViewService` before initialising the panorama. If coverage is confirmed the panorama is created and linked to the map. If no imagery is available the right panel is replaced by a styled placeholder and a marker is placed on the map to indicate the exact position.
