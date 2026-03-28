# Change Log

## 1.0.1

- [Refactor] **Mixin Extraction**: Moved `google_map.add_place.mixin` and the `InMapClickAddPlace` OWL component to the new `base_google_map_add_place` module; `contacts_google_map_add_place` now delegates all click-to-create logic to that base layer
- [Updated] **Dependency**: Added `base_google_map_add_place` as a required dependency
- [Updated] **Import Paths**: Updated JS import references in `in_map_click_add_place.js` and `google_map_renderer.js` to point to the new base module
- [Updated] **i18n**: Removed translatable strings now owned by `base_google_map_add_place` from the `.pot` file

## 1.0.0 - Initial Release

- **Click-to-Create from Named Places**: Extended `res.partner` with `google_map.add_place.mixin`; clicking a named Google Place on the Contacts map fetches its details (name, address, phone, website, coordinates) via the Places API and opens a pre-populated quick-create form
- **Click-to-Create from Map Space**: Clicking empty map space reverse-geocodes the coordinate and opens a partner form pre-filled with the resolved address
- **Contacts Field Mapping**: Place name populates `name`, coordinates map to `partner_latitude`/`partner_longitude`, and all standard address fields are pre-filled
- **Duplicate Detection**: If a partner with the same `gplace_id` already exists, the existing record is opened instead of creating a duplicate
- **Renderer Integration**: Patched `GoogleMapRendererContacts` to include the `InMapClickAddPlace` component on the Contacts map view
