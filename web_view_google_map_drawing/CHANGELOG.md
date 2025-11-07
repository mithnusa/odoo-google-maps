# Change Log

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
