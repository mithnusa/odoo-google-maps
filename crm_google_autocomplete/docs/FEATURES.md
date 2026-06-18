# CRM Google Places Autocomplete - Features

## Autocomplete Widgets on Lead Form

### Company Name Autocomplete (Places Mode)
**What it does**: Replaces the plain text company name field on the Lead/Opportunity form with a Google Places autocomplete input that suggests businesses and points of interest as the user types.

**Why it matters**: Sales reps can find and select a company from Google's database instead of manually typing the name, reducing data entry errors and saving time.

**How it works**: The `partner_name` field is enhanced with the `gplace_autocomplete_el` widget in places mode. This applies to both the quick-entry group at the top of the form and the detailed lead tab. Suggestions are fetched from the Google Places API (New) as the user types.

---

### Street Address Autocomplete (Address Mode)
**What it does**: Replaces the plain street field on the Lead/Opportunity form with a Google Places autocomplete input restricted to street addresses and routes.

**Why it matters**: Ensures the entered street address is a real, Google-verified location, reducing typos and incomplete addresses.

**How it works**: The `street` field is enhanced with the `gplace_autocomplete_el` widget in address mode. This applies to both the quick-entry group and the detailed lead tab. Suggestions are filtered to street addresses and route types only.

---

## Automatic Field Population

### Address Fields Auto-Fill from Place Selection
**What it does**: When a user selects a suggestion from the company name or street autocomplete, the lead's address fields are automatically filled in: street, street2, city, state, zip, and country.

**Why it matters**: Eliminates the need to manually enter each address component after selecting a place — one selection completes the whole address.

**How it works**: The module configures a Google Places mapping for `crm.lead` that maps Google Places address components to the corresponding Odoo fields. Street number and route are concatenated into `street`; sub-locality levels are concatenated into `street2`; locality or administrative area level 2 populates `city`; administrative area level 1 populates `state_id`; postal code populates `zip`; and country populates `country_id`.

---

### Geolocation Auto-Fill from Place Selection
**What it does**: When a place is selected from the autocomplete, the lead's latitude and longitude coordinates are automatically stored.

**Why it matters**: Leads get accurate geolocation data without requiring a manual geocoding step, so they appear correctly on the CRM Google Map view immediately after selection.

**How it works**: The mapping configuration links the `customer_latitude` and `customer_longitude` fields to the `location` data returned by the Google Places API.

---

### Company Details Auto-Fill (Places Mode)
**What it does**: When a business is selected from the company name autocomplete, the lead's website and phone fields are also populated automatically in addition to the address fields.

**Why it matters**: A single selection from the autocomplete can fill in multiple contact details, reducing the amount of manual research a sales rep needs to do.

**How it works**: The places-mode mapping fetches `displayName`, `websiteURI`, and `internationalPhoneNumber` from the Google Places API and maps them to `partner_name`, `website`, and `phone` respectively.

---

## Coordinate Preservation

### Google Maps Coordinate Guard

**What it does**: Prevents the lead's latitude and longitude from being reset when an address is updated through the Google Maps autocomplete workflow.

**Why it matters**: Odoo's CRM lead model resets coordinates to `0.0` when the address diverges from the linked partner. Without this guard, selecting a place from autocomplete would first write the coordinates from the Places API and then immediately clear them.

**How it works**: `_compute_customer_geo` is overridden to skip its logic entirely when the `is_from_google_maps` context flag is set, preserving the coordinates that were already written by the autocomplete widget.

---

## Installation-Time Configuration

### Automatic Mapping Setup on Install
**What it does**: When the module is installed, it automatically creates the Google Places mapping records for `crm.lead` — one for places mode (company name field) and one for address mode (street field) — if they do not already exist.

**Why it matters**: The module works out of the box without requiring manual configuration of field mappings after installation.

**How it works**: A post-install hook creates `google.places.mapping` records with all address and other field mappings pre-configured for the `crm.lead` model.
