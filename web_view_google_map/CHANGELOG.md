# Change Log

## 19.0.1.0.16

- [Added] **Nearby Search Crosshair Overlay**: The nearby search coverage area now renders two dotted polylines forming a crosshair at the bounding box center, visually marking the origin point used for the radius calculation
- [Added] **Dedicated Nearby Search Styling Constants**: Extracted overlay styling (stroke color, opacity, fill opacity, dot scale/repeat) into a `NEARBY_SEARCH` block within `MARKER_CONFIG`, keeping visual configuration in one place
- [Improved] **Nearby Coverage Area Rendering Order**: Moved `clearNearbySearchCoverageArea()` from `renderGeolocationData()` into `renderNearbySearchCoverageArea()` itself, so the coverage overlay is cleared and redrawn atomically on each render cycle
- [Improved] **Bounding Box Validation**: Added a `Number.isFinite` guard on all four bbox coordinates before rendering; logs a warning and exits early if any value is invalid
- [Improved] **Antimeridian-Aware Crosshair**: Midpoint longitude for the crosshair is computed correctly when the bounding box crosses the antimeridian (east < west)
- [Fixed] **Polyline Cleanup**: `clearNearbySearchCoverageArea()` now also removes and resets `_nearbySearchCoveragePolylines`, preventing orphaned overlay elements when the nearby search is cleared

## 19.0.1.0.15

- [Fixed] **Nearby Search Robustness**: Invalid `nearby_radius_search` config values (e.g. non-integer strings) now fall back to the default 1000 meters instead of raising an unhandled exception
- [Fixed] **Antimeridian Wraparound**: Nearby search bounding box now correctly handles locations near the international date line (±180° longitude) by splitting the longitude domain into two OR segments, ensuring accurate results for records in that region
- [Fixed] **Latitude Clamping**: Nearby search bounding box latitude values are now clamped to the valid range [-90, 90] to prevent invalid domain queries
- [Fixed] **Nearby Button Handler**: Fixed the "Show nearby" button click handler calling the wrong method (`showNearbyRecords` instead of `searchNearbyRecords`), which caused nearby search to silently fail
- [Fixed] **Search Radius Validation**: Added guard to reject non-finite or non-positive radius values before computing the bounding box, falling back to the configured default
- [Improved] **Geolocation Validation**: Replaced loose `isFinite()` check with `Number.isFinite()` for stricter validation of latitude/longitude values before triggering nearby search
- [Improved] **Nearby Button Semantics**: Replaced `<a href="#">` anchor with a `<button>` element for the nearby search trigger, improving semantic HTML and keyboard accessibility
- [Cleanup] **Settings View**: Removed unused import from `res_config_settings.xml`
- [Docs] **README**: Updated "Nearby Records" key feature description to mention the sidebar row as an additional trigger and the rectangle overlay shown on the map
- [Docs] **Features Reference**: Updated `Nearby Records Search` section to document the sidebar row trigger, bounding box rectangle overlay visualization, and view title update during a nearby search

## 19.0.1.0.14

- [Added] **Nearby Search Radius Setting**: Added `nearby_radius_search` configuration field (default: 1000 meters) to Settings → General Settings → Google Maps, allowing administrators to control the search radius used by the "Show nearby records" feature on the map
- [Added] **Settings Controller**: Added HTTP controller extending the `base_google_map` settings endpoint to include `nearby_radius_search` in the values returned to the frontend
- [Added] **Settings UI**: Added "Nearby Search Radius (m)" input to the Google Maps settings block, visible only when `web_view_google_map` is installed

## 19.0.1.0.13

- [Docs] **README**: Rewrote `README.md` to follow the project documentation template — added Overview, What It Does, Key Features, Dependencies, Installation, Basic Usage, Attributes Reference, Embedding guide, and Related Modules sections; replaced inline HTML image tags with standard Markdown image syntax
- [Docs] **Features Reference**: Created `docs/FEATURES.md` with detailed descriptions of all module features: Map View Type, Record Markers, Sidebar Panel, Marker Clustering, Overlapping Marker Handling, Grouping, Multi-Selection, In-Map Place Search, Geolocation Button, Nearby Records Search, Record Actions, Embedded Map in Forms, and Dark Mode Support

## 19.0.1.0.12

- [Added] **Header Button Support**: The map view now parses `<header>` buttons from the view's arch XML and renders them in the control panel using `MultiRecordViewButton`, matching the behavior of standard list views. Buttons with `display="always"` appear persistently; others appear in the selection actions area and in the cog menu on small screens.
- [Fixed] **Export Button**: Fixed the export action by replacing the manual `ExportDataDialog` implementation with Odoo's built-in `useExportRecords` hook, resolving errors triggered when clicking the Export button in the Action Menu
- [Fixed] **Action Service Calls**: Replaced `this.model.action.doAction` with `this.actionService.doAction` throughout the controller, resolving errors when opening form views or switching views from the map.
- [Fixed] **Domain Handling in `_getNextConfig`**: Map domain is now applied after calling `super._getNextConfig()` rather than before, preventing the map's geolocation filter from being overridden by the parent config.
- [Fixed] **Form View and Views Checks**: Changed truthy checks on `form_view` and `views` to use `.length` to correctly detect empty arrays.
- [Fixed] **Missing Form View Notification**: Replaced `console.warn` with a proper `notificationService` danger notification when no form view is available for a record.
- [Fixed] **Unselect All**: Simplified `onUnselectAll` by removing the marker-specific `_toggleMarkerSelection` branch; all records now use the standard `toggleSelection(false)` path.
- [Fixed] **Auto-Zoom Behavior**: Reduced `MAX_AUTO_ZOOM` from 17 to 15 and the smooth zoom increment on subsequent clicks from 3 to 2, resulting in less aggressive auto-zoom when centering on a marker.
- [Improved] **Delete with Confirmation**: Replaced the inline `ConfirmationDialog` call in `onDeleteSelectedRecords` with Odoo's built-in `useDeleteRecords` hook for consistent deletion behavior
- [Improved] **Exportable Fields**: Added `getExportableFields()` method that correctly filters visible, non-properties, exportable fields from the view's columns, respecting `column_invisible` modifiers and optional field visibility
- [Improved] **View Modifier Evaluation**: Added `evalViewModifier()` helper using `evaluateBooleanExpr` for evaluating view modifiers against the current record context
- [Improved] **`optionalActiveFields` Initialization**: Added `this.optionalActiveFields = {}` in the controller setup to prevent potential undefined access errors.
- [Cleanup] Removed the custom `getActionMenuItems()` method; action menu items are now handled by the standard Odoo mechanism.
- [Cleanup] Removed unused `deleteConfirmationMessage` import from `confirmation_dialog`.
- [Cleanup] Removed unused `RelationalModel` import from `google_map_view.js`.
- [Cleanup] Removed the duplicate `downloadExport` method left over from a prior refactor.
- [Cleanup] Removed the unused `getExportedFields` method and its associated `rpc` import.

## 19.0.1.0.11

- [Fixed] **Marker Listener Storage Key**: Fixed `_storeMarkerEventListener` being called with `'click'` instead of `'gmp-click'`, ensuring the stored listener key matches the actual event name used for proper cleanup

## 19.0.1.0.10

- [Added] **Pin-style Markers with Letter Glyphs**: Map markers now use Google's native `PinElement` instead of custom HTML elements. Each pin displays the first letter of the record's title as a glyph, giving a cleaner, map-native appearance.
- [Added] **Styled Place Search Marker**: The place search result is now shown as a distinctive orange teardrop marker with a search icon, making it easy to distinguish from record markers.
- [Improved] **Selected Marker Feedback**: Selected markers now scale up (1.4×) and highlight with a blue border (`#4285F4`), making the active record immediately obvious on the map.
- [Improved] **Default Zoom Level**: Reduced the default zoom level when panning to a marker from 17 to 15 for better spatial context.
- [Improved] **Color Processing**: `processColor()` was refactored for cleaner null/undefined handling. `normalizeColor()` now returns immediately for hex colors without unnecessary DOM manipulation, improving performance.
- [Fixed] **Marker Click Event**: Changed marker event listener from the deprecated `click` to `gmp-click`, which is the correct event for `AdvancedMarkerElement`.
- [Fixed] **Color Field Bug**: Fixed a bug in `parseRecord()` where `normalizeColor()` was incorrectly called with the field name instead of the actual color value, causing markers to always fall back to the default color.

## 19.0.1.0.9

- [Removed] **Libraries Data File**: Deleted `data/gmap_libraries.xml` — the `geometry,places` library initializer is no longer needed following the removal of the libraries configuration system in `base_google_map`
- [Improved] **Places API (New) Compatibility**: Replaced deprecated `componentRestrictions` with `includedRegionCodes` in `PlaceAutocompleteElement` options, aligning with the Places API (New) specification
- [Improved] **Country Code Validation**: Added proper filtering of country codes — strips whitespace and rejects entries that are not exactly 2 characters
- [Improved] **Language Support**: Added `requestedLanguage` option to `PlaceAutocompleteElement` when language restriction is enabled in settings
- [Improved] **Region Support**: Added `requestedRegion` option to `PlaceAutocompleteElement` based on the configured region setting
- [Improved] **Autocomplete Placeholder**: Set a translated placeholder text (`Search for a place`) on the `PlaceAutocompleteElement`
- [Improved] **Event Listener Cleanup**: Stored the bound `gmp-select` listener reference (`_boundHandlePlaceSelect`) and use `removeEventListener` instead of `google.maps.event.clearListeners` for proper cleanup
- [Improved] **Lifecycle Hook**: Wrapped `_cleanup` call in `onWillUnmount` with an arrow function for correct binding
- [Improved] **Box Selection Accuracy**: Reset map tilt to `0` before activating the marker box selection mode to ensure accurate pixel-to-lat/lng coordinate conversion

## 19.0.1.0.8

- [Fixed] **Geolocate button**: Fixed issue where geolocate button sometimes display twice.

## 19.0.1.0.7

- [Improved] **Domain Filtering**: Enhanced geolocation filtering to use 'not in' operator with comprehensive null value checks (null, false, 0.0)
- [Improved] **Sidebar UI**: Added striped styling to sidebar table for better visual distinction between rows
- [Fixed] **Code Cleanup**: Removed unused GoogleMapViewMixins model and `_getActionFormView` method
- [Fixed] **Code Quality**: Removed unnecessary blank lines in `models/__init__.py`
- Changed mapDomain to use `'not in'` operator with `nullValues = [null, false, 0.0]` instead of separate `'!='` comparisons
- Applied consistent null checking for both direct and related lat/lng fields
- Removed `google_map_view_mixins.py` and its import from `models/__init__.py`
- Removed `_getActionFormView` method from GoogleMapController
- Added `table-striped` class to sidebar table template

## 19.0.1.0.6

- [Improved] **Marker Selection Mode Activation**: Simplified keyboard shortcut to use only Alt or Meta (Command) keys, removing Ctrl key support for more consistent cross-platform behavior
- [Improved] **Code Quality**: Refactored keyboard event handlers with cleaner conditional logic and improved readability
- Updated `handleKeyDown` to check only `altKey` or `metaKey` (removed `ctrlKey` check)
- Simplified nested conditionals in both `handleKeyDown` and `handleKeyUp` methods
- Improved code maintainability in AdvancedMarkerBoxSelector class

## 19.0.1.0.5

- [Fixed] **Group Expansion Logic**: Fixed `handleGroupCollapse` to properly check if group records exist before toggling, preventing unnecessary API calls
- [Fixed] **Group Deletion**: Fixed `deleteGroupRecords` to properly iterate through grouped data structure when collapsing groups
- [Fixed] **Selection State in Grouped View**: Fixed marker selection state synchronization when staying in grouped view, ensuring selected markers remain highlighted
- [Improved] **Grouped View Performance**: Added debounce cancellation before clearing markers when switching to grouped view, preventing conflicting operations
- [Improved] **Group UI State**: Groups that already have records loaded now display in expanded state by default, improving user experience
- [Improved] **Color Palette**: Updated `generateColor` with cleaner, more vibrant colors for better marker visibility (20 colors with improved readability)
- [Improved] **Responsive Design**: Removed excessive media query breakpoints (1600px and 1200px) for cleaner responsive behavior
- [Improved] **Template Attributes**: Fixed `t-attf-data-tooltip` to use proper `t-att-data-tooltip` syntax in sidebar template
- Cancelled `debounceRenderGeolocationData` before marker clearing to prevent race conditions
- Cancelled `debounceSelectedMarkers` and re-evaluated all marker selection states when in grouped view
- Updated group collapse class to conditionally show expanded state based on records length
- Simplified color array with hex colors and descriptive comments

## 19.0.1.0.4

- Removed unused methods (hideGroupRecordsMarker, centerMapByGroup)
- Improved event listener cleanup in clearMarkers and `_cleanUp`
- Added data-id attribute to info window action buttons
- Enhanced invertColorDarken utility with opacity support and better documentation
- Removed redundant info window operations in marker selection

## 19.0.1.0.3

Improve the visibility of data displayed on the map when grouping the data.

## 19.0.1.0.2

Fix bug where updating (clicking the "edit" button below Google Maps view in form view) a record's geolocation in form view opened in a pop-up window caused an error.

## 19.0.1.0.1

- Visual improvements when showing individual marker in the map.
- When a marker is part of a cluster, clicking its record in the sidebar will automatically zoom in to reveal the marker within the cluster.

## 19.0.1.0.0

Migration to version 19.0.

This module includes a feature that was previously defined in module `web_view_google_map_selector_area`. A module to allow selecting markers within a drawn area on the map. This feature has now been integrated into this module.
