# Contacts Google Map

## Overview

The `contacts_google_map` module adds Google Maps view to the Contacts application. It allows you to visualize your contacts' locations on an interactive Google Map, making it easy to see geographical distribution, enhancing usability and efficiency when managing contacts.    
Users can now select record(s) directly from the map interface by holding the Shift key and using the mouse pointer to draw a rectangle. Any markers within the rectangle will be selected.

## Features
- Interactive Google Map view for Contacts with clustering and sidebar
- Quick actions from the map sidebar to open contact records
- Shift + drag to select multiple contacts directly from the map

## Installation & Configuration

1. Install the module (depends on `base_geolocalize`, `contacts`, `web_view_google_map`, and `web_widget_google_map`)
2. Configure your Google Maps API key in `Settings > General Settings > Google Maps`
3. Navigate to `Contacts` and switch to the Google Map view
4. The module includes an automatic geocoding cron job (inactive by default) to update contact locations
