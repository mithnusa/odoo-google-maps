# Change Log

## 19.0.1.0.7

### Improved

- **`GoogleMapGeolocate` — Pre-flight Permission Check**: Added an early `navigator.permissions.query({ name: 'geolocation' })` check before calling `getCurrentPosition`; when `state === 'denied'` the component now shows an actionable notification immediately instead of waiting for the browser's silent error callback
- **`GoogleMapGeolocate` — `PERMISSION_DENIED` Error Message**: Updated the case-1 error message to match the new pre-flight wording: `"Location access is blocked. Click the lock icon in your browser address bar, allow location access, then try again."`
- **`geolocate.scss` — Button Spacing & Color**: Reduced `margin-bottom` from `8px` to `2px`; simplified padding to `6px`; removed explicit `opacity` and `cursor` overrides; added `color: #1a56c4` to match the blue geolocation icon style
- **`geolocate.xml` — Icon Class**: Removed `text-700` class from the `fa-location-arrow` icon, letting it inherit color from the button's CSS

## 19.0.1.0.6

### Added

- **Street View Side-by-Side Dialog**: New `GoogleMapStreetViewSideBySideDialog` component opens an XL dialog with a Google Map on the left and Google Street View on the right. Coverage is checked via `StreetViewService` before rendering — when no imagery is available the panel is replaced by a styled placeholder with an `AdvancedMarkerElement` on the map.
- **`GoogleMapGeolocate` component** (`components/geolocate/`): Browser geolocation button injected into a map's `RIGHT_BOTTOM` control area. On click, calls the Geolocation API (`enableHighAccuracy: true`, 10 s timeout), places an `AdvancedMarkerElement` at the user's position, and opens an info window on marker click. Error codes 1/2/3 (`PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, `TIMEOUT`) each produce a distinct notification. All DOM nodes and listeners are cleaned up in `onWillUnmount`.
- **`GoogleMapSearchPlaces` component** (`components/search_places/`): In-map Google Places autocomplete using `PlaceAutocompleteElement` (Places API New). Injected into the map's `TOP_RIGHT` control area after the first `idle` event; respects language, region, and country-restriction settings from `base_google_map`. Bounds are kept in sync with the map on `bounds_changed`. On selection, fetches `displayName`, `formattedAddress`, and `location` via `fetchFields`, pans the map, and places an orange search marker with an info window. All listeners and control nodes are removed in `onWillUnmount`. Moved here from `web_view_google_map` and also used by `GeolocationEditDialog`.

### Improved

- **i18n placeholders**: Replaced `sprintf(_t('…%s'), val)` with the named-placeholder form `_t('…%(key)s', { key: val })` in all error notifications, aligning with Odoo 16+ translation best practices. Removed unused `sprintf` import.
- **Console noise**: Reduced console logging in Google Maps error handlers; errors are also surfaced through the Odoo notification service.

### Changed

- **Dependencies**: Removed `web_view_google_map` from module dependencies; the module now depends solely on `base_google_map`.
- **`GoogleMapSearchPlaces` import** (`google_map.js`): Updated import path from `@web_view_google_map/…` to the local `components/search_places/` path now that the component lives in this module.

## 19.0.1.0.5

### Improved

- **Manifest**: Rewrote summary and description; replaced wildcard asset glob with explicit ordered file entries; removed empty `data` and `demo` keys
- **i18n**: Regenerated POT — updated dates; replaced stale `ir.ui.view` model field entries with actual JS translatable strings (`"Drag the marker to update the location"`, `"Failed to initialize Google Map.\n%s"`, `"Failed to load Google Maps API.\n%s"`, `"Save"`)

## 19.0.1.0.4

### Improved

- **Default Zoom Level**: Reduced the default zoom level from 16 to 14 to provide better spatial context when the map widget is first rendered.
- **Iframe Lazy Loading**: Added `loading="lazy"` to the embedded Google Maps iframe so it defers loading until the widget enters the viewport, improving page load performance.

### Fixed

- **Edit Button Visibility**: The "Edit" button is now fully hidden (removed from the DOM) when the field is in readonly mode, instead of being rendered as a disabled button.

## 19.0.1.0.3

### Added

- **Place Search in Geolocation Dialog**: The geolocation edit dialog (the interactive map opened when editing latitude/longitude on a form view) now includes the in-map place search component. Users can search for a location directly inside the dialog and the map pans to the result.

### Fixed

- **URL Construction**: `generateSrc()` now uses the `URL` class to build the Google Maps Embed URL, ensuring query parameters are always correctly encoded.

### Dependencies

- Added `web_view_google_map` as a module dependency to support the place search integration.

## 19.0.1.0.2
Fixed bug where updating (clicking the "edit" button below Google Maps view in form view) a record's geolocation in form view opened in a pop-up window caused an error.

## 19.0.1.0.1
Migration to version 19.0

In version 19.0, Odoo introduced a new module `google_address_autocomplete` that provides similar functionality.
The implementation in the new module `web_widget_google_place_autocomplete` offer similar functionality and give full control to users to configured the mapping between Google Places fields and Odoo fields through a new model `google.places.mapping` that can be accessed from Settings > Technical > Google Maps > Google Places Field Mapping.
