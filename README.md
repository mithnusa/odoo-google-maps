# Odoo and Google maps integration

All the modules related to Javascript (views and widgets) are already written using the new Odoo Javascript Framework, [OWL Framework](https://odoo.github.io/owl/)

## Modules

| Module | Description |
|--------|-------------|
| base_google_maps | Base module of Google Maps contains settings to setup Google API Key |
| base_google_places | Base module of Google places, inherit `"base_google_maps"`, contains abstract model to store Google Place data |
| contacts_gautocomplete_address_form | Implementation of widget Google Address Form Autocomplete on Contacts |
| contacts_gautocomplete_address_form_extended | Inherit `"contacts_gautocomplete_address_form"` and add more data to contact from Google Place such as Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus Code URL, and Vicinity |
| contacts_gautocomplete_places | Implementation of widget Google Places Autocomplete on Contacts |
| contacts_gautocomplete_places_extended | Inherit `"contacts_gautocomplete_places"` and add more data to a contact from Google Place such as Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus Code URL, and Vicinity |
| contacts_google_map | Implementation of view "Google map" on Contacts |
| contacts_google_places | Implementation of Google Places in the Google Maps view, allowing users to search for locations in a given area on maps and save them to Contacts. |
| crm_gautocomplete_address_form | Implementation of widget Google Address Form autocomplete on CRM |
| crm_gautocomplete_address_form_extended | Inherit `"crm_gautocomplete_address_form"` and add more data to lead from Google Place such as Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus Code URL, and Vicinity |
| crm_gautocomplete_places | Implementation of widget Google Places Autocomplete on CRM |
| crm_gautocomplete_places_extended | Inherit `"crm_gautocomplete_places"` and add more data to lead from Google Place such as Google Address, Place ID, Place URL, Opening Hours, Types, Global Code, Compound Code, Plus Code URL, and Vicinity |
| crm_google_map | Implementation of view "Google map" on CRM |
| crm_google_places | Implementation of Google Places in the Google Maps view, allowing users to search for locations in a given area on maps and save them as your Lead |
| web_view_google_map | Base module for a new view "google_map" |
| web_view_google_map_drawing | Base module for sub view of "google_map" for drawing capability |
| web_widget_google_map | Base module of widget Google Autocomplete |
| web_widget_google_places | Inherit web_widget_google_map and add more data from Google Places fields |

## Usage

Google API Key is a must, you need to configure one if you don't have it yet.
For more details please check this link [https://developers.google.com/maps/documentation/javascript/get-api-key](https://developers.google.com/maps/documentation/javascript/get-api-key)

Please activate the following Services/API for your Google API Key:
1. Geocoding API
2. Maps JavaScript API
3. Places API


## Notes

These modules are not perfect, please do not hesitate to open an issue if you find one or two.    


If you want to integrate Google Maps with another Odoo module or your own custom module, please don't hesitate to start a discussion or send me an email.