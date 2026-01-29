# Odoo and Google Maps integration

In this version I tried to use the latest version of Google Maps, so it's recommended to use the "beta" version.

Most of the implementation in this modules are inspired from the samples that you can find in the Google Maps Javascript Guide [https://developers.google.com/maps/documentation/javascript](https://developers.google.com/maps/documentation/javascript)


## Modules

| Module | Version | Description |
|--------|---------|-------------|
| [base_google_map](/base_google_map/README.md) | 19.0.1.0.4 | Base module of Google Maps contains settings to setup Google API Key |
| [contacts_google_autocomplete](/contacts_google_autocomplete/README.md) | 19.0.1.0.1 | Implementation of Google Places Autocomplete on Contacts |
| [contacts_google_map](/contacts_google_map/README.md) | 19.0.1.0.3 | Implementation of view "Google Maps" on Contacts |
| [crm_google_autocomplete](/crm_google_autocomplete/README.md) | 19.0.1.0.1 | Implementation of Google Places Autocomplete on CRM Leads/Opportunities |
| [crm_google_map](/crm_google_map/README.md) | 19.0.1.0.4 | Implementation of view "Google Maps" on CRM |
| [partner_autocomplete_with_google_autocomplete](/partner_autocomplete_with_google_autocomplete/README.md) | 19.0.1.0.0 | Implementation of Google Places Autocomplete along with existing Odoo Partner Autocomplete on Contact form |
| [web_view_google_map](/web_view_google_map/README.md) | 19.0.1.0.8 | Base module for a new view "google_map" |
| [web_view_google_map_drawing](/web_view_google_map_drawing/README.md) | 19.0.1.0.9 | Base module for sub view of "google_map" for drawing capability |
| [sale_google_map](/sale_google_map/README.md) | 19.0.1.0.5 | Implementation of view "Google Maps" on Sale Order |
| [stock_google_map](/stock_google_map/README.md) | 19.0.1.0.0 | Implementation of view "Google Maps" on Inventory |
| [web_widget_google_map](/web_widget_google_map/README.md) | 19.0.1.0.2 | Base module of Google Maps widget |
| [web_widget_google_place_autocomplete](/web_widget_google_place_autocomplete/README.md) | 19.0.1.0.2 | Implementation of Google Places Autocomplete Element |


## Usage

Google API Key is a must, you need to configure one if you don't have it yet.
For more details please check this link [https://developers.google.com/maps/documentation/javascript/get-api-key](https://developers.google.com/maps/documentation/javascript/get-api-key)

Map ID is a must to ensure all the functionalities are working.
For more details please check this link [https://developers.google.com/maps/documentation/javascript/map-ids/get-map-id](https://developers.google.com/maps/documentation/javascript/map-ids/get-map-id)

Please activate the following Services/API for your Google API Key:
1. Geocoding API
2. Maps JavaScript API
4. Places API (New)
5. Maps Embed API


## Notes

These modules are not perfect — if you encounter any bugs or unexpected behavior, please don’t hesitate to open an issue.


if you’d like to integrate Google Maps with another Odoo module or your own custom module, feel free to start a discussion or reach out to me by email.
