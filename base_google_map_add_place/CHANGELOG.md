# Change Log

## 19.0.1.0.5

### Added

- **Shift-key Guard**: Map clicks below zoom threshold are now silently ignored; clicks at or above the threshold require holding the Shift key — without it an info notification prompts the user (`"Hold Shift key and click to add a place."`) and the click is discarded, preventing accidental record creation during normal map navigation
- **`controlPosition` Getter**: New overridable getter returning `google.maps.ControlPosition.RIGHT_TOP`; subclasses can override it to place the indicator in a different corner without patching `_onMounted` or `_cleanup`
- **`_getGeocoder()` Singleton**: New private method that lazily creates and reuses a single `google.maps.Geocoder` instance (`this._geocoder`), avoiding a new object allocation on every reverse-geocode request

### Improved

- **`_handleMapClickableAddPlaceIndicator()` — Refactored**: Removed the `controls` array loop; now operates directly on `this._indicatorElement` (captured at mount). Replaced manual `contains()` + `add()`/`remove()` calls with `classList.toggle(cls, bool)` for idempotent class management
- **`_handleMapClick()` — Flattened Control Flow**: Replaced nested `if (zoomLevel >= ZOOM_THRESHOLD) { if (placeId) { … } else { … } }` with early-return guards for a flat, readable structure; error notification type changed from `'warning'` to `'error'`; error message for reverse-geocode failure updated to `"Failed to retrieve location information."`
- **`_getPlaceDetails()` — Direct Property Access**: Removed intermediate `place.toJSON()` call and destructuring; place properties (`addressComponents`, `displayName`, etc.) are now read directly from the `Place` instance; `location` is serialised via `.toJSON()` before the ORM call
- **`_getPlaceReverseGeocode()` — Uses Geocoder Singleton**: Replaced `new google.maps.Geocoder()` inline with `this._getGeocoder()`
- **`_cleanup()` — Uses `controlPosition` Getter**: Replaced hardcoded `google.maps.ControlPosition.RIGHT_TOP` with `this.controlPosition` so subclass overrides are respected at teardown

## 19.0.1.0.4

### Improved

- **Model-aware notifications** (`in_map_click_add_place.js`): Post-save notifications now include the model name — "Contact has been created successfully" instead of the generic "Record created/updated successfully". The `model_description` is now passed in the action context from both `action_in_map_google_place_create` and `action_in_map_google_place_from_reverse_geocode` (all form-open paths), and extracted by the JS component to build the notification message.
- **Python — Odoo 19 translations** (`google_map_add_place.py`): `_()` module-level import replaced with `self.env._()` calls throughout; removed unused `_` import.
- **Python — Black format** (`google_map_add_place.py`): Reformatted with Black (line length 79).
- **JS code style** (`in_map_click_add_place.js`): Trailing commas and destructuring formatting made consistent with Prettier.
- **XML format** (`in_map_click_add_place.xml`): Reformatted with self-closing tags and multi-line attribute layout.
- **`__manifest__.py`**: Removed explicit `installable`, `application`, and `auto_install` keys — these are Odoo defaults and were redundant.

## 1.0.3

### Improved

- **Manifest**: Rewrote summary and description; replaced wildcard asset glob with explicit file entries; removed empty `data` and `demo` keys
- **README**: Added `gplace_id` field to the Key Features list

## 1.0.2

- [Improved] **`is_from_google_maps` Context Flag**: Added `is_from_google_maps=True` to the action context in all three form-open paths in `GoogleMapAddPlaceMixin` — the existing-record open action, `action_in_map_google_place_create`, and `action_in_map_google_place_from_reverse_geocode` — so the quick-create form view and its field handlers can detect that the record was opened from the Google Maps click-to-create workflow

## 1.0.1 - 2026-04-11

- **Fix OWL lifecycle hook**: Replaced `onRendered` with `onMounted` in `InMapClickAddPlace` — the map click listener and RIGHT_TOP indicator control are now registered once after the initial mount instead of after every re-render, preventing duplicate listener registration

## 1.0.0 - Initial Release

- **Abstract Model Mixin**: Added `google_map.add_place.mixin` with `gplace_id` field and core click-to-create logic reusable across any Odoo model
- **Places API Integration**: `action_in_map_google_place_create` method fetches place name, address components, phone, website, and coordinates from the Google Places API (New) and returns a pre-populated quick-create form action
- **Reverse Geocoding**: `action_in_map_google_place_from_reverse_geocode` method maps Geocoding API results to Odoo partner fields and returns a pre-populated form action
- **Address Mapping**: `_mapping_address` resolves Google address components to Odoo fields (street, street2, city, zip, state_id, country_id) with country/state resolved to Odoo record IDs
- **ADR Microformat Parser**: `_parse_adr_format_address` extracts structured address components from the HTML adrFormatAddress field returned by the Places API
- **Formatted Address Parser**: `_parse_formatted_address` parses plain-text Geocoding API addresses with support for standard, short, and Russian/CIS formats and multi-country postal code patterns
- **Duplicate Detection**: Checks for an existing record with the same `gplace_id` before opening a create form; opens the existing record instead
- **InMapClickAddPlace Component**: OWL component that registers a map click listener and triggers the appropriate workflow (Places API or reverse geocode) when zoom ≥ 15
- **Visual Indicator**: Map control injected into the RIGHT_TOP corner that turns green and animates when the feature is active, with a tooltip explaining how to use it
- **Post-Save Reload**: Map view reloads automatically after saving, and shows a notification with an "Open" button linking to the saved record
