# Odoo and Google maps integration

All the modules related to Javascript (all new view and new widget created) was already written using the new Odoo Javascript Framework, [OWL Framework](https://odoo.github.io/owl/)

## Modules
---
| Module | Description |
|--------|-------------|
| base_google_maps | Base module of Google map contains settings to setup Google API Key|
| contacts_gautocomplete_address_form | Implementation of widget Google address form autocomplete on Contacts |
| contacts_gautocomplete_places | Implementation of widget Google places autocomplete on Contacts |
| contacts_google_map | Implementation of view "Google map" on Contacts |
| crm_gautocomplete_address_form | Implementation of widget Google address form autocomplete on CRM |
| crm_gautocomplete_places | Implementation of widget Google places autocomplete on CRM |
| crm_google_map | Implementation of view "Google map" on CRM |
| web_view_google_map | Base module for a new view "google_map" |
| web_view_google_map_drawing | Base module for sub view of "google_map" for drawing capability |
| web_widget_google_map | Base module of widget Google Autocomplete |

## Usage
---
Google API Key is a must, you need to configure one if you don't have it yet.
For more details please check this link [https://developers.google.com/maps/documentation/javascript/get-api-key](https://developers.google.com/maps/documentation/javascript/get-api-key)

Please activate the following Services/API for your Google API Key:
1. Geocoding API
2. Maps JavaScript API
3. Places API


## Notes
---
All these modules are not perfect, please do not hesitate to open an issue if you find one or two.    


If you want to integrate Google Maps with another Odoo module or your own custom module, you can start a discussion or send me an email.