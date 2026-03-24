# Contacts - Google Maps: Click to Add Place — Features

## Map Click Interaction

### Click on a Named Google Place
**What it does**: Clicking a marker or area that corresponds to a known Google Place (a business, landmark, or point of interest) fetches that place's full details from Google and opens an Odoo contact form pre-filled with the data.

**Why it matters**: Eliminates manual data entry — name, address, phone number, and website are populated automatically, reducing errors and saving time.

**How it works**: When the map is zoomed in sufficiently, a click event with a Place ID triggers a call to the Google Places API (New). The returned data — display name, address components, phone number, website URL, and coordinates — is mapped to the corresponding Odoo partner fields and presented in a quick-create popup form.

---

### Click on Any Map Location (Reverse Geocoding)
**What it does**: Clicking anywhere on the map that is not a named Google Place (an intersection, a building, an unmarked address) resolves the geographic coordinate to a street address and opens a pre-filled contact form.

**Why it matters**: Allows contact creation for locations that don't have a Google listing, such as warehouses, private residences, or newly built addresses.

**How it works**: The clicked coordinate is passed to the Google Geocoding API. The first result's address components are parsed and mapped to Odoo partner fields (street, city, postal code, state, country, and coordinates) before the popup form opens.

---

## Duplicate Prevention

### Existing Contact Detection
**What it does**: Before opening a new contact form, the module checks whether a contact with the same Google Place ID already exists in Odoo. If one is found, that existing contact's form opens instead.

**Why it matters**: Prevents creating duplicate contacts for the same location when the same place is clicked more than once.

**How it works**: The Google Place ID from the click event is looked up against the `gplace_id` field on `res.partner`. A match opens the existing record in edit mode; no match proceeds to the new-contact form.

---

## Google Place ID on Contacts

### Place ID Storage
**What it does**: Saves the Google Place ID on every contact created through this module.

**Why it matters**: Creates a permanent link between the Odoo contact and its exact Google Maps location, enabling future deduplication and potential map-based lookups.

**How it works**: A new `gplace_id` field (indexed, not copied on duplicate) is added to `res.partner`. It is populated automatically when a contact is created from a named Google Place; contacts created via reverse geocoding also receive the geocoded Place ID when one is available in the API response.

---

## Address Mapping

### Structured Address Population
**What it does**: Translates Google's address component format into Odoo's address fields: street, street2, city, postal code, state, and country.

**Why it matters**: Produces correctly structured addresses in Odoo rather than a single unformatted text string, making contacts immediately usable for shipping, reporting, and filtering.

**How it works**: Address components returned by the Places API or Geocoding API are mapped to Odoo fields using a priority-ordered lookup. Country and state are resolved to their Odoo record IDs via code and name matching. For named places, the adr microformat string is used as the primary source for street formatting, which correctly handles number-before-street ordering across locales.

---

## Visual Indicator

### Map Activity Indicator
**What it does**: Displays a small button control in the top-right corner of the map that changes appearance based on whether click-to-create is currently active.

**Why it matters**: Gives users immediate visual feedback so they know when zooming in further is needed before clicking.

**How it works**: The indicator starts neutral (grey). When the map zoom level reaches or exceeds the required threshold, the button turns green and animates. The button includes a tooltip explaining the zoom requirement. The indicator is automatically removed from the map when the component is unmounted.

---

## Post-Save Behaviour

### Automatic Map Refresh and Notification
**What it does**: After the user saves the contact form, the map view reloads automatically and a notification appears confirming whether a new contact was created or an existing one was updated.

**Why it matters**: Keeps the map in sync with the database without requiring a manual page reload, and provides a direct link to open the saved contact.

**How it works**: The `onSave` callback from the Odoo action framework triggers a reload of the map view's record set and calls `model.notify()` to re-render the map markers. An info notification with an "Open" button is shown for both create and update operations.
