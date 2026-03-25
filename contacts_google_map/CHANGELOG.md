# Change Log

## 19.0.1.0.5

- [Imp] **Geocoder service**: Changed geocoder service to Nominatim (OpenStreetMap) for automatic contact geolocation
- [Fix] **Nominatim geocoder — rate limit handling**: Improved handling of 429 Too Many Requests; the geocoder now correctly detects a sustained rate limit after a retry and skips the address gracefully instead of raising an unhandled error
- [Imp] **Nominatim geocoder — cron batch size**: Reduced the number of contacts geocoded per cron run from 500 to 50 to prevent cron worker timeout given the required 1-second delay between requests

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
