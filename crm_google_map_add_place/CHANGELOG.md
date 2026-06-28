# Change Log

## 19.0.1.0.2

### Improved

- **Python — Odoo 19 translations** (`models/crm_lead.py`): Replaced module-level `_()` import with `self.env._()` calls; removed `_` from the `odoo` import.
- **Python — Black format** (`models/crm_lead.py`): Reformatted long `if` conditions to multi-line style.
- **XML format** (`google_map_renderer.xml`): Multi-line attribute layout for `<t t-name=...>`; self-closing `<InMapClickAddPlace />`; XML declaration spacing.
- **Manifest**: Version normalized to `19.0.1.0.2`; removed `installable`, `application`, `auto_install` keys.

## 1.0.1

### Improved

- **Manifest**: Rewrote summary and description; replaced wildcard asset glob with explicit file entries; removed empty `data` and `demo` keys
- **i18n**: Regenerated POT — updated dates; removed stale `"Create an Opportunity"` website form label entry

## 1.0.0 - Initial Release

- **CRM Lead Mixin**: Extended `crm.lead` with `google_map.add_place.mixin` to gain `gplace_id` field and click-to-create methods
- **CRM Field Mapping**: Overrode `_get_mapping_odoo_fields()` to map place name to `contact_name` and coordinates to `customer_latitude` / `customer_longitude`
- **Auto Opportunity Name**: Overrode `action_in_map_google_place_create` to set the lead name to "[Place Name]'s opportunity" from the clicked place's display name
- **Renderer Patch**: Patched `GoogleMapRendererCRM` to include the `InMapClickAddPlace` component and a custom template that activates the click-to-create UI on the CRM map view
- **Duplicate Detection**: Inherited from `base_google_map_add_place` — existing leads with the same `gplace_id` are opened instead of duplicated
