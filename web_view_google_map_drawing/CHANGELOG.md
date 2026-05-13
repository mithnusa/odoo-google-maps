# Change Log

## 19.0.1.0.17

- [Fixed] **`isinstance` → `getattr` Duck-Type Check in `_condition_to_sql`**: Version 19.0.1.0.16 replaced `hasattr` marker checks with `isinstance(v, JsonValue)` / `isinstance(v, JsonContainsValue)`, but this caused a `ValueError: Cannot serialize value for comparison: Object of type JsonValue is not JSON serializable` at runtime. Root cause: Odoo can load the same Python module under two different import paths, producing two distinct class objects in memory. When the domain optimization helpers (`_json_equal_optimization` / `_json_contains_optimization`) create a `JsonValue` or `JsonContainsValue` using one class object and `_condition_to_sql` checks `isinstance` against the other, the check returns `False` even though the instance looks correct — falling into the `else` branch which calls `json.dumps(v)` and raises a `TypeError`. Fixed by reverting to `getattr(v, '_json_contains_marker', False)` / `getattr(v, '_json_marker', False)` duck-typing, which is immune to class identity mismatches.

## 19.0.1.0.16

### Added

- **Calculate Area Button in Deck.gl Editor**: New toolbar button (calculator icon) that calculates the total area of all Polygon/MultiPolygon features and saves it to the record's area field via the new `saveFeaturesTotalArea` prop
- **`handleSaveFeatureTotalArea()` in `GoogleMapTerraDrawField`**: New method that receives a calculated total area and writes it to the `fieldArea` field on the current record, wired up to all three `DeckGlEditor` usages via `saveFeaturesTotalArea.bind`
- **GIN Index on `gshape_geojson` (contacts_area example)**: `ResPartnerArea._auto_init()` now creates a `gin` index on `gshape_geojson` using `create_index`, making `json_contains` / `json_not_contains` searches performant at scale
- **Integration Tests for `SearchableJson` (contacts_area example)**: New `tests/test_searchable_json_integration.py` with 7 end-to-end `TransactionCase` tests covering all four custom operators (`json_eq`, `json_ne`, `json_contains`, `json_not_contains`) against `res.partner.area`

### Fixed

- **`record.id` → `record.resId` Throughout Deck.gl Renderer**: Multiple places in `google_map_deckgl_renderer.js` used `record.id` (OWL component id) instead of `record.resId` (database ID), causing feature-to-record associations to be keyed on the wrong value. Fixed in `_processRecordGeoJSON`, `_buildRecordsSelected`, `toggleRecordSelection`, `deleteGroupRecords`, `_updateShapeSelectionState`, `_generateInfoWindowHtml`, `_findRecordByFeature`, and `pointInMap`
- **`feature.properties?.odoo?.id` → `feature.properties?.odooId`**: Feature property access in `centerMap()` was reading from a non-existent nested `odoo.id` path; corrected to `odooId` which is the property actually written during feature creation
- **`MultiPoint` Rendering**: Was only pushing `coordinates[0]` (the first point) for `MultiPoint` geometries; now iterates all coordinates so every point in the collection is rendered
- **`json_not_contains` / `json_ne` — NULL Rows Excluded**: `NOT (field @> value)` and `field != value` evaluate to `NULL` when the column is `NULL`, silently excluding records with no GeoJSON. Fixed to `(field IS NULL OR NOT (field @> value))` and `(field IS NULL OR field != value)` so NULL rows are included in negation results
- **`isinstance` Replaces `hasattr` Marker Checks**: Type dispatch in `_condition_to_sql` used `hasattr(v, '_json_contains_marker')` / `hasattr(v, '_json_marker')`; replaced with `isinstance(v, JsonContainsValue)` / `isinstance(v, JsonValue)` for reliable type checking
- **`_storeElementEventListener()` — Duplicate Listener Leak**: If the same event type was registered twice on the same element, the old listener was never removed before the new one was stored. Added a guard that calls `removeEventListener` on the existing listener before replacing it
- **`google.maps.InfoWindow` — Direct Constructor**: `new google.maps.InfoWindow()` accessed the global namespace directly before the `maps` library was guaranteed to be loaded. Replaced with `const { InfoWindow } = await this.apiLoader.importLibrary('maps')` for correct async initialization
- **`_processSelectionInBatches()` — Unhandled Rejection**: The batch processing `Promise` had no `reject` path; errors inside `processBatch` were silently swallowed. Added try/catch with `reject(error)`
- **`geojson_upload_wizard_views.xml` — File Type Filter**: The file upload field had no `accepted_file_extensions` option, allowing any file to be selected. Added `options="{'accepted_file_extensions': '.geojson,.json,application/geo+json,application/json'}"` to restrict to GeoJSON files

### Improved

- **Area Calculation Gated on Geometry Type**: Turf.js `area()` calls are now skipped for `Point`, `MultiPoint`, `LineString`, and `MultiLineString` geometries — only `Polygon` and `MultiPolygon` trigger area computation, avoiding unnecessary library calls and `displayArea` / `displayTotalArea` noise
- **`_clearRenderingData()` Invalidates Groups/Records Cache**: Added `cachedGroupsOrRecords = null` and `lastGroupsOrRecordsProps = null` resets so the next render after a data clear always rebuilds from fresh record data
- **`pointInMap()` — O(1) Feature Lookup**: Replaced a full `geoJsonData.forEach` scan with `featuresByRecordId.get(recordId)` index lookup, reducing time complexity from O(n) to O(1)
- **`toggleRecordSelection()` — O(1) Feature Lookup**: Same replacement as `pointInMap()` — uses `featuresByRecordId` index instead of scanning all features
- **`deleteGroupRecords()` — O(1) Cleanup via Index**: Replaced the `geoJsonData.forEach` + string-prefix scan with `featuresByRecordId.get(recordId)` + `featuresByRecordId.delete(recordId)` for correct and efficient feature removal
- **`getGroupsOrRecords()` Cache Key Simplified**: Removed the `firstLastIds` first/last ID comparison from the cache key — the `isGrouped + length` check is sufficient and avoids edge cases where IDs can shift without a length change
- **Switch Case Lexical Scoping**: Added `{}` blocks around `Point`, `LineString`/`MultiLineString`, and `Polygon` cases in the measurements switch to prevent `let` re-declaration errors between cases
- **Error Messages Translated**: All `ValueError` messages in `fields.py` now use `_()` for translation via the standard Odoo i18n pattern
- **Guard for Misapplied Custom Operators**: Added an explicit `ValueError` with a translated message when `json_eq`, `json_ne`, `json_contains`, or `json_not_contains` reaches the `super()` fallback in `_condition_to_sql`, meaning they were applied to a non-`SearchableJson` field
- **`gshape_name` Default Value**: Set `default=lambda self: _('New Shape')` on `gshape_name` in `GoogleDrawingShape` mixin so new records always have a meaningful translated name
- **`__repr__` on Wrapper Classes**: Added `__repr__` to both `JsonValue` and `JsonContainsValue` for readable debug output
- **`loadTurfJSAssets` in Deck.gl Editor**: `DeckGlEditor.onWillStart` now also awaits `loadTurfJSAssets()` so Turf.js is guaranteed available before any area calculation is attempted
- **Sidebar XPath Updated for `data-role`**: `google_map_drawing_sidebar.xml` selector updated from `//button[@id='action-show-nearby']` to `//button[@data-role='action-show-nearby']`, tracking the ID → `data-role` change in `web_view_google_map` v1.0.24
- **`mapDomain` Memoized in Drawing Model**: `GoogleMapDrawingModel.mapDomain` now uses the same `_mapDomainCache` pattern as the base model, avoiding repeated domain construction on every access
- **Removed Redundant `_isSidebarAction = false` Reset**: Removed the redundant state reset inside the `useEffect` dependency callback in `google_map_deckgl_renderer.js`
- **Console Noise Reduction**: Replaced `console.error(error)` / `console.warn(...)` patterns with silent `catch {}` blocks (or user-facing notifications) throughout the Deck.gl renderer — expected operational errors no longer pollute the browser console

### Removed / Refactored Tests

- **`TestSearchableJsonIntegration` Moved to contacts_area**: Integration tests that require a real database and the `contacts_area` module installed have been moved to `example/contacts_area/tests/test_searchable_json_integration.py`. `test_field_json_searchable.py` now contains only unit tests that can run without an installed example module
- **`TestJsonContainsValue` Reordered**: Moved from after `TestSearchableJsonField` to before `TestDomainOptimization` for more logical test file structure

## 19.0.1.0.15

- [Updated] **Deck.gl**: Updated from 9.2.9 to 9.3.1
- [Updated] **Terra Draw**: Updated from 1.27.0 to 1.28.8
- [Updated] **Turf.js**: Updated from 7.3.4 to 7.3.5
- [Fixed] **Deck.gl 9.3.1 Rendering Error**: Added `interleaved: false` to `GoogleMapsOverlay` constructor in both `GoogleMapDeckGLRenderer` and `DeckGlEditor` — resolves `TypeError: Cannot read properties of undefined (reading 'map')` thrown inside luma.gl v9's `WEBGLRenderPass` constructor during `beginRenderPass`. Root cause: deck.gl 9.x changed the `GoogleMapsOverlay` rendering internals; without an explicit `interleaved` value a code path is entered where `colorAttachments` is undefined when the render pass is set up. `interleaved: false` forces the canvas-overlay path (separate WebGL context), restoring the implicit default behaviour from 8.x
- [Improved] **Library Cache-Busting**: Added version constants (`TERRA_DRAW_VERSION`, `TERRA_DRAW_GMAPS_ADAPTER_VERSION`, `TURF_JS_VERSION`, `DECK_GL_VERSION`) in `utils.js` and appended `?v=<version>` query strings to all `loadJS` calls — ensures browsers fetch updated bundles when a library is upgraded instead of serving a stale cached copy
- [Improved] **DeckGlEditor Initialization Timing**: Replaced the direct `_initializeDeckGLOverlay()` call in `useEffect` with `onMapLoadedInitializeDeckGLOverlay()`, which defers overlay creation until the map fires its first `idle` event — prevents Deck.gl from attempting to render before Google Maps has completed its initial paint
- [Improved] **Double-Init Guard**: Added an early-return check in `GoogleMapDeckGLRenderer._initializeDeckGLOverlay()` to skip re-initialization when the overlay already exists

## 19.0.1.0.14

- [Improved] **Sidebar CSS Selector**: Renamed `.o_map_right_sidebar` to `.o_map_left_sidebar` in both `google_map_drawing_x2many_field.scss` and `google_map_drawing_view.scss`, tracking the sidebar repositioning in `web_view_google_map` v1.0.22

## 19.0.1.0.13

- [Updated] **Terra Draw**: Updated from 1.25.0 to 1.27.0
- [Improved] **Coordinate Validation**: Replaced `isNaN`/`isFinite` checks with `Number.isFinite` throughout for stricter and more idiomatic number validation
  - `formatAreaMeasurement()` in `utils.js`
  - `formatLengthMeasurement()` in `utils.js`
  - `calculateFeaturesTotalArea()` in `utils.js`
  - `defaultCenter` coordinate validation in `terra_draw.js`

## 19.0.1.0.12

- [Fixed] **Props Compatibility**: Excluded `showNearbyRecords` from `GoogleMapsDrawingSidebar.props` — the prop is inherited from the base sidebar but unused in drawing mode, causing OWL prop validation warnings
- [Improved] **Controller**: Overrode `rendererProps` in `GoogleMapDrawingController` to strip `showNearbyRecords` before passing props to the renderer, keeping the drawing view decoupled from nearby search functionality

## 19.0.1.0.11

- [Improved] **Sidebar UI**: Removed the "Show Nearby" button from the drawing view's sidebar record items — the nearby search action is not applicable in the drawing context and the button was inherited from the base map view
- [Docs] **Features Reference**: Created `docs/FEATURES.md` covering all module features: Drawing Tools, GeoJSON Storage, Google Drawing Shape Mixin, Intelligent Rendering (Terra Draw vs Deck.gl), Area and Length Measurements, Import/Export GeoJSON, Geometry Simplification, Drawing Map View Type, Embedded Drawing Widget, Deck.gl High-Performance Viewer, and Bundled Libraries

## 19.0.1.0.10

### Updated Dependencies

- **Deck.gl**: Updated from 9.2.6 to 9.2.9
- **Terra Draw**: Updated from 1.23.1 to 1.25.0
- **Terra Draw Google Maps Adapter**: Updated from 1.2.1 to 1.3.1
- **Turf.js**: Updated from 7.3.2 to 7.3.4

## 19.0.1.0.9
### Added
- **Dataset-Level Performance Analysis**: Automatic detection and routing of large datasets to DeckGL
  - New `analyzeDatasetPerformance()` function in `geometry_performance_utils.js`
  - Analyzes total feature count, total vertices, and point-specific counts
  - Returns recommendation on whether to use DeckGL with detailed reason
- **New Performance Thresholds**: Added dataset-level limits to `GEOMETRY_PERFORMANCE_CONFIG`
  - `MAX_FEATURES_FOR_TERRA_DRAW`: 3000 (total feature count limit)
  - `MAX_TOTAL_VERTICES_FOR_TERRA_DRAW`: 5000 (sum of all vertices across features)
  - `MAX_POINTS_FOR_TERRA_DRAW`: 5000 (specifically for Point geometries)

### Improved
- **Automatic Renderer Selection**: Updated `determineRenderingMode()` in `terra_draw.js`
  - Now checks dataset size limits before checking for polygon holes or 3D coordinates
  - Logs warning to console when switching to DeckGL due to large dataset
  - Prevents browser hang when loading 100k+ points or large feature sets

### Fixed
- **Feature Simplification ID Conflict**: Fixed "Feature could not be found by Google Maps API" error
  - `simplifySelectedFeature()` now generates a new UUID for simplified features
  - Prevents Terra Draw adapter conflicts when removing and adding features with same ID

### Technical Details
- Import `analyzeDatasetPerformance` in `terra_draw.js` from `geometry_performance_utils.js`
- Dataset analysis runs before polygon hole and 3D coordinate checks (most common performance issue)
- Point geometries are counted separately as they are lightweight compared to polygons

## 19.0.1.0.8
### Added
- **GeoJSON Export**: Added export functionality to both Terra Draw and Deck.gl editors
  - Download current features as a `.geojson` file with timestamp-based filename
  - Automatic removal of internal properties (mode, midPoint, selectionPoint, _metadata) from export
  - Filter out system features (midpoints, selection points) from Terra Draw exports
- **Deck.gl Import/Export Toolbar**: Added import and export buttons to DeckGlEditor component
  - Upload button for importing GeoJSON files
  - Download button (disabled when no data available)
  - Styled toolbar matching Terra Draw UI
- **3D Coordinate Detection**: Automatic detection and handling of 3D coordinates (with altitude)
  - Features with altitude values are automatically rendered using Deck.gl
  - Added `_hasAltitude()` helper method for recursive coordinate checking

### Improved
- **Area Calculation**: Simplified `calculateArea()` function
  - Now passes GeoJSON Feature directly to `turf.area()` instead of creating intermediate geometry
  - Proper support for both Polygon and MultiPolygon geometry types
  - Added robust validation for `calculateFeaturesTotalArea()`
- **GeoJSON Change Detection**: Replaced expensive `JSON.stringify` comparison with lightweight fingerprinting
  - New `_hasGeoJsonChanged()` method using reference equality and fingerprint comparison
  - New `_getGeoJsonFingerprint()` method capturing geometry type, ID, and coordinate count
  - New `_countCoordinates()` helper for recursive coordinate counting
  - Significantly faster for large GeoJSON datasets
- **Point Layer Rendering**: Simplified `_createPointLayer()` in DeckGlEditor
  - Removed custom icon atlas implementation
  - Now uses ScatterplotLayer exclusively for point features

### Removed
- Removed 17 unused functions from `utils.js` (reduced from ~1067 to ~537 lines):
  - `generateUUID`, `formatNumber`, `hasPolygonsWithHoles`, `hexToRgba`
  - `stripAltitude`, `stripAltitudeFromFeature`, `stripAltitudeFromGeometry`
  - `debounce`, `AREA_THRESHOLDS`, `LENGTH_THRESHOLDS`
  - `formatDistance`, `formatDistanceMeasurement`, `generateTooltipHtml`
  - `GEOMETRY_COLORS`, `createFeatureCollection`, `extractPointsFromGeometry`
  - `getMeasurementForGeometry`
- Removed `createIconAtlas()` function and `ICON_MAPPING` constant from DeckGlEditor
- Removed `window.DEBUG_DECKGL` debugging flag

### Technical Details
- Added `_cleanPropertiesForExport()` method to both TerraDrawToolsUI and DeckGlEditor
- DeckGlEditor now imports `UploadGeoJsonFileDialog` component
- Added `hasDataToExport` computed property to DeckGlEditor
- Updated README.md with new Import/Export, Rendering Modes, and Performance Optimizations sections

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
