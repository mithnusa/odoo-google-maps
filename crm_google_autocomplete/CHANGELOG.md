# Change Log

## 19.0.1.0.4

### Improved

- **Python — Black format** (`__init__.py`): Reformatted post-install hook with Black (line length 79); no logic changes.
- **XML format** (`views/crm_lead_views.xml`): Reformatted with self-closing tags.
- **`__manifest__.py`**: Removed explicit `installable`, `application`, and `auto_install` keys — these are Odoo defaults and were redundant.
- **`CHANGELOG.md`**: Removed trailing whitespace and missing newline at end of file.

## 19.0.1.0.3

### Improved

- **Manifest**: Rewrote summary and description; fixed declared dependency from `crm` to `crm_google_map`; moved `post_init_hook` key; removed empty `demo` key
- **README**: Added "Coordinate Preservation" feature; corrected dependency from `crm` to `crm_google_map`
- **FEATURES.md**: Added "Coordinate Preservation" section documenting the `is_from_google_maps` context flag guard

## 19.0.1.0.2

### Added

- **`_compute_customer_geo` context guard** (`models/crm_lead.py`): New model override that intercepts `_compute_customer_geo` from `crm_google_map`. When `is_from_google_maps=True` is present in the context — set by the Google Places autocomplete RPC handler — the override returns early without calling `super()`, preserving the coordinates already written onto the lead by the autocomplete response. Without this guard, the base compute detects an address divergence (the autocomplete-set address may differ from the linked partner's) and resets both coordinates to `0.0`, discarding the Places API result.
- **`_compute_customer_geo` test suite** (`tests/test_compute_customer_geo.py`): Two test classes covering the two execution paths of the override — `TestComputeSkipsWithGoogleMapsContext` (coordinates preserved on single-record and multi-record writes with `is_from_google_maps=True`) and `TestComputeRunsWithoutGoogleMapsContext` (base compute still runs normally without the context flag: coordinates reset on divergence, partner sync intact, no-partner case produces `0.0`).

### Changed

- **Dependency**: Changed from `crm` to `crm_google_map`. The `_compute_customer_geo` override requires the `customer_latitude` / `customer_longitude` stored computed fields and the base compute method provided by `crm_google_map`. Test classes skip gracefully when `crm_google_map` is not installed.

## 19.0.1.0.1
### Improved
- **Performance Optimization**: Changed from `search()` to `search_count()` for existence checks in post-install hook
- **Code Cleanup**: Removed unused variable assignments after mapping creation

## 19.0.1.0.0
A new module that combines the following modules from previous versions:
- crm_gautocomplete_address_form
- crm_gautocomplete_address_form_extended
- crm_gautocomplete_places
- crm_gautocomplete_places_extended

A simplified feature that gives users full control to configure the mapping between the Google Places Autocomplete API and Odoo  fields.
