# Odoo and Google maps integration

All the modules related to Javascript (views and widgets) are already written using the new Odoo Javascript Framework, [OWL Framework](https://odoo.github.io/owl/)

## Modules

| Module | Version | Description |
|--------|---------|-------------|
| base_google_map | 16.0.1.2.3 | Base module of Google Maps contains settings to setup Google API Key |
| base_google_places | 16.0.2.0.3| Base module of Google places, inherit `"base_google_maps"`, contains abstract model to store Google Place data |
| contacts_gautocomplete_address_form | 16.0.1.0.1 | Implementation of widget Google Address Form Autocomplete on Contacts |
| contacts_gautocomplete_address_form_extended | 16.0.1.0.0 | Inherit `"contacts_gautocomplete_address_form"` and add more data to contact from Google Place such as Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus Code URL, and Vicinity |
| contacts_gautocomplete_places | 16.0.1.0.1 | Implementation of widget Google Places Autocomplete on Contacts |
| contacts_gautocomplete_places_extended | 16.0.1.0.0 | Inherit `"contacts_gautocomplete_places"` and add more data to a contact from Google Place such as Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus Code URL, and Vicinity |
| contacts_google_map | 16.0.2.1.3 | Implementation of view "Google map" on Contacts |
| contacts_google_places | 16.0.1.0.2 | Implementation of Google Places in the Google Maps view, allowing users to search for locations in a given area on maps and save them to Contacts. |
| crm_gautocomplete_address_form | 16.0.1.0.0 | Implementation of widget Google Address Form autocomplete on CRM |
| crm_gautocomplete_address_form_extended | 16.0.1.0.0 | Inherit `"crm_gautocomplete_address_form"` and add more data to lead from Google Place such as Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus Code URL, and Vicinity |
| crm_gautocomplete_places | 16.0.1.0.0 | Implementation of widget Google Places Autocomplete on CRM |
| crm_gautocomplete_places_extended | 16.0.1.0.0 | Inherit `"crm_gautocomplete_places"` and add more data to lead from Google Place such as Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus Code URL, and Vicinity |
| crm_google_map | 16.0.1.1.0 | Implementation of view "Google map" on CRM |
| crm_google_places | 16.0.1.0.1 | Implementation of Google Places in the Google Maps view, allowing users to search for locations in a given area on maps and save them as your Lead |
| web_view_google_map | 16.0.4.0.0 | Base module for a new view "google_map" |
| web_view_google_map_drawing | 16.0.2.0.0 | Base module for sub view of "google_map" for drawing capability |
| web_view_google_map_selector_area | 16.0.1.0.0 | An extension feature added to the Google Map view. It allows users to select an area on the map and capture all markers within that area |
| web_widget_google_map | 16.0.1.1.3 | Base module of widget Google Autocomplete |
| web_widget_google_places | 16.0.1.0.0 | Inherit web_widget_google_map and add more data from Google Places fields |


## Usage

Google API Key is a must, you need to configure one if you don't have it yet.
For more details please check this link [https://developers.google.com/maps/documentation/javascript/get-api-key](https://developers.google.com/maps/documentation/javascript/get-api-key)

Please activate the following Services/API for your Google API Key:
1. Geocoding API
2. Maps JavaScript API
3. Places API (optional)


## Notes

These modules are not perfect, please do not hesitate to open an issue if you find one or two.    


If you want to integrate Google Maps with another Odoo module or your own custom module, please don't hesitate to start a discussion or send me an email.