# Change Log

## 19.0.1.0.7
### Added
- **GeoJSON File Import**: New upload dialog for importing GeoJSON files directly into Terra Draw
  - Added `UploadGeoJsonFileDialog` component with file validation
  - 5MB file size limit with user-friendly error messages
  - Support for `.geojson` and `.json` file extensions
- **GeoJSON Validation**: New `validateGeoJson()` utility function with comprehensive validation
  - Supports FeatureCollection, Feature, and Geometry objects
  - Optional strict mode and geometry coordinate validation
- **3D to 2D Coordinate Conversion**: New `stripAltitude()` function for Terra Draw compatibility
  - Converts 3D coordinates (with elevation) to 2D coordinates

### Improved
- **Performance**: Major rendering performance optimizations
  - Synchronous batch processing (removed async/requestIdleCallback overhead)
  - Pre-calculate colors once per record instead of per feature
  - Added `featuresByRecordId` index for O(1) related feature lookup
  - Added `measurementCache` for O(1) tooltip measurement lookup
  - Optimized bounds calculation using simple min/max instead of LatLngBounds.extend()
  - Optimized `getGroupsOrRecords()` cache validation (replaced JSON.stringify)
  - Use for loops instead of forEach for better iteration performance
- **Hover Performance**: Removed layer rebuild on hover; using Deck.gl autoHighlight at GPU level
- **Bundled Dependencies**: All libraries now loaded from local files instead of CDN
  - Improves reliability and offline capability
  - Reduces external network dependencies

### Updated Dependencies
- **Terra Draw**: Updated from 1.21.4 to 1.23.1
- **Deck.gl**: Updated from 9.2.5 to 9.2.6
- **Turf.js**: Updated from 7.3.1 to 7.3.2

### Removed
- Removed viewport culling logic (Deck.gl handles this automatically at GPU level)
- Removed garbage collection system (unnecessary with proper cleanup)
- Removed unused data structures: `layers` Map, `featureIndex` Map, `visibleFeatures` Set
- Removed unused debounced operations: `debounceUpdateViewport`, `debounceGarbageCollection`
- Removed map event listeners for bounds/zoom changes

### Technical Details
- Inline feature creation in `_processRecordGeoJSON()` for reduced function call overhead
- Direct min/max tracking in `_fitMapToBounds()` and `centerMap()` methods
- Removed `_createEmptyFeatureObject()`, `_updateViewportCulling()`, `_performGarbageCollection()` methods
- Added tooltip max-width constraint (300px) for better readability
- Feature properties now properly displayed in tooltip (excluding internal Odoo properties)

## 19.0.1.0.6
### Updated Dependencies
- **Terra Draw**: Updated from 1.19.0 to 1.21.4
- **Terra Draw Google Maps Adapter**: Updated from 1.1.0 to 1.2.1

## 19.0.1.0.5
### Improved
- **Domain Filtering**: Fixed empty GeoJSON filtering to use 'json_ne' with AND logic, properly excluding null and empty FeatureCollections
- **Drawing Styles**: Enhanced Terra Draw mode styles with better visibility (point outlines, line widths, fill opacity)
- **Terra Draw Initialization**: Refactored adapter creation for better code readability
- **Canvas Rendering**: Added z-index styling to ensure Terra Draw canvas renders on top
- **Template Structure**: Removed unnecessary template inheritance, now uses base GoogleMapRenderer template directly
- **Sidebar Toggle**: Re-enabled sidebar toggle button (removed previous Deck.gl resize workaround)
- **Layout Cleanup**: Removed control panel ResizeObserver as it's no longer needed

### Updated Dependencies
- **Deck.gl**: Updated from 9.2.2 to 9.2.5
- **Turf.js**: Updated from 7.3.0 to 7.3.1

### Fixed
- **Timeout Cleanup**: Added proper timeout clearing before creating new timeout in Terra Draw initialization
- **Template Organization**: Reorganized InMapSearchPlaces component position for better structure

### Technical Details
- Changed mapDomain from `Domain.or` to `Domain.and` with `json_ne` operator
- Added comprehensive drawing styles: pointWidth (6px), pointOutlineWidth (2px), lineStringWidth (2px), fillOpacity (0.3), outlineWidth (2px)
- Extracted adapter options into separate variable before Terra Draw instance creation
- Added `canvas { z-index: 100 !important }` to ensure proper overlay rendering
- Removed `_setupControlPanelResizeObserver` method and related ResizeObserver cleanup
- Removed template inheritance that was hiding sidebar toggle button
- Changed template reference from `GoogleMapDeckGlRenderer` to base `GoogleMapRenderer`

## 19.0.1.0.4
### Fixed
- **Critical Bug in Viewport Culling**: Fixed `_updateViewportCulling()` method that was missing function call parentheses, preventing viewport updates from executing
- **Feature Disappearance in Grouped Records**: Fixed `_renderGroupedRecordsFitBounds()` to use immediate layer updates instead of debouncing, preventing features from disappearing when expanding grouped records
- **Race Conditions in Selection Handling**: Completely redesigned `toggleRecordSelection()` to eliminate race conditions between selection state updates and layer rendering
- **Premature Data Clearing**: Fixed issue where selection changes triggered full data clearing and re-rendering, causing features to disappear temporarily
- **Viewport Culling Timing Issues**: Improved synchronization between viewport changes and layer updates to prevent features from being culled during transitions

### Improved
- **Record Selection Performance**: Added 100ms debouncing to `toggleRecordSelection()` to prevent rapid clicks from causing conflicts
- **Selection State Management**: Implemented immediate feature selection state updates without waiting for props changes, improving responsiveness
- **Conditional Map Centering**: Added optional `centerMap` parameter to `toggleRecordSelection()` for more controlled map navigation behavior
- **Cleanup Process**: Enhanced `_cleanUp()` method to cancel all pending debounced operations before resetting features, preventing stale updates from causing issues
- **Layer Update Synchronization**: Improved coordination between debounced operations by canceling conflicting updates before critical operations

### Technical Details
- Cancelled debounced updates in `_renderGroupedRecordsFitBounds()` before immediate layer rendering
- Direct feature state updates in `_toggleRecordSelectionImpl()` instead of triggering full re-renders
- Added proper error handling for selection toggle operations
- Improved viewport culling execution flow with proper function invocation

## 19.0.1.0.3
- Updated Terra Draw library from 1.18.1 to 1.19.0
- Removed IconLayer implementation, simplified to ScatterplotLayer for points
- Added circle radius and diameter measurements
- Improved color calculations using invertColorDarken utility
- Added event listener tracking and proper cleanup
- Preserved feature properties when converting MultiPolygon geometries
- Enhanced tooltip styling with color-based borders
- Fixed calculateCircleArea to use Math.pow for precision
- Improved measurement formatting (sq m → m²)
- Changed GeoJSON upload wizard default to overwrite existing records
- Removed unused methods and improved code organization

## 19.0.1.0.2
Improve the visibility of data displayed on the map when grouping the data.

## 19.0.1.0.1
Small improvements on the SCSS.

## 19.0.1.0.0 - Terra Draw & Deck.Gl Integration with Advanced Measurements
### Added
- **Comprehensive Measurement System**: Added real-time measurement calculations for all geometry types
  - Point coordinates with directional indicators (N/S, E/W)
  - LineString length and point count
  - Polygon area and perimeter
  - Rectangle area and perimeter  
  - Circle area, radius, and circumference
  - Number formatting with locale support
- **Terra Draw Integration**: Complete integration with Terra Draw library for advanced drawing capabilities
- **In-Map UI Positioning**: Moved measurement panel inside map container for better user experience
- **Measurement Unit Toggle**: Support for both metric (km, m, ha) and imperial (mi, ft, ac) units
- **Advanced Number Formatting**: Smart unit selection and formatting for easy readability
- **Keyboard Shortcuts**: Added support for Delete, Ctrl+Z, Ctrl+Y, Ctrl+A, and Escape keys
- **Feature Import/Export**: GeoJSON import and export capabilities
- **Undo/Redo System**: Complete history management for drawing operations
