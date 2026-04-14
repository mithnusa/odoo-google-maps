# Partner Autocomplete with Google Autocomplete - Features

## Combined Widget on Partner Name Field

### Automatic Widget Replacement
**What it does**: Replaces the `name` field widget on all `res.partner` form views with the combined partner + Google Places autocomplete widget, without requiring any view XML modifications.

**Why it matters**: The enhancement applies globally to every partner form — including those in Contacts, Sales, CRM, and any other module — without needing per-module view inheritance.

**How it works**: Overrides `_get_view()` on `res.partner` to find every `<field name="name">` node in form views and swap its widget to `field_partner_autocomplete_with_google_place` at render time.

---

### Google Places Toggle Panel
**What it does**: Adds a collapsible Google Places autocomplete panel beneath the name field, opened and closed via a Google icon toggle button.

**Why it matters**: Keeps the form uncluttered by default — the Google Places input is hidden until explicitly requested, so it does not interrupt the standard workflow.

**How it works**: The toggle button uses Bootstrap collapse to show or hide the panel. On first open, the widget fetches the mapping configuration from the backend. The panel renders `GooglePlaceAutocompleteElement` when a valid mapping is found, a loading spinner while fetching, or an error message if no mapping configuration exists.

---

## Automatic Field Population

### Address Fields Auto-Fill
**What it does**: When a place is selected from the Google autocomplete panel, the partner's address fields are filled in automatically: street, street2, city, state, zip, and country.

**Why it matters**: Eliminates manual address entry after selecting a place, and ensures address components are correctly structured in separate Odoo fields.

**How it works**: The widget calls `record.update()` with all mapped field values in a single atomic write, preventing intermediate re-renders. Only fields that exist on the current record model are written; unknown keys from the mapping are silently ignored.

---

### Geolocation Auto-Fill
**What it does**: Stores the selected place's latitude and longitude on the partner record automatically.

**Why it matters**: Partners get accurate geolocation data immediately after selection, so they appear correctly on map views without a separate geocoding step.

**How it works**: The geolocation values from the mapping configuration are merged with the address values into the same `record.update()` call.

---

### Place Details Auto-Fill (Places Mode)
**What it does**: In places mode, selecting a business also populates the partner's phone and website fields in addition to the address and coordinates.

**Why it matters**: A single autocomplete selection can populate multiple fields across the form, reducing the amount of manual research needed.

**How it works**: The widget checks `mappingConfig.mode`. When it is `'places'`, the `data.other` values (containing fields like phone and website) are merged into the update alongside address and geolocation data.

---

## Widget Options

### No Manual Edit Mode
**What it does**: When the `no_manual_edit` option is set, the name input field becomes read-only, preventing direct typing and requiring users to select from the autocomplete.

**Why it matters**: Useful when data consistency is important and free-text entry in the name field should be discouraged in favour of verified Google Places or Odoo partner data.

**How it works**: A `useEffect` hook sets the `readonly` attribute on the input element and adds a tooltip explaining the restriction when `noManualEdit` is true and the field is not already in readonly mode. The attribute is removed on cleanup.

---

### Mapping Configuration Validation
**What it does**: Validates that the widget has a valid mapping configuration before rendering the Google Places input, and shows a clear error if it does not.

**Why it matters**: Prevents silent failures — if the mapping for `res.partner` is missing, users see an explicit message rather than a non-functional input.

**How it works**: On panel open, the widget calls `validateProps()` to check that either `mappingCode` or `mappingMode` is provided, then fetches the mapping config. If the response has no valid `id`, `mappingId` is set to `-1` and the panel renders an error message instead of the autocomplete input.
