# Changelog

## 19.0.2.0.0

- Moved all Google Address Validation API communication server-side into the new `google.address.validation` abstract model (REST `v1:validateAddress`); the widget and dialog remain in JavaScript but no longer call Google directly
- New optional "Address Validation Server Key" setting (referrer-restricted browser keys are rejected by Google for server-side requests)
- `action_apply_google_address_validation` now takes the normalized result + apply flag (breaking change for custom callers)
- Removed the stored Google/USPS standardized address fields and the cache GC cron
- Added Python test suites for the service and the partner flow

## 19.0.1.0.0

- Initial release
- Validate Address button + review dialog on the Contact form using the Google Address Validation library (Maps JavaScript API)
- Apply Google's standardized address and geocode, or store the verdict only
- Stored verdict fields on `res.partner` with automatic reset on address edit
- Search filters by validation status
