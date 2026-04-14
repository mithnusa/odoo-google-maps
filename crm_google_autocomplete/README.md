# CRM Google Places Autocomplete

## Overview

This module adds Google Places autocomplete to the Lead/Opportunity form in Odoo CRM. It enhances the company name and street fields so that typing a business name or address shows suggestions from Google, and selecting one automatically fills in the lead's full address and coordinates.

## What It Does

Replaces the standard company name and street inputs on the Lead/Opportunity form with Google Places autocomplete fields. When a user selects a suggestion, the lead's address fields (street, city, state, zip, country) and geolocation (latitude, longitude) are filled in automatically. When a business is selected from the company name field, the phone and website fields are also populated.

## Key Features

- **Company Name Autocomplete**: The `partner_name` field shows Google Places suggestions as the user types (places mode), applied to both the quick-entry group and the detailed lead tab
- **Street Field Autocomplete**: The `street` field shows address and route suggestions from Google (address mode, restricted to streets and routes), also applied in both locations
- **Full Address Auto-Fill**: Selecting a suggestion populates street, street2, city, state, zip, and country automatically
- **Geolocation Auto-Fill**: Lead latitude (`customer_latitude`) and longitude (`customer_longitude`) are stored automatically from the selected place's location data
- **Company Details Auto-Fill**: Selecting a business from the company name field also fills in phone and website
- **Auto-Configured on Install**: Field mappings between Google Places data and Odoo Lead fields are created automatically during installation — no manual setup required

## Dependencies

- `crm`
- `web_widget_google_place_autocomplete`

## Installation

1. Install the module through Odoo Apps
2. Configure your Google Maps API Key in Settings → General Settings → Google Maps
3. Ensure the Places API (New) is enabled in your Google Cloud Console

## Basic Usage

Open any Lead or Opportunity form. The company name and street fields now have Google autocomplete — start typing to see suggestions. Select a suggestion to auto-fill the address and other available details.

## Related Modules

- `web_widget_google_place_autocomplete`: Provides the autocomplete widget and field mapping configuration
- `crm_google_map`: Adds a Google Map view for CRM Leads and Opportunities
