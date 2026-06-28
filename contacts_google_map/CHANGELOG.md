# Change Log

## 19.0.1.0.11

### Fixed

- **`sidebarProps` merge order** (`google_map_renderer.js`): Changed `Object.assign({ fieldAvatar }, super.sidebarProps)` to `Object.assign({}, super.sidebarProps, { fieldAvatar })` so base-class sidebar props are no longer silently overwritten if they share a key with the subclass addition.

### Improved

- **Geocoding cron — per-record error isolation** (`models/res_partner.py`): Each contact is now geolocalized inside a `with self.env.cr.savepoint()` block; a failed geocoding is caught, logged as a warning, and skipped so the rest of the batch continues. Previously a single error aborted the entire run.
- **Geocoding cron — universal per-record loop**: All geocoding providers now use the per-partner loop (not just OpenStreetMap). The 1-second rate-limit pause is still applied only when OpenStreetMap is the active provider.
- **Python — Odoo 19 translations** (`models/res_partner.py`): `_()` module-level import replaced with `self.env._()` calls; added `logging` import and `_logger` for cron warning output.
- **Python — Black format** (`models/res_partner.py`): Reformatted with Black (line length 79).
- **XML format** (`data/cron_contact_geolocalize.xml`, `views/res_partner.xml`, templates): Reformatted with self-closing tags; `noupdate="1"` moved to the `<odoo>` root element.
- **`__manifest__.py`**: Removed explicit `installable`, `application`, and `auto_install` keys — these are Odoo defaults and were redundant.

## 19.0.1.0.9

- [Improved] **Geocoding Cron — Address Filter**: Added OR filter on `city`, `zip`, `street`, and `street2` fields so only partners with at least one address component are queued for geocoding; prevents wasting API calls on contacts with only a country set
- [Improved] **Geocoding Cron — Batch Size**: Reduced per-run limit from 500 to 80 records to stay within rate limits and reduce transaction duration
- [Improved] **Geocoding Cron — OpenStreetMap Rate Limiting**: When the active geocoding provider is OpenStreetMap, each partner is geocoded individually with a 1-second sleep and an intermediate `cr.commit()` between calls; avoids Nominatim rate-limit rejections and prevents long-running transactions from timing out
- [Improved] **Geocoding Cron — Default Active**: Changed `active` from `False` to `True` and wrapped the record in `<data noupdate="1">` so the cron is enabled on first install but user changes are preserved on module upgrades
- [Improved] **Geocoding Cron — Interval**: Changed default schedule from every 1 day to every 12 hours so ungeocoded contacts are processed more frequently
- [Removed] **Standalone Google Map Action**: Removed the `action_view_res_partner_google_map` `ir.actions.act_window` record; the map view is accessible through the standard Contacts action and the dedicated action was unused

## 19.0.1.0.8

- [Removed] **`google_map_sidebar.scss`**: Deleted the module-level sidebar stylesheet — the `max-width` media query overrides for `.o_map_sidebar_record.with_avatar` (220px / 160px / 1600px, 140px / 1200px breakpoints) are no longer needed now that `web_view_google_map` v1.0.23 controls text clipping via the `o_sidebar_content_cell` auto table layout

## 19.0.1.0.7

- [Fixed] **Coordinate Preservation on Address Change**: Added `_delete_coordinates` override on `res.partner` that skips the coordinate-clearing logic when `is_from_google_maps` is present in the context; prevents Odoo's enterprise `_delete_coordinates` from wiping the latitude/longitude just set by the Google Maps place selection workflow; falls back gracefully to `super()._delete_coordinates()` on community edition where the method does not exist

## 19.0.1.0.6

- [Improved] **Sidebar CSS Selector**: Updated SCSS selector from `.o_map_right_sidebar` to `.o_map_left_sidebar` and narrowed the dialog scope from `.o_dialog` to `.o_google_map_renderer .o_dialog`, matching the sidebar rename in `web_view_google_map` v1.0.22
- [Fixed] **Avatar Rendering**: Wrapped the avatar `<img>` in `<t t-if="avatar_url">` instead of a `<div class="d-inline-block ...">` wrapper, so the image element is only rendered when an avatar URL is available; removes the empty placeholder div that was always present even for contacts without a photo

## 19.0.1.0.5

- [Fixed] **Sidebar Record Name — Wide Screen Clipping**: Added `max-width: 220px` as a base rule on `.o_map_sidebar_record.with_avatar` to cover viewports wider than 1600px; without this, the name column had no width cap at that breakpoint, causing the table layout algorithm to squeeze the action buttons (map marker, Nearby, Open) off the right edge where they were hidden by `overflow-x: hidden`

## 19.0.1.0.4

- [Added] **Nearby Contacts Search**: Added `action_nearby_search()` method on `res.partner` that opens the Contacts map view filtered to contacts within a configurable radius of the selected contact's location; supports antimeridian wraparound and passes bounding box context for map overlay visualization
- [Added] **Bounding Box Helpers**: Added `_compute_bounding_box()` and `_compute_bounding_box_domain()` utility methods for geospatial proximity calculations; latitude is clamped to ±90°, longitude wraparound at ±180° is handled by splitting into OR domain clauses
- [Added] **Nearby Contacts Button**: Added "Nearby Contacts" button (with location-arrow icon) to the contact form's button box, visible only when the contact has geolocation coordinates
- [Docs] **README**: Rewrote `README.md` to follow project documentation template — added Overview, What It Does, Key Features, Dependencies, Installation, Basic Usage, and Related Modules sections
- [Docs] **Features Reference**: Created `docs/FEATURES.md` with detailed descriptions of all module features: Google Map View for Contacts, Contact Avatars, Marker Color Customization, Nearby Contacts Search, Embedded Map in Contact Form, and Automatic Geocoding Cron

## 19.0.1.0.3

### Improved

- **Form View UI**: Removed redundant "Google Maps" group label in geo_location page for cleaner interface

## 19.0.1.0.2

Fix bug when editing geolocation in a pop-up form view.

## 19.0.1.0.1

Fix field marker color placement in contact form view.

## 19.0.1.0.0

Migration to version 19.0.
