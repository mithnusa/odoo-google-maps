# Web Widget Google Place Autocomplete

The `web_widget_google_place_autocomplete` module provides a new widget implementation using Google's NEW Places API. It offers enhanced autocomplete functionality with improved address mapping capabilities and configurable field mappings per country through a dedicated configuration interface.

This widget give you full control over how Google Places data is mapped to your Odoo model fields, allowing for a more tailored and accurate data entry experience.


<div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 50px;">
  <img src="static/img/google_fields_mapping.png" alt="Google Fields Mapping" style="width: 50%; max-width: 300px; height: auto;">
  <img src="static/img/mapping_test.png" alt="Google Places Autocomplete Mapping test" style="width: 50%; max-width: 300px; height: auto;">
</div>

You can also access the mapping configuration quickly via the shortcut button next to the autocomplete input field in the form view.
<div style="display: flex; gap: 4px; justify-content: center;">
  <img src="static/img/shortcut_to_access_the_mapping.png" alt="Quick access to mapping configurationn" style="width: 50%; max-width: 300px; height: auto;">
</div>

### Installation & Configuration

1. Configure your Google Maps API key with the NEW Places API enabled in `Settings > General Settings > Google Maps`
2. Configure your mappings in `Settings > Technical > Google Places Mapping`
3. Use the widget in your custom forms by specifying the appropriate widget in XML views
4. Places API (New) must be enabled in your Google Cloud Console 

## Authors
- [Yopi Angi](https://www.github.com/gityopie)
