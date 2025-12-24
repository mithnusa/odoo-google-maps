# Change Log

## 19.0.1.0.7
### Improved
- **Domain Filtering**: Enhanced geolocation filtering to use 'not in' operator with comprehensive null value checks (null, false, 0.0)
- **Sidebar UI**: Added striped styling to sidebar table for better visual distinction between rows

### Fixed
- **Code Cleanup**: Removed unused GoogleMapViewMixins model and _getActionFormView method
- **Code Quality**: Removed unnecessary blank lines in models/__init__.py

### Technical Details
- Changed mapDomain to use `'not in'` operator with `nullValues = [null, false, 0.0]` instead of separate `'!='` comparisons
- Applied consistent null checking for both direct and related lat/lng fields
- Removed `google_map_view_mixins.py` and its import from models/__init__.py
- Removed `_getActionFormView` method from GoogleMapController
- Added `table-striped` class to sidebar table template

## 19.0.1.0.6
### Improved
- **Marker Selection Mode Activation**: Simplified keyboard shortcut to use only Alt or Meta (Command) keys, removing Ctrl key support for more consistent cross-platform behavior
- **Code Quality**: Refactored keyboard event handlers with cleaner conditional logic and improved readability

### Technical Details
- Updated `handleKeyDown` to check only `altKey` or `metaKey` (removed `ctrlKey` check)
- Simplified nested conditionals in both `handleKeyDown` and `handleKeyUp` methods
- Improved code maintainability in AdvancedMarkerBoxSelector class

## 19.0.1.0.5
### Fixed
- **Group Expansion Logic**: Fixed `handleGroupCollapse` to properly check if group records exist before toggling, preventing unnecessary API calls
- **Group Deletion**: Fixed `deleteGroupRecords` to properly iterate through grouped data structure when collapsing groups
- **Selection State in Grouped View**: Fixed marker selection state synchronization when staying in grouped view, ensuring selected markers remain highlighted

### Improved
- **Grouped View Performance**: Added debounce cancellation before clearing markers when switching to grouped view, preventing conflicting operations
- **Group UI State**: Groups that already have records loaded now display in expanded state by default, improving user experience
- **Color Palette**: Updated `generateColor` with cleaner, more vibrant colors for better marker visibility (20 colors with improved readability)
- **Responsive Design**: Removed excessive media query breakpoints (1600px and 1200px) for cleaner responsive behavior
- **Template Attributes**: Fixed `t-attf-data-tooltip` to use proper `t-att-data-tooltip` syntax in sidebar template

### Technical Details
- Cancelled `debounceRenderGeolocationData` before marker clearing to prevent race conditions
- Cancelled `debounceSelectedMarkers` and re-evaluated all marker selection states when in grouped view
- Updated group collapse class to conditionally show expanded state based on records length
- Simplified color array with hex colors and descriptive comments

## 19.0.1.0.4
- Removed unused methods (hideGroupRecordsMarker, centerMapByGroup)
- Improved event listener cleanup in clearMarkers and _cleanUp
- Added data-id attribute to info window action buttons
- Enhanced invertColorDarken utility with opacity support and better documentation
- Removed redundant info window operations in marker selection

## 19.0.1.0.3
Improve the visibility of data displayed on the map when grouping the data.

## 19.0.1.0.2
Fix bug where updating (clicking the "edit" button below Google Maps view in form view) a record's geolocation in form view opened in a pop-up window caused an error.

## 19.0.1.0.1
- Visual improvements when showing individual marker in the map.    
When a marker is part of a cluster, clicking its record in the sidebar will automatically zoom in to reveal the marker within the cluster.

## 19.0.1.0.0
Migration to version 19.0.   

This module includes a feature that was previously defined in module `web_view_google_map_selector_area`. A module to allow selecting markers within a drawn area on the map. This feature has now been integrated into this module.
