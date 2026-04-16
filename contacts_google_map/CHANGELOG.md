# Change Log

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
