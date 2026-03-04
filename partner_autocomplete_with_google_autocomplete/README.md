# Partner Autocomplete with Google Autocomplete

The `partner_autocomplete_with_google_autocomplete` module integrates [Google Places Autocomplete Element](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new) with Odoo's partner autocomplete feature. It enhances the partner creation experience by combining Odoo's standard partner autocomplete with Google Places data.

This module extends `web_widget_google_place_autocomplete`. The widget `partner_autocomplete_with_gplace` is a drop-in replacement for the `gplace_autocomplete_el` widget, inheriting all of its functionality and options.

## Features
- Enhanced partner autocomplete using Google Places API
- Automatic population of address fields (street, city, state, zip, country) based on selected place
- Seamless integration with Odoo's existing partner autocomplete functionality

## Installation & Configuration

1. Configure your Google Maps API key in `Settings > General Settings > Google Maps`
2. Use the partner autocomplete feature in forms - it will now be enhanced with Google Places data
3. Create new partners more easily with accurate address information from Google Places
4. Places API (New) must be enabled in your Google Cloud Console for the autocomplete functionality to work properly.
