# Odoo and Google Maps Integration

This repository provides a suite of Odoo addons that bring Google Maps capabilities into multiple Odoo applications. It covers interactive map views, geographic shape drawing, address autocomplete, and click-to-create workflows — all built on the latest Google Maps JavaScript API.

Most of the implementation is inspired by the samples in the [Google Maps JavaScript Guide](https://developers.google.com/maps/documentation/javascript).

---

## Modules

### Infrastructure

- **[base_google_map](base_google_map/README.md)** `19.0.1.0.9` — Root configuration module. Adds a Google Maps section to General Settings for API Key, Map ID, language, region, color scheme, and nearby search radius. Provides the shared `useGoogleMapsAPILoader` JavaScript API loader used by every other module in this suite.
- **[base_google_map_add_place](base_google_map_add_place/README.md)** `19.0.1.0.1` — Abstract base for the click-to-create workflow. Provides the `google_map.add_place.mixin` Python mixin and the `InMapClickAddPlace` OWL component with zoom threshold logic and smart zoom shortcut. Application modules extend this instead of re-implementing the pattern.
- **[web_view_google_map](web_view_google_map/README.md)** `19.0.1.0.22` — Registers `google_map` as a valid Odoo view type. Provides the full map view stack — controller, model, renderer, sidebar, and search bar — with marker clustering, overlap handling, multi-selection box select, nearby records search, in-map place search, geolocation button, grouped markers, and dark mode support.
- **[web_view_google_map_drawing](web_view_google_map_drawing/README.md)** `19.0.1.0.13` — Extends the map view with geographic shape drawing using [Terra Draw](https://terradraw.io/) (Google's recommended replacement for the deprecated Maps Drawing Library) for editing and [Deck.gl](https://deck.gl/) for GPU-accelerated rendering of large datasets. Includes a `google.drawing.shape` mixin and GeoJSON field type with server-side filtering. All libraries bundled locally.
- **[web_widget_google_map](web_widget_google_map/README.md)** `19.0.1.0.4` — Provides the `google_map` form widget — an embedded Google Maps iframe showing a record's coordinates, with an edit dialog containing a draggable marker and place search for visually updating the location without leaving the form.
- **[web_widget_google_place_autocomplete](web_widget_google_place_autocomplete/README.md)** `19.0.1.0.6` — Provides the `gplace_autocomplete_el` widget and the `google.places.mapping` configuration system. Connects Google Places API (New) to any Odoo Char field. Which fields are populated on selection is fully controlled by mapping records — supporting two autocomplete modes, three component handling modes, configurable separators, relational field auto-resolution, and a live built-in test tool.

### Contacts

- **[contacts_google_autocomplete](contacts_google_autocomplete/README.md)** `19.0.1.0.1` — Applies `gplace_autocomplete_el` to the Contact form's name field (`places` mode) and street field (`address` mode). Populates address fields and coordinates on selection. Mapping configurations for `res.partner` are created automatically on installation.
- **[contacts_google_map](contacts_google_map/README.md)** `19.0.1.0.6` — Adds a Google Map view to the Contacts application with color-coded partner markers. Adds a Geolocation tab to the partner form with an embedded map, geocode button, marker color picker, nearby search, and an optional background geocoding cron job.
- **[contacts_google_map_add_place](contacts_google_map_add_place/README.md)** `19.0.1.0.1` — Activates click-to-create on the Contacts map view. Clicking a named Google Place or empty map location opens a pre-populated partner creation form. Duplicate detection prevents creating a second record for the same Google Place ID.
- **[partner_autocomplete_with_google_autocomplete](partner_autocomplete_with_google_autocomplete/README.md)** `19.0.1.0.3` — Combines Odoo's built-in partner autocomplete with a Google Places toggle panel on the Contact name field, applied to all `res.partner` form views automatically via `_get_view()` — no XML changes required. The Odoo partner autocomplete remains available on the same input.

### CRM

- **[crm_google_autocomplete](crm_google_autocomplete/README.md)** `19.0.1.0.1` — Applies `gplace_autocomplete_el` to the Lead/Opportunity form's company name field (`places` mode) and street field (`address` mode), in both the quick-entry group and the detailed lead tab. Auto-fills address fields and CRM geolocation fields on selection.
- **[crm_google_map](crm_google_map/README.md)** `19.0.1.0.7` — Adds a Google Map view across five CRM menus (All Leads, My Activities, Opportunities, Pipeline, Forecast). Each lead appears as a color-coded marker card with stage, contact, salesperson, revenue, probability, and closing date. The lead form gains a Geolocation tab, geocode button, color picker, and a map smart button.
- **[crm_google_map_add_place](crm_google_map_add_place/README.md)** `19.0.1.0.0` — Activates click-to-create on the CRM map view. Named place clicks create a pre-filled lead with address, phone, website, coordinates, and an auto-generated opportunity name. Empty map clicks reverse-geocode the coordinate. Duplicate detection uses the Google Place ID.

### Sales

- **[sale_google_map](sale_google_map/README.md)** `19.0.1.0.10` — Adds a Google Map view to Quotations, Orders, Orders to Invoice, Orders to Upsell, and Customers in Sales. Groups records by customer — one marker per customer — showing avatar, name, order count, and aggregated order total. Enforces grouping and auto-loads all groups on open.

### Inventory

- **[stock_google_map](stock_google_map/README.md)** `19.0.1.0.0` — Adds a Google Map view across Deliveries, Ready to Transfer, Waiting Transfer, Late Transfers, Backorders, and All Operations in Inventory. Each picking appears as a teal marker at the delivery partner's address, with coordinates sourced automatically from the linked partner.

### Project

- **[project_google_map](project_google_map/README.md)** `19.0.1.0.2` — Adds a Google Map view for Projects and Tasks. Project markers show task counts and completion statistics; a satellite site map is embedded on the project form. Task maps are scoped per project. Status color-coding (on track, at risk, off track, on hold, done) is configurable per project.

---

## Requirements

A Google API Key is required. Configure it under **Settings → General Settings → Google Maps**.
→ [Get a Google Maps API Key](https://developers.google.com/maps/documentation/javascript/get-api-key)

A Map ID is required for full functionality (AdvancedMarkerElement, cloud-based map styling).
→ [Get a Map ID](https://developers.google.com/maps/documentation/javascript/map-ids/get-map-id)

Enable the following APIs in your Google Cloud Console:

1. Maps JavaScript API
2. Places API (New)
3. Geocoding API
4. Maps Embed API

---

## Notes

These modules are not perfect — if you encounter any bugs or unexpected behavior, please open an issue.

If you would like to integrate Google Maps with another Odoo module or your own custom module, feel free to start a discussion or reach out by email.
