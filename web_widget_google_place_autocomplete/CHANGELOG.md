# Change Log

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
