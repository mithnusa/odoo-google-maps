# Change Log

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
