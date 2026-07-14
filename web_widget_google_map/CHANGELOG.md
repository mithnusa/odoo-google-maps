# Change Log

## 19.0.1.0.10

### Fixed

- **`google_map.xml` — Button icon width shift between readonly/edit states**: Added `fa-fw` to the button icon so `fa-map-o` (readonly) and `fa-map-pin` (edit) render at a fixed, equal width instead of shifting the button/label width when the icon glyph changes.

## 19.0.1.0.9

### Fixed

- **`GoogleMapStreetViewSideBySideDialog._cleanup()` — wrong marker detach API**: `_locationMarker.map = null` (the `AdvancedMarkerElement` shorthand) replaced with `_locationMarker.setMap(null)`, which is the correct `OverlayView` API now that the fallback pin is a custom overlay rather than an `AdvancedMarkerElement`.
- **`GoogleMapStreetViewSideBySideDialog._cleanup()` — SDK default panorama left alive**: When Street View is unavailable the user can still drag pegman onto the left map, causing the Maps SDK to lazily create its own default panorama. Added explicit fetch and disposal (`setVisible(false)`, `clearInstanceListeners`, `unbindAll`) of that default panorama in the `_cleanup` no-panorama branch.
- **`GoogleMapStreetViewSideBySideDialog._cleanup()` — DOM clear interrupting active WebGL render**: The synchronous `.innerHTML = ''` on the map and Street View containers could run mid-render and corrupt the WebGL context. Deferred to `requestAnimationFrame` so the DOM teardown never interrupts an active paint. The synchronous teardown (`unbindAll`, `clearInstanceListeners`, nulling refs) still runs immediately to stop tile fetching.

### Changed

- **`GoogleMapStreetViewSideBySideDialog` — removed `mapId` from `Map` constructor**: The dialog's left-panel map is now intentionally plain/raster (no vector rendering). A vector map that shared a `mapId` with other maps on the page was causing the parent view's map to go blank after the dialog closed due to exhausting the browser's shared WebGL context limit. Removing `mapId` avoids that shared context entirely.
- **`GoogleMapStreetViewSideBySideDialog` — `AdvancedMarkerElement` → `LocationPinOverlay`**: When Street View is unavailable, the location pin is now rendered via a lazily-built `OverlayView` subclass (`LocationPinOverlay`) instead of `AdvancedMarkerElement`. `AdvancedMarkerElement` requires a `mapId` which this dialog's map no longer sets; `OverlayView` works on any map type.
- **`google_map.js` — `GoogleMapWidget.setup()` JSDoc**: Removed stale `state.isMapVisible` / collapsible-toggle / static-image description left over from the previous two-button design; replaced with an accurate one-liner.

### Improved

- **Manifest — summary and description**: Updated to reflect the single-button widget design; removed all references to the Maps Static API and the collapsible image preview.

## 19.0.1.0.8

### Changed

- **`GoogleMapWidget` — Simplified to a single button**: Removed the static map image and the two-button layout (toggle + edit). The widget now renders a single contextual button — "View on Map" in readonly mode, "Update on Map" in edit mode — that opens `GeolocationEditDialog` directly. This eliminates the extra click, the Static Maps API call on each form load, and the cross-origin `<iframe>`/`SecurityError` issue that motivated the previous approach.

### Fixed

- **`GeolocationEditDialog._handleMarkerDragend` — Corrupted coordinates after drag**: `AdvancedMarkerElement.position` after a drag returns a `google.maps.LatLng` object where `.lat` and `.lng` are methods, not plain numbers. Fixed with a `typeof` guard: `typeof position.lat === 'function' ? position.lat() : position.lat`.
- **`GeolocationEditDialog._cleanupListeners` — Hung `tilesloaded` promise on fast close**: Added `_resolveTilesLoaded` — the `resolve` function of the `tilesloaded` Promise is stored on the instance and called in `_cleanupListeners` so the awaited promise is always settled even when the dialog is closed before tiles finish loading.

### Improved

- **`GeolocationEditDialog` — Map UI controls**: The dialog map now uses `disableDefaultUI: true` with explicit `zoomControl`, `streetViewControl`, `fullscreenControl`, and `mapTypeControl` re-enabled, and `gestureHandling: 'greedy'` so panning works inside the modal without the two-finger scroll requirement.
- **`GeolocationEditDialog` — Unmount safety guards**: `_tilesLoadedListener` (stored Maps event handle) and `_isUnmounted` flag are checked at every async continuation point (`importLibrary`, `tilesloaded` resolve, `idle` callback). `clearInstanceListeners` is called on the map instance in `_cleanupListeners` to cancel all remaining Maps SDK internal events on dialog close.

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
