# Change Log

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
