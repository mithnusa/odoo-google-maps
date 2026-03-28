# Base - Google Maps: Add Place from Map Click - Features

## Abstract Model Mixin

### Google Map Add Place Mixin
**What it does**: Provides a reusable abstract model (`google_map.add_place.mixin`) that any Odoo model can inherit to gain click-to-create from Google Maps.

**Why it matters**: Keeps the core logic in one place so multiple application modules (Contacts, CRM, etc.) share the same implementation without duplication.

**How it works**: The mixin exposes two server-side methods called by the frontend component — one for Google Place clicks and one for reverse-geocoded coordinates. Each method maps the API response to Odoo field values and returns an `ir.actions.act_window` that opens a pre-populated quick-create form.

---

### Google Place ID Field
**What it does**: Adds a `gplace_id` (Char) field to any model that inherits the mixin, storing the unique Google Place identifier.

**Why it matters**: Enables duplicate detection — if a record with the same Place ID already exists, the system opens the existing record instead of creating a duplicate.

**How it works**: The field is indexed for fast lookup and is excluded from record copies.

---

## Address Mapping

### Google Places Address Component Mapping
**What it does**: Converts structured Google Places API address components into Odoo partner address fields (street, street2, city, zip, state, country).

**Why it matters**: Saves users from manually typing address details that Google already provides, and handles the differences in address formatting across countries.

**How it works**: Each address component type (e.g. `route`, `locality`, `postal_code`) is mapped to the corresponding Odoo field. Country and state are resolved to their Odoo record IDs via case-insensitive search.

---

### ADR Microformat Parser
**What it does**: Parses the `adrFormatAddress` HTML string returned by the Google Places API into a flat dictionary of address components.

**Why it matters**: The adr microformat often provides better-formatted street addresses (e.g. correct number-before-street order) than the raw address components array.

**How it works**: Uses BeautifulSoup to extract `<span>` elements by class name, producing keys like `street-address`, `locality`, `postal-code`, `region`, and `country`.

---

### Reverse Geocode Address Parser
**What it does**: Parses a plain-text `formatted_address` string from the Google Geocoding API into structured address components.

**Why it matters**: Reverse geocoding results do not include the richer adr microformat, so a fallback parser handles the most common international address patterns.

**How it works**: Splits the address on commas and applies pattern matching to detect standard (US/UK), short (3-segment), and Russian/CIS (digit-last) formats. Postal codes are extracted using locale-aware regex patterns covering UK, Canadian, Dutch, Irish, and numeric formats.

---

## Frontend Component

### Map Click Listener
**What it does**: Listens for click events on the Google Map and triggers the place creation workflow when the zoom level is at or above 15.

**Why it matters**: Prevents accidental form opens when the map is zoomed out too far and place data would be too coarse to be useful.

**How it works**: The `InMapClickAddPlace` OWL component registers a `click` listener on the map instance. Clicks below the zoom threshold are silently ignored.

---

### Named Place Click (Places API)
**What it does**: When the user clicks a named Google Place (e.g. a business, landmark, or point of interest), fetches its full details from the Places API and opens a pre-populated quick-create form.

**Why it matters**: Users can create records for real-world locations without manually entering any details — name, address, phone, website, and coordinates are all filled in automatically.

**How it works**: The click event carries a `placeId`. The component fetches `addressComponents`, `displayName`, `location`, `websiteURI`, `internationalPhoneNumber`, and `adrFormatAddress` from the Places API (New), then calls the server-side mixin method to build and return an Odoo form action.

---

### Empty Map Click (Reverse Geocoding)
**What it does**: When the user clicks on empty map space (no named place), reverse-geocodes the coordinate via the Google Geocoding API and opens a form pre-filled with the resolved address and coordinates.

**Why it matters**: Allows users to create records for any geographic location, not just named places in Google's database.

**How it works**: The component calls `google.maps.Geocoder.geocode()` with the clicked `LatLng`, takes the first result, and passes it to the server-side mixin method for address parsing and form action creation.

---

### Visual Activity Indicator
**What it does**: Injects a button control into the map's top-right corner that signals whether map-click-to-create is currently active.

**Why it matters**: Gives users clear visual feedback about when clicking the map will open a form versus doing nothing.

**How it works**: The button starts in a neutral grey state. On every map `idle` event (after pan/zoom settles), the component checks the current zoom level. At zoom ≥ 15 the button turns green and animates; below that threshold it reverts to grey. A tooltip explains how to activate the feature.

---

### Post-Save Map Reload
**What it does**: Automatically reloads the map view after the user saves the quick-create form, so the new or updated record appears on the map immediately.

**Why it matters**: Keeps the map in sync with the database without requiring the user to manually refresh.

**How it works**: The `onSave` callback reloads the map view's root record set and triggers a re-render. A notification with an "Open" button is shown so the user can navigate directly to the saved record.
