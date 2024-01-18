# Change Log

## 16.0.2.0.4
* Improvement    
Update manifest, added module `web_widget_google_map`.


## 16.0.2.0.3    
* Bug fixes and improvement    
    - Added support for dark mode. All elements in the Google Map view, specifically Google Places elements, will now adapt to the current active theme. This fixes an issue where the view would crash when switching to dark mode.

## 16.0.2.0.2
* Bug fixes and improvement

## [16.0.2.0.1] -- 22/08/2023
### Added
 - New widget `GooglePlacesIdChar`.    
 This is a widget designed to be paired with fields `gplace_id`, allow user to fetch data from the Google Places service. It will automatically update or fill in other fields such as name, address, phone, website, and all other Google Places fields.    
    Example:    
    ```xml
    <form>
        ...
        <field name="gplace_id" widget="GooglePlacesIdChar"/>
    </form>
    ```
    You can find the implementation of this widget in module "contacts_google_places" and "crm_google_places".
### Changed
### Fixed