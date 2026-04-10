# Change Log

## 19.0.1.0.9

### Improved

- **`onMapReady()`**: Replaced manual `addListener` + `removeListener` pattern with `addListenerOnce` for cleaner one-time `tilesloaded` event handling; removed the manual `resize` trigger that is no longer needed
- **`onMapReady()` — Destroyed Component Guard**: `isMapReady` state is now only set if the component has not been destroyed, preventing state updates on unmounted components
- **`_cleanUp()`**: Sets `_isComponentDestroyed = true` flag on teardown to signal that the component lifecycle has ended

### Fixed

- **Stale State Update After Destroy**: Added `_isComponentDestroyed` flag to prevent `onMapReady` from updating reactive state after the component has been cleaned up, avoiding potential errors on unmounted components

## 19.0.1.0.8

- [Added] **`filterValidParams()` Method**: New static method on `GoogleMapsAPILoader` that strips application-level settings (e.g. `color_scheme`, `map_id`, `in_map_place_search`) from the full settings cache, returning only the keys accepted by the Google Maps API bootstrap script loader (`key`, `v`, `region`, `language`, `channel`, `solutionChannel`, `authReferrerPolicy`)
- [Improved] **`serializedParams()`**: Now filters params through `filterValidParams()` before serializing, ensuring cache keys only reflect loader-relevant parameters and do not drift when application settings change
- [Improved] **`sanitizeParams()`**: Refactored to use `filterValidParams()` before iterating, removing the need for special-cased URL character validation on `callback` and `libraries` keys (which are no longer present after filtering)
- [Improved] **`prepareSettingValues()` — Channel**: Replaced negative-condition exclusion with a positive `Number.isFinite()` guard so `channel` is only included when it is a valid finite number in the range 0–999
- [Improved] **`prepareSettingValues()` — Solution Channel**: Replaced multi-branch null/empty check with a single `typeof === 'string'` guard; falls back to `DEFAULT_SOLUTION_CHANNEL` when `solution_channel` is undefined
- [Improved] **`handleLoadError()` — Safe Error Access**: Added optional chaining (`error?.type`, `error?.name`, `error?.message`) and an extracted `errorMessage` variable to prevent crashes when the error object is null or missing properties
- [Improved] **`useGoogleMapsAPILoader`**: Simplified `importLibrary` availability check from `=== undefined || !...` to a single `=== undefined` guard
- [Removed] **`ALLOWED_URL_CHARS` Constant**: Removed the URL character validation regex; URL-specific sanitization for `callback` and `libraries` is no longer needed as those keys are excluded by `filterValidParams()`

## 19.0.1.0.7

### Documentation

- **README**: Rewrote `README.md` to follow the project documentation template — added Overview, What It Does, Key Features, Dependencies, Installation (including required Google Cloud APIs), Basic Usage, and Related Modules sections
- **Features Reference**: Created `docs/FEATURES.md` with detailed descriptions of all module features organized by category: Settings Configuration, Autocomplete Restrictions, In-Map Place Search, API Loader, and Base Map Component

## 19.0.1.0.6

### Removed

- **Libraries Setting**: Removed `google_maps_libraries` field and its UI setting — libraries are no longer managed through configuration; the "Libraries" field has been removed from the Settings page
- **Libraries Onchange**: Removed `onchange_google_enable_map_place_search` method that auto-appended `places` to the libraries list
- **Libraries Loader Parameter**: Removed `libraries` from the Google Maps API loader parameters (`prepareSettingValues`, controller response, and JSDoc)

### Improved

- **Module Detection**: Refactored `get_values()` to use `_get()` instead of `search_count()` for checking whether `web_view_google_map` is installed — more efficient single-record lookup
- **Param Serialization**: Fixed `serializedParams()` to use `JSON.stringify` with sorted keys instead of `Object.values().join('/')` for deterministic and reliable cache-key generation
- **Error Type Detection**: Improved auth error detection in the loader error handler — now checks `error.type` and `error.name` instead of parsing the error message string
- **UI Copy**: Updated help text for "Enable Google Places Search" setting to reference `Places API (New)` instead of the deprecated `Places API`
- **Field Label**: Capitalized `'Enable Google Places Search'` field string for consistency

## 19.0.1.0.5

### Improved

- **Scale Control**: Enabled scale control on the Google Map by default

## 19.0.1.0.4

### Fixed

- **Code Cleanup**: Removed unused imports in configuration settings (`ast`, `ValidationError`)

### Improved

- **Code Quality**: Added missing semicolon in `useEffect` hook for consistent code formatting

## 19.0.1.0.3

### Improved

- **Exported Constants**: Made validation and configuration constants available for import in other modules (MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, VALID_LAT_RANGE, VALID_LNG_RANGE, RESIZE_DEBOUNCE_DELAY, MAP_LOAD_TIMEOUT)
- **Exported Accessibility Labels**: Made A11Y_LABELS constant exportable for consistency across components

### Fixed

- **Loader State Initialization**: Changed initial loader status from `INITIALIZING` to `NOT_LOADED` for more accurate state representation
- **State Update Bug**: Added missing `loaderStatus` parameter to `updateLoaderState()` method call

### Technical Details

- Removed commented-out API loader code for cleaner codebase
- Constants can now be imported and reused across different map components

## 19.0.1.0.2

### Improved

- **Map Initialization State**: Enhanced `isMapLoaded()` to include `isMapReady` state check for more reliable map readiness detection
- **State Management**: Added explicit `isMapReady` state flag that is set after the map's idle event listener is initialized

### Technical Details

- Set `this.state.isMapReady = true` in `_initMapInternal` after idle event setup
- Updated `isMapLoaded()` condition to check both `googleMap` existence and `isMapReady` state
- Prevents premature operations before map is fully initialized and ready

## 19.0.1.0.1

- Removed unused component "WarningMissingGoogleMapFormViewDialog".

## 19.0.1.0.0

Migration to version 19.0
