# Partner Autocomplete with Google Autocomplete

## Overview

The `partner_autocomplete_with_google_autocomplete` module integrates Google Places autocomplete with Odoo's partner autocomplete feature. It enhances the partner creation experience by combining Odoo's standard partner autocomplete with Google Places data.

## Features
- Enhanced partner autocomplete using Google Places API
- Automatic population of address fields (street, city, state, zip, country) based on selected place
- Seamless integration with Odoo's existing partner autocomplete functionality

## Installation & Configuration

1. Install the module (depends on `partner_autocomplete` and `contacts_google_autocomplete`)
2. Configure your Google Maps API key in `Settings > General Settings > Google Maps`
3. Use the partner autocomplete feature in forms - it will now be enhanced with Google Places data
4. Create new partners more easily with accurate address information from Google Places
5. Places API (New) must be enabled in your Google Cloud Console for the autocomplete functionality to work properly.
