# Change Log

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
