# Change Log

## 1.0.0 - Initial Release

- **Abstract Model Mixin**: Added `google.map.add.place.partner.mixin` with `gplace_id` field and core click-to-create logic reusable across any Odoo model
- **Places API Integration**: `action_in_map_google_place_create` method fetches place name, address components, phone, website, and coordinates from the Google Places API (New) and returns a pre-populated quick-create form action
- **Reverse Geocoding**: `action_in_map_google_place_from_reverse_geocode` method maps Geocoding API results to Odoo partner fields and returns a pre-populated form action
- **Address Mapping**: `_mapping_address` resolves Google address components to Odoo fields (street, street2, city, zip, state_id, country_id) with country/state resolved to Odoo record IDs
- **ADR Microformat Parser**: `_parse_adr_format_address` extracts structured address components from the HTML adrFormatAddress field returned by the Places API
- **Formatted Address Parser**: `_parse_formatted_address` parses plain-text Geocoding API addresses with support for standard, short, and Russian/CIS formats and multi-country postal code patterns
- **Duplicate Detection**: Checks for an existing record with the same `gplace_id` before opening a create form; opens the existing record instead
- **InMapClickAddPlace Component**: OWL component that registers a map click listener and triggers the appropriate workflow (Places API or reverse geocode) when zoom ≥ 15
- **Visual Indicator**: Map control injected into the RIGHT_TOP corner that turns green and animates when the feature is active, with a tooltip explaining how to use it
- **Post-Save Reload**: Map view reloads automatically after saving, and shows a notification with an "Open" button linking to the saved record
