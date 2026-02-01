# Change Log

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
