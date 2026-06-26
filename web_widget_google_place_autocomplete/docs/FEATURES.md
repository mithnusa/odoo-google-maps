# Web Widget Google Place Autocomplete - Features

## Widget

### `gplace_autocomplete_el` Widget
**What it does**: Extends the standard Char field with a Google Places autocomplete panel. When a user selects a suggestion, all mapped fields on the record are populated in a single atomic write.

**Why it matters**: Replaces manual address entry with verified Google Places data, ensuring address fields are correctly structured and coordinates are stored without a separate geocoding step.

**How it works**: The widget extends Odoo's `CharField`. It accepts `mapping_code` or `mapping_mode` as options. On first open, it fetches the matching mapping configuration from the backend, then renders `GooglePlaceAutocompleteElement`. When a place is selected, the widget calls `record.update()` with all mapped field values at once — address components, geolocation, and any other mapped fields.

---

### Two Autocomplete Modes
**What it does**: Supports two distinct suggestion modes: `places` (businesses, landmarks, and addresses) and `address` (street addresses and routes only).

**Why it matters**: Allows the widget to be tuned to the field's purpose — a company name field benefits from `places` mode, while a street field benefits from `address` mode with narrower suggestions.

**How it works**: The mode is set in the mapping configuration and passed to `PlaceAutocompleteElement` via `includedPrimaryTypes` or the `address` type restriction. The `address` mode defaults to fetching only `addressComponents` and `location` to minimise API cost.

---

### No Manual Edit Mode
**What it does**: When the `no_manual_edit` option is set, the Char input becomes read-only, preventing free-text entry and requiring users to select from Google Places suggestions.

**Why it matters**: Enforces data consistency when free-text entries in a field should be avoided — for example, a company name field that must resolve to a real Google Place.

**How it works**: A `useEffect` hook sets the `readonly` attribute on the input element and adds a tooltip explaining the restriction when `noManualEdit` is true and the field is not already in readonly mode. The attribute is removed on cleanup.

---

## Mapping Configuration

### Google Places Mapping Model
**What it does**: Provides a dedicated configuration record (`google.places.mapping`) that defines how Google Places API data maps to fields on a specific Odoo model.

**Why it matters**: Decouples the widget from hardcoded field names, making the same widget reusable across any model without code changes. Each model gets its own mapping tailored to its field structure.

**How it works**: Each mapping record stores a unique `code`, the target `model_id`, the autocomplete `mode`, optional `PlaceAutocompleteElement` options, and the list of fields to fetch from the API. The widget looks up the mapping by code or by mode + model at render time.

---

### Address Field Mapping
**What it does**: Maps individual Google address components (route, street number, city, state, postal code, country) to Odoo fields on the target model.

**Why it matters**: Address data from Google comes as structured components. The mapping controls how those components are combined and which Odoo fields they populate — including configurable separators for multi-component fields.

**How it works**: Each `google.places.mapping.address.line` record links a Google address component type to an `ir.model.fields` entry. A `separator` field (space, comma, hyphen, etc.) controls how multiple components are joined when writing to a single Odoo field. Relational fields (`Many2one`) for country and state are resolved automatically by name.

---

### Other Field Mapping
**What it does**: Maps non-address place data — such as display name, international phone number, and website URI — to additional Odoo fields.

**Why it matters**: Allows a single autocomplete selection to populate fields beyond the address block, such as a partner's phone and website, without requiring a second API call.

**How it works**: Each `google.places.mapping.other.line` record maps a named Google Places data key (e.g. `internationalPhoneNumber`, `websiteURI`) to an `ir.model.fields` entry. These values are merged with address data in the same `record.update()` call. The mapping validates that no field appears in both the address and other sections.

---

### Geolocation Storage
**What it does**: Each mapping configuration designates two Float fields on the target model to receive the selected place's latitude and longitude.

**Why it matters**: Coordinates are stored automatically when a place is selected, so records appear correctly on map views without a separate geocoding step.

**How it works**: The mapping record has `latitude` and `longitude` Many2one fields pointing to `ir.model.fields`. Their values are extracted from the place's `location` data and merged into the same atomic `record.update()` call as the address fields.

---

### Configuration Validation Warnings
**What it does**: Shows inline alert banners on the mapping configuration form when required fetch fields are missing from the configured list.

**Why it matters**: A common misconfiguration is forgetting to include `addressComponents` or `location` in the fetch fields while having address or geolocation mappings defined. The warnings catch this at configuration time rather than silently returning empty data at runtime.

**How it works**: Two computed fields — `is_address_component_missing` and `is_location_field_missing` — re-evaluate whenever the fetch fields or geolocation fields change. If `addressComponents` is absent while address mapping lines exist, a warning alert appears above the mapping sections. If `location` is absent while `latitude` or `longitude` fields are configured, a second alert is shown.

---

### Mapping Test Tool
**What it does**: A built-in test field on the mapping configuration form lets administrators search for a real place and see the exact parsed data that would be written to the record.

**Why it matters**: Verifies the mapping is correct before applying it to production forms, without needing to open a live form and risk corrupting data.

**How it works**: The `GooglePlaceMappingTestField` widget renders a live `GooglePlaceAutocompleteElement` on the mapping form. Selecting a place shows a dialog with the parsed address mapping, other mapping, geolocation, and raw place JSON — using the current mapping configuration's settings.

---

## Country Configuration

### Street Format per Country
**What it does**: A "Street Format" field on each country record controls whether street addresses are formatted as "Route + Number" (e.g. "Main Street 123") or "Number + Route" (e.g. "123 Main Street").

**Why it matters**: Street address ordering differs by country. Without this setting, addresses would be formatted in the wrong order for countries that use number-first conventions.

**How it works**: The `google_street_format` selection field (`route_street_number` or `street_number_route`, default: `route_street_number`) is added to `res.country`. When the widget assembles the street value from route and street number components, it reads this field from the resolved country and applies the correct ordering.
