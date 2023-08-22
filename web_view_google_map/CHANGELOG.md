# Change Log

## [16.0.2.2.2] -- 22/08/2023
### Added
- FontAwesome icon as marker    
Check this url https://fontawesome.com/v6/search?o=r&m=free&s=solid for available icon that can be used.
- Two new optional attributes `"marker_icon"` and `"icon_scale"`    
  - `marker_icon`    
  An attribute to assign FontAwesome icon to marker(s) rendered on the `google_map` view. Default icon is `"location-dot"` https://fontawesome.com/icons/location-dot?f=classic&s=solid    
  Use the FontAwesome icon name without prefix `"fa"` for example, icon `"fa-flag"` (https://fontawesome.com/icons/flag?f=classic&s=solid) then in the `"marker_icon"` attribute just use `"flag"`.    
    Example:    
    ```xml
    <google_map marker_icon="flag">
      ...
    </google_map>
    ```
  - `icon_scale`    
  An attribute to set the scale of the FontAwesome icon. Default value is `1`.    
    Example:    
    ```xml
    <google_map icon_scale="0.8">
      ...
    </google_map>
    ```
### Changed
### Fixed

## [16.0.1.2.2] -- 19/07/2023
### Added

### Changed

### Fixed
 - The Google search input placed inside the map becomes transparent.

## [16.0.1.2.1] -- 12/05/2023
### Added
### Changed
### Fixed
* Bug fixes and improvement
  - Add loading window
  - Improved reactivity of the view `"google_map"` and it's sub-view

## [16.0.1.1.1] -- 12/04/2023
### Added

### Changed
- Clicked the button "Open" on the marker info window will open form view in a dialog, before it's switched to form view page.

### Fixed
- Google maps and the markers are not processed until the Google loader is fully loaded
- Unfold/fold sidebar no longer reset the center of the map
- Fixed reactivity issue of component `GoogleMapSidebar`
- Remove unused props