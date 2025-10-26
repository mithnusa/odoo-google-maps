# CRM Google Autocomplete

## Overview

The `crm_google_autocomplete` module adds Google Places autocomplete functionality to the Lead/Opportunity form. It enhances the company name and street fields with Google Places autocomplete, making it faster to fill in lead and opportunity information with accurate address data.

## Features
- Autocomplete for Lead/Opportunity company name and street fields using Google Places API
- Automatic population of address fields (street, city, state, zip, country) based on selected place
- Configurable field mappings between Google Places data and Odoo Lead/Opportunity fields

## Installation & Configuration

1. Install the module (depends on `crm` and `web_widget_google_place_autocomplete`)
2. Configure your Google Maps API key in `Settings > General Settings > Google Maps`
3. The module automatically configures Google Place mapping for CRM during installation
4. Open a Lead/Opportunity form and start typing in the company name or street field to see autocomplete suggestions
5. Places API (New) must be enabled in your Google Cloud Console for the autocomplete functionality to work properly.