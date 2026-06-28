# Change Log

## 19.0.1.0.9

### Added

- **Configuration validation warnings**: Two new computed fields on `google.places.mapping` — `is_address_component_missing` (warns when `addressComponents` is absent from the fetch fields while address mapping lines exist) and `is_location_field_missing` (warns when `location` is absent from fetch fields while `latitude`/`longitude` fields are configured). Shown as inline alerts on the mapping form.
- **`models/utils.py`**: New utility module with `safe_literal_eval` (replaces bare `ast.literal_eval` — validates against an expected type and raises descriptive errors) and `validate_component_list` (validates that a fetch-fields value is a list of non-empty strings). Used throughout `google_places_mapping.py` and covered by `test_utils.py`.
- **Test suite** (`tests/`): Three new test files — `test_mapping_constraints.py` (address-line component validation, handling-mode rules, unique constraints), `test_parse_place.py` (`adjust_address_components`, `build_component_lookup`, `parse_geolocation`, `parse_place` end-to-end), `test_utils.py` (`safe_literal_eval` type checking, error handling).

### Improved

- **Mapping form** (`views/google_places_mapping_views.xml`):
  - "Archived" ribbon on the form header.
  - `code` field now uses `CopyClipboardChar` widget for one-click copying.
  - Inline links to Google documentation next to `gplace_options`, fetch-fields, and address-type fields.
  - `handling_mode`, `separator`, and `text_option` columns added to the address-line list (optional columns).
  - Note added below address mapping explaining that `route`/`street_number` ordering is driven by the country's Street Format setting, with a direct link to the Countries list.
  - `latitude` and `longitude` fields now displayed in a labelled group in the form view.
  - Test widget (`GoogleMappingTest`) now shows a reminder to reload the page after saving changes.
- **Mapping list view**: Added `sequence` drag handle, `mode`, `description`, and `active` toggle columns; new filters for Address mode, Places mode, and Archived records.
- **`GooglePlaceAutocompleteElement`**: Mode label now shown above the autocomplete input — "Search Google Place" in `places` mode, "Search Google Address" in `address` mode.
- **Mapping validation** (`@api.constrains`): `gplace_place_fetch_fields` and `gplace_address_fetch_fields` now validated using `validate_component_list`; duplicate-field detection across address and other mapping lines.
- **Python — Odoo 19 translations** (`google_places_mapping.py`, line models): `_()` module-level import replaced with `self.env._()` calls; removed unused `_` and `ast` imports.
- **Python — Black format** (all model files): Reformatted with Black (line length 79).
- **`__manifest__.py`**: Removed explicit `installable`, `application`, and `auto_install` keys — these are Odoo defaults and were redundant.

## 19.0.1.0.8

### Improved

- **Manifest**: Rewrote summary and description; replaced wildcard asset globs with explicit ordered file entries; removed empty `demo` key
- **`google.places.mapping` — Field Labels**: Renamed both ambiguous `'Fetch Fields'` string labels to `'Google Fields for Place Mode'` and `'Google Fields for Address Mode'` to clearly distinguish the two fetch-field Text fields

## 19.0.1.0.7

- [Improved] **Google Maps Context Flag**: `record.update()` in `_handlePlaceSelect` is now wrapped with `record.context.is_from_google_maps = true` set before the call and cleaned up in a `finally` block after; downstream field handlers and computed triggers can use this flag to detect that the update originated from a Google Places selection

## 19.0.1.0.6

### Added

- **Read-only Input Mode** (`no_manual_edit`): New widget option that locks the autocomplete input field to prevent free-text edits. When set to `True`, users can only populate the field by selecting a Google Places suggestion; all mapped fields are still filled as usual. Defaults to `False` (free-text input allowed).

## 19.0.1.0.5

### Improved

- **Mode-Based Placeholder**: `PlaceAutocompleteElement` now displays a context-sensitive placeholder — `Search for an address` in address mode and `Search for a place` in all other modes
- **Element Construction**: Simplified `PlaceAutocompleteElement` instantiation — merged the options/no-options branches into a single call using `this.props.options || {}`
- **String API**: Replaced deprecated `String.prototype.substr()` with `substring()` in element ID generation
- **Error Listener Binding**: Removed redundant `.bind()` from `gmp-error` event listener registration for `debounceHandleGooglePlaceError`
- **Missing Fields Warning**: Added user-facing notification when no place fields are specified, replacing the silent console warning
- **Label Style**: Added `text-500` CSS class to the search label `<small>` element for a softer, muted appearance

## 19.0.1.0.4

### Fixed

- **Single Record Update**: `saveChanges()` now merges address and geolocation values into a single `record.update()` call instead of two sequential calls, preventing intermediate re-renders
- **Stale Cache**: `getMappingConfig()` now validates that the cached `code`/`mode` matches the current props before returning the cached result, preventing stale config when props change between records
- **Props Validation Timing**: Moved `validateProps()` call from `setup()` to `toggleCollapse()` so validation only runs at interaction time and can show notifications properly
- **Null Config Handling**: `getMappingConfig()` now returns `null` early when neither `mappingCode` nor `mappingMode` is set on props, avoiding unnecessary RPC calls
- **Toggle State Sync**: `closeGoogleAutocomplete()` now also resets `isCollapseOpen` on the reactive state to keep it in sync with DOM collapse state
- **Empty String Props**: `mappingCode` and `mappingMode` extraction in `extractProps` no longer defaults to `''`, allowing proper falsy checks throughout the widget

### Improved

- **Record Navigation**: Added `onWillUpdateProps` lifecycle hook to automatically close the autocomplete panel when navigating to a different record
- **ORM Service Injection**: Replaced `component.env.model.orm` with `useService('orm')` for proper ORM service injection in `use_google_place_autocomplete_mapping.js`
- **Notification Service**: Removed `component.notificationService` fallback; notification service is now always obtained via `useService('notification')`
- **Missing Config Warning**: `validateProps()` now also warns when neither `mappingCode` nor `mappingMode` is provided, informing the user the widget will not function
- **JSDoc Coverage**: Added JSDoc comments to all public and private functions in `use_google_place_autocomplete_mapping.js` and `google_place_autocomplete_element.js`
- **Error Logging**: Simplified verbose error object logging to plain `console.error(error)` across all catch blocks
- **Toggle Button Feedback**: Toggle button now receives `bg-200` class when the autocomplete panel is open, providing visual state feedback

### UI

- **Widget Container**: Changed container style from `shadow-sm` to `border` for a cleaner appearance
- **Search Label**: Replaced `smaller`/`fw-lighter`/`font-sans-serif` classes with a `<small>` element and `fw-normal` for a more consistent look

## 19.0.1.0.3

### Fixed
- **Notification Service Calls**: Replaced incorrect `notificationService(...)` direct calls with `notificationService.add(...)` across all notification usages in `use_google_place_autocomplete_mapping.js`
- **Widget ID Generation**: `getUniqueWidgetId()` now uses `record.resId` / `record.virtualId` instead of `record.id` to correctly handle unsaved (new) records without errors
- **Error Return Value**: `fetchMappingConfig()` now returns `null` on failure instead of `{}` for clearer error distinction from empty results

### Improved
- **Concurrent Fetch Deduplication**: Added `_pendingFetch` promise guard in `getMappingConfig()` to prevent duplicate simultaneous RPC calls when the mapping config is not yet cached
- **Mapping Cache Clarity**: Renamed internal `localState` object to `mappingCache` to better reflect its purpose

### Code Quality
- Renamed `is_test` parameter to `isTest` to follow JavaScript camelCase conventions

## 19.0.1.0.2

### Fixed

- **Code Quality**: Added missing semicolon in return statement for consistent code formatting
- **Code Cleanup**: Removed unused NOTIFICATION_CONFIG constant

## 19.0.1.0.1
Initial release for Odoo 19.0

## 19.0.1.0.0
Migration to version 19.0
