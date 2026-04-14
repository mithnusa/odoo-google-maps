# Contacts Google Autocomplete

## Overview

This module adds Google Places autocomplete to the Contact form in Odoo. It enhances the name and street fields so that typing a business name or address shows suggestions from Google, and selecting one automatically fills in the contact's full address and coordinates.

## What It Does

Replaces the standard name and street inputs on the Contact form with Google Places autocomplete fields. When a user selects a suggestion, the contact's address fields (street, city, state, zip, country) and geolocation (latitude, longitude) are filled in automatically. When a business is selected from the name field, the phone and website fields are also populated.

## Key Features

- **Name Field Autocomplete**: Both name fields in the Contact form header show Google Places suggestions as the user types (places mode)
- **Street Field Autocomplete**: The street field shows address and route suggestions from Google (address mode, restricted to streets and routes)
- **Child Contact Autocomplete**: The same autocomplete applies inside the inline contacts sub-form when adding contacts linked to a company
- **Full Address Auto-Fill**: Selecting a suggestion populates street, street2, city, state, zip, and country automatically
- **Geolocation Auto-Fill**: Latitude and longitude are stored automatically from the selected place's location data
- **Contact Details Auto-Fill**: Selecting a business from the name field also fills in phone and website
- **Auto-Configured on Install**: Field mappings between Google Places data and Odoo Contact fields are created automatically during installation — no manual setup required

## Dependencies

- `contacts`
- `web_widget_google_place_autocomplete`

## Installation

1. Install the module through Odoo Apps
2. Configure your Google Maps API Key in Settings → General Settings → Google Maps
3. Ensure the Places API (New) is enabled in your Google Cloud Console

## Basic Usage

Open any Contact form. The name and street fields now have Google autocomplete — start typing to see suggestions. Select a suggestion to auto-fill the address and other available details.

## Related Modules

- `web_widget_google_place_autocomplete`: Provides the autocomplete widget and field mapping configuration
- `contacts_google_map`: Adds a Google Map view for Contacts
