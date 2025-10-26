# Contact Google Autocomplete

## Overview

The `contacts_google_autocomplete` module adds Google Places autocomplete functionality to the Contact form. It enhances the name and street fields with Google Places autocomplete, allowing users to quickly fill in contact information by selecting from Google Places suggestions.

## Features
- Autocomplete for Contact name and street fields using Google Places API
- Automatic population of address fields (street, city, state, zip, country) based on selected place
- Configurable field mappings between Google Places data and Odoo Contact fields


## Installation & Configuration
1. Install the module (depends on `contacts` and `web_widget_google_place_autocomplete`)
2. Configure your Google Maps API key in `Settings > General Settings > Google Maps`
3. The module automatically configures Google Place mapping for contacts during installation
4. Open a Contact form, a new button added next to the name and street fields. Clicking it will open the Google Places autocomplete input.
5. Places API (New) must be enabled in your Google Cloud Console for the autocomplete functionality to work properly.