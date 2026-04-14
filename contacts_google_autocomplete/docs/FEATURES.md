# Contacts Google Autocomplete - Features

## Autocomplete Widgets on Contact Form

### Contact Name Autocomplete (Places Mode)
**What it does**: Replaces the plain name fields in the Contact form header with Google Places autocomplete inputs that suggest businesses and points of interest as the user types.

**Why it matters**: Users can find and select a contact or company directly from Google's database instead of typing the name manually, reducing data entry errors.

**How it works**: Both name fields in the form header (individual name and company name) are enhanced with the `gplace_autocomplete_el` widget in places mode. Suggestions are fetched from the Google Places API (New) as the user types.

---

### Street Address Autocomplete (Address Mode)
**What it does**: Replaces the plain street field on the Contact form with a Google Places autocomplete input restricted to street addresses and routes.

**Why it matters**: Ensures the entered street address is a real, Google-verified location, reducing typos and incomplete addresses.

**How it works**: The `street` field is enhanced with the `gplace_autocomplete_el` widget in address mode. Suggestions are filtered to street addresses and route types only.

---

### Autocomplete on Contact Sub-Form (Child Contacts)
**What it does**: The name and street autocomplete widgets also apply inside the inline contact sub-form used when adding or editing contacts within a company record.

**Why it matters**: Users get the same autocomplete experience whether they are editing a top-level contact or filling in a contact linked to a company, without switching to a separate form.

**How it works**: The view inheritance adds the `gplace_autocomplete_el` widget to both the `name` and `street` fields inside the `child_ids` inline form on the Contact form.

---

## Automatic Field Population

### Address Fields Auto-Fill from Place Selection
**What it does**: When a user selects a suggestion from the name or street autocomplete, the contact's address fields are automatically filled in: street, street2, city, state, zip, and country.

**Why it matters**: Eliminates the need to manually enter each address component after selecting a place — one selection completes the whole address.

**How it works**: The module configures a Google Places mapping for `res.partner` that maps Google Places address components to the corresponding Odoo fields. Street number and route are concatenated into `street`; sub-locality levels are concatenated into `street2`; locality or administrative area level 2 populates `city`; administrative area level 1 populates `state_id`; postal code populates `zip`; and country populates `country_id`.

---

### Geolocation Auto-Fill from Place Selection
**What it does**: When a place is selected from the autocomplete, the contact's latitude and longitude coordinates are automatically stored.

**Why it matters**: Contacts get accurate geolocation data without a manual geocoding step, so they appear correctly on the Contacts Google Map view immediately after selection.

**How it works**: The mapping configuration links `partner_latitude` and `partner_longitude` to the `location` data returned by the Google Places API.

---

### Contact Details Auto-Fill (Places Mode)
**What it does**: When a business is selected from the name autocomplete, the contact's website and phone fields are also populated automatically in addition to the address fields.

**Why it matters**: A single selection from the autocomplete can fill in multiple contact details, reducing the amount of manual lookup a user needs to do.

**How it works**: The places-mode mapping fetches `displayName`, `websiteURI`, and `internationalPhoneNumber` from the Google Places API and maps them to `name`, `website`, and `phone` respectively.

---

## Installation-Time Configuration

### Automatic Mapping Setup on Install
**What it does**: When the module is installed, it automatically creates the Google Places mapping records for `res.partner` — one for places mode (name fields) and one for address mode (street field) — if they do not already exist.

**Why it matters**: The module works out of the box without requiring manual configuration of field mappings after installation.

**How it works**: A post-install hook creates `google.places.mapping` records with all address and other field mappings pre-configured for the `res.partner` model.
