# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains Odoo addons for Google Maps integration across multiple modules. It provides Google Maps views, widgets, and services for various Odoo applications including CRM, Contacts, Sales, and Inventory.

## Architecture

### Core Modules Structure
- **base_google_map**: Foundation module containing Google API Key configuration and core utilities
- **base_google_places**: Abstract model for Google Places data storage and API integration
- **web_view_google_map**: Base module for the custom "google_map" view type in Odoo
- **web_view_google_map_drawing**: Extension providing drawing capabilities on Google Maps
- **web_widget_google_map**: Base widgets for Google Maps autocomplete functionality

### Application-Specific Modules
Each Odoo application has dedicated Google Maps integration modules:
- **contacts_***: Google Maps integration for Contacts/Partners
- **crm_***: Google Maps integration for CRM/Leads
- **sale_google_map**: Google Maps integration for Sales Orders
- **stock_google_map**: Google Maps integration for Inventory/Stock

### Naming Conventions
- Modules ending with `_extended` provide additional Google Places data fields
- `gautocomplete_address_form` modules implement address form autocomplete
- `gautocomplete_places` modules implement places autocomplete
- `google_map` modules implement the map view functionality
- `google_places` modules add places search within map views

## Development Commands

### Code Formatting
```bash
black --line-length 79 --skip-string-normalization .
```

### Testing
No specific test framework is configured. Individual modules should be tested through Odoo's standard testing mechanisms.

## Key Technical Concepts

### Google Maps View Architecture
- **google_map_view**: Custom view type that extends Odoo's standard views
- **google_map_renderer**: Renders the actual Google Maps interface
- **google_map_controller**: Handles user interactions and data flow
- **google_map_model**: Manages data state for the map view

### Mixins and Inheritance
- **GoogleMapViewMixins**: Provides common functionality for handling actions, geolocation fields, and form views
- **GooglePlacesMixin**: Abstract model providing Google Places API integration and address mapping

### Address Mapping System
The codebase uses a sophisticated mapping system between Google Places API responses and Odoo fields:
- `_get_mapping_odoo_fields()`: Maps alias fields to actual Odoo field names
- `_get_mapping_component_address()`: Maps Google address components to Odoo address fields
- Component types are mapped using `GOOGLE_PLACES_COMPONENT_FORM` dictionary

### Asset Management
- Frontend assets are organized under `static/src/` directories
- Dark mode assets are handled separately using `web.dark_mode_assets_backend`
- JavaScript components follow Odoo's OWL framework patterns

### Dependencies
All modules depend on core Odoo modules and follow a hierarchical dependency structure:
- base_google_map → web, base_geolocalize
- Application modules → base_google_map or base_google_places
- Extended modules → their corresponding base modules

### API Integration
- Google Maps JavaScript API (latest/beta version recommended)
- Google Places API for location search and details
- Google Geocoding API for address resolution
- Requires proper API key configuration with appropriate service permissions
- Terra Draw library for drawing functionalities on maps

### Configuration Requirements
- Google API Key must be configured through Settings > General Settings
- Map ID is required for full functionality
- Required Google Cloud Platform APIs: Geocoding API, Maps JavaScript API, Places API, Places API (New), Maps Embed API

### JavaScript Architecture
- Uses Odoo's OWL (Odoo Web Library) framework
- Components are organized by functionality (views, widgets, fields)
- Utilizes Google Maps JavaScript API with modern async/await patterns
- Event-driven architecture for map interactions and data updates

## Contribution Guidelines
- Follow the established module structure and naming conventions
- Ensure code is formatted using Black with the specified configuration
- Write clear and concise commit messages


## References
- [Odoo Developer Documentation](https://www.odoo.com/documentation/15.0/developer.html)
- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Terra Draw GitHub Repository](https://github.com/JamesLMilner/terra-draw)
- [Terra Draw Documentation](https://terradraw.io/#/api)
- [Terra Draw Google Maps Adapter]()
- [Owl Framework Documentation](https://github.com/odoo/owl/blob/master/doc/readme.md)