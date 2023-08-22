# Change Log

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