# Change Log

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
