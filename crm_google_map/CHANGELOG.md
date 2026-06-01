<!-- markdownlint-disable MD024 -->
# Change Log

## 19.0.1.0.9

### Added

- **`_compute_customer_geo` test suite**: New `tests/test_compute_customer_geo.py` covering four scenarios — no partner (coordinates reset to `0.0`), address in sync with partner (coordinates inherited), address diverged from partner (coordinates reset to `0.0` for cron pickup), and partner geocoded after lead creation (coordinates update automatically via `partner_id.partner_latitude` / `partner_id.partner_longitude` dependencies).

### Fixed

- **Spurious divergence on empty Char fields in `_compute_customer_geo`**: The inline `all(lead[f] == partner[f] …)` comparison treated `False` and `''` as unequal for Char fields (`street`, `street2`, `city`, `zip`). The ORM may store either depending on the write path, so a lead and its partner that are semantically in sync were incorrectly detected as diverged, resetting coordinates to `0.0` and scheduling an unnecessary cron re-geocode. Extracted the comparison to a `_lead_address_matches_partner` module-level helper that normalises empty strings to `False` before comparing.

### Documentation

- **README**: Removed stale "Google Map Smart Button" feature entry — the action and smart button xpath were already removed in v19.0.1.0.8 but the README was not updated at that time.

## 19.0.1.0.8

### Added

- **Geocoding Cron Job**: New scheduled action `CRM Lead: geolocate` runs every 12 hours and automatically geocodes leads that have address data but no stored coordinates. Rate-limited to one request per second when using the OpenStreetMap provider to avoid hitting API limits. Each result is committed immediately to prevent long transactions.

### Fixed

- **`_get_address_format` decorator bug**: Method had an incorrect `@api.model` decorator which made `self.country_id` always resolve to an empty recordset — per-country address formats were never applied and the default format was always used. Removed the decorator so the method runs in record context.
- **`customer_latitude`/`customer_longitude` precision**: Field precision was `digits=(6, 5)`, allowing only 1 digit before the decimal point. Coordinates above ±9.99999 were silently truncated by PostgreSQL. Changed to `digits=(10, 7)` to match Odoo's standard `partner_latitude`/`partner_longitude` fields. A column migration will run automatically on module upgrade.
- **Incomplete `@api.depends` on `_compute_customer_geo`**: Missing `partner_id.partner_latitude` and `partner_id.partner_longitude` in the dependency list caused `customer_latitude`/`customer_longitude` to go stale when the linked partner's coordinates changed without the lead being re-saved. Added the missing dot-notation dependencies.

### Improved

- **Geocoding failure notification**: `geo_localize` now sends a bus danger notification listing all lead names that could not be geocoded, instead of silently ignoring failures.
- **Sidebar stage field**: Stage field in the sidebar record card is no longer clickable (`pe-none` added to the wrapper div).
- **Geocoding cron domain**: Rewrote the `action_cron_geolocalize` search domain using `Domain.OR` / `Domain.AND` for readability; replaced ambiguous `= False` comparisons on Float fields with explicit `= 0.0`.

### Removed

- **"Google Map" smart button on lead form**: Removed `action_view_crm_lead_google_map` action and the associated smart button xpath from the form view.

## 19.0.1.0.7

- [Improved] **Sidebar Extra Content — Hook Migration**: Replaced the `RecordItem` primary template inheritance (`t-inherit-mode="primary"` with an xpath) with the new `recordExtraTemplate` hook introduced in `web_view_google_map` v1.0.22; `GoogleMapSidebarCRM` now sets `static recordExtraTemplate = 'crm_google_map.RecordItemExtra'` instead of overriding `recordItemTemplate`
- [Improved] **`RecordItemExtra` Template**: Rewrote the extra content template as a standalone `<t t-name="crm_google_map.RecordItemExtra">` block (no xpath); restructured the amount/stage row with dedicated `o_crm_sidebar_extra`, `o_crm_sidebar_amount`, and `o_crm_sidebar_stage` CSS classes; changed `expected_revenue` field class to `'smaller font-monospace'` and added `text-muted` directly to the dollar icon
- [Improved] **SCSS Dialog Selector**: Narrowed selector from `.o_google_map_renderer, .o_dialog` to `.o_google_map_renderer, .o_google_map_renderer .o_dialog` to avoid unintended style leakage into unrelated dialogs
- [Added] **`google_map_sidebar.scss`**: New stylesheet for CRM sidebar extra content — constrains `.o_crm_sidebar_extra` with `overflow: hidden` and `gap: 4px`; `.o_crm_sidebar_amount` uses `flex: 0 1 auto` with ellipsis truncation; `.o_crm_sidebar_stage` takes remaining flex space (`flex: 1 1 0`) with right-aligned text and deep truncation rules on `.o_field_widget` and its children, preventing the two-row amount/stage layout from overflowing the sidebar and pushing action buttons off-screen

## 19.0.1.0.6

### Fixed

- **Expanded Marker Z-Index**: Expanded markers now render above all other markers; raised `HOVER` z-index from `1` to `1000` on the `AdvancedMarkerElement` and added `z-index: 1000` to the `.highlight` CSS state

### Improved

- **Marker Tip**: Replaced the CSS border-triangle tip with a rotated square using `border-right`/`border-bottom`, giving the tip a proper bordered outline that matches the marker card border
- **Marker Icon Size**: Reduced handshake icon from `fa-2x` to `fa-lg` for a more proportional compact marker
- **SCSS Cleanup**: Removed all vendor prefixes (`-webkit-`, `-moz-`, `-ms-`, `-o-`) from transforms, transitions, box-shadows, and animations; moved `@keyframes markerDrop` to top-level scope; switched `transition: all` to explicit property list to avoid unintended transitions

## 19.0.1.0.5

### Fixed

- **Marker Click Event**: Changed marker click listener from deprecated `'click'` to `'gmp-click'` for `AdvancedMarkerElement` compatibility

## 19.0.1.0.4
### Improved
- **Marker Responsiveness**: Enhanced marker sizing with flexible dimensions using min/max constraints
- **Highlight Marker Layout**: Added padding and improved height constraints for better content display

### Technical Details
- Changed marker width from fixed `55px` to flexible `min-width: 55px` and `max-width: 400px`
- Changed marker height from fixed `50px` to flexible `min-height: 50px`
- Added `padding: 12px` to highlighted markers for better spacing
- Changed highlighted marker height from fixed `175px` to flexible `min-height: 175px`

## 19.0.1.0.3
### Enhanced Marker Interaction & UI/UX
- Implemented toggle-based marker interaction replacing hover behavior
- Redesigned markers to display as compact circular icons by default, expanding on click to show full details
- Added handshake icon to markers with dynamic color based on marker color
- Improved marker click behavior with better event handling and stopPropagation
- Simplified Z-index management for better marker layering
- Enabled marker clustering (removed disable_cluster_marker attribute)

### UI Improvements
- Added expected revenue display in sidebar alongside stage information
- Restructured marker content layout with better organization (icon, content sections)
- Enhanced marker styling with improved transitions and visual feedback
- Adjusted overlap indicator positioning for better visibility
- Improved selected marker border styling
- Updated shadow and border effects for better visual hierarchy

### Code Quality
- Removed deprecated hover event listeners (mouseenter, mouseleave, touchstart, touchend)
- Eliminated _attachCRMMarkerEventListeners and _createCRMEventListeners methods
- Simplified marker creation and event handling logic
- Improved code organization and maintainability

## 19.0.1.0.2
Fix bug when editing geolocation in a pop-up form view.

## 19.0.1.0.1
- Improved marker layout
- Simplified sidebar list view, detailed information is now handled directly through the marker.

## 19.0.1.0.0
Migration to version 19.0
