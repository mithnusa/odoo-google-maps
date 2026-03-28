# Change Log

## 1.0.0 - Initial Release

- **CRM Lead Mixin**: Extended `crm.lead` with `google_map.add_place.mixin` to gain `gplace_id` field and click-to-create methods
- **CRM Field Mapping**: Overrode `_get_mapping_odoo_fields()` to map place name to `contact_name` and coordinates to `customer_latitude` / `customer_longitude`
- **Auto Opportunity Name**: Overrode `action_in_map_google_place_create` to set the lead name to "[Place Name]'s opportunity" from the clicked place's display name
- **Renderer Patch**: Patched `GoogleMapRendererCRM` to include the `InMapClickAddPlace` component and a custom template that activates the click-to-create UI on the CRM map view
- **Duplicate Detection**: Inherited from `base_google_map_add_place` — existing leads with the same `gplace_id` are opened instead of duplicated
