# Change Log

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
