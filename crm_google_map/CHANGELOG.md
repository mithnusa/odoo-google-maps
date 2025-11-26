# Change Log

## 19.0.1.0.3
### Enhanced Marker Interaction & UI/UX
- Implemented toggle-based marker interaction replacing hover behavior
- Redesigned markers to display as compact circular icons by default, expanding on click to show full details
- Added handshake icon to markers with dynamic color based on marker color
- Improved marker click behavior with better event handling and stopPropagation
- Simplified Z-index management for better marker layering
- Enabled marker clustering (removed disable_cluster_marker attribute)

### UI Improvements
- Added expected revenue display in sidebar alongside stage information
- Restructured marker content layout with better organization (icon, content sections)
- Enhanced marker styling with improved transitions and visual feedback
- Adjusted overlap indicator positioning for better visibility
- Improved selected marker border styling
- Updated shadow and border effects for better visual hierarchy

### Code Quality
- Removed deprecated hover event listeners (mouseenter, mouseleave, touchstart, touchend)
- Eliminated _attachCRMMarkerEventListeners and _createCRMEventListeners methods
- Simplified marker creation and event handling logic
- Improved code organization and maintainability

## 19.0.1.0.2
Fix bug when editing geolocation in a pop-up form view.

## 19.0.1.0.1
- Improved marker layout
- Simplified sidebar list view, detailed information is now handled directly through the marker.

## 19.0.1.0.0
Migration to version 19.0
