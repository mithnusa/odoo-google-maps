# CRM - Google Maps: Add Lead from Map Click - Features

## CRM Lead Integration

### Mixin Inheritance on crm.lead
**What it does**: Extends the `crm.lead` model with `google_map.add_place.mixin`, adding the `gplace_id` field and all click-to-create methods to CRM leads.

**Why it matters**: Connects the reusable base mixin to the CRM module so that the click-to-create workflow works natively with CRM leads without duplicating any logic.

**How it works**: `crm.lead` uses multiple inheritance to add the mixin alongside its standard CRM behaviour. A custom `GPLACE_USED_FIELDS` list and `_get_mapping_odoo_fields()` override map Google Places data to the correct CRM fields.

---

### CRM-Specific Field Mapping
**What it does**: Maps Google Places API data to the correct fields on `crm.lead` — place name to `contact_name`, coordinates to `customer_latitude` / `customer_longitude`, and standard address fields to their CRM equivalents.

**Why it matters**: CRM leads use different field names than `res.partner` for coordinates and contact name, so a custom mapping ensures data lands in the right place.

**How it works**: Overrides `_get_mapping_odoo_fields()` to return a CRM-specific dictionary. `lat`/`lng` resolve to `customer_latitude`/`customer_longitude`, and `name` resolves to `contact_name`.

---

### Auto Opportunity Name
**What it does**: Automatically sets the lead's `name` (opportunity title) to "[Place Name]'s opportunity" when creating a lead from a named Google Place.

**Why it matters**: CRM leads require a name field that is separate from the contact name. Pre-filling it from the clicked place saves users from having to type it manually.

**How it works**: Overrides `action_in_map_google_place_create` to call the parent method and then inject `default_name` into the action context using the place's `displayName`.

---

## Map Renderer Integration

### InMapClickAddPlace Component on CRM Map
**What it does**: Patches the CRM Google Maps renderer to include the `InMapClickAddPlace` OWL component, enabling the click-to-create UI on the CRM map view.

**Why it matters**: Without this patch the CRM map view has no click listener and the feature would not be available even if the model mixin were in place.

**How it works**: Uses Odoo's `patch` utility to add `InMapClickAddPlace` to the CRM renderer's component registry and switches to a custom template that places the component after the search bar, rendering it only once the map is ready (`t-if="state.isMapReady"`).

---

### Duplicate Detection for Leads
**What it does**: Before opening a create form, checks whether a lead with the same `gplace_id` already exists and opens that record instead.

**Why it matters**: Prevents duplicate leads for the same physical location when users click the same place more than once.

**How it works**: Inherited from `base_google_map_add_place`. The `gplace_id` field is indexed on `crm.lead` for fast lookup.
