# Change Log

## 19.0.1.0.2

### Improved

- **`__manifest__.py` — Name**: Corrected module name from `'Contact Google Autocomplete'` to `'Contacts Google Autocomplete'` for consistency with the module directory name
- **`__manifest__.py` — Summary & Description**: Rewrote the summary and description to accurately document the two widget mapping modes (`places` on name fields, `address` on street field) and the child-contacts inline sub-form coverage
- **`__manifest__.py` — `post_init_hook` Placement**: Moved `post_init_hook` key to follow `data` and `installable` entries for manifest key ordering consistency; removed the empty `demo: []` entry
- **`README.md` — Basic Usage**: Extended the usage note to mention that the same autocomplete applies inside the child-contacts inline sub-form when adding contacts linked to a company

## 19.0.1.0.1
### Improved
- **Performance Optimization**: Changed from `search()` to `search_count()` for existence checks in post-install hook
- **Code Cleanup**: Removed unused variable assignments after mapping creation

### Fixed
- **Code Quality**: Removed trailing whitespace for cleaner code

## 19.0.1.0.0
A new module that combines the following modules from previous versions:     
- contacts_gautocomplete_address_form
- contacts_gautocomplete_address_form_extended
- contacts_gautocomplete_places
- contacts_gautocomplete_places_extended

A simplified feature that gives users full control to configure the mapping between the Google Places Autocomplete API and Odoo  fields.
