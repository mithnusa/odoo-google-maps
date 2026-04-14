# Delivery Google Maps - Features

## Map View

### Map View on Picking Lists
**What it does**: Adds a Google Map view to Deliveries, Ready to Transfer, Waiting Transfer, Late Transfers, Backorders, and All Operations lists in Inventory.

**Why it matters**: Logistics teams can see all pending or in-progress deliveries on a map at once, making it easier to understand geographic distribution and plan operations.

**How it works**: The module registers a `google_map` view for `stock.picking` and adds `google_map` to the `view_mode` list of the relevant Inventory actions.

---

### Address-Based Plotting
**What it does**: Each stock picking appears as a marker at its delivery partner's address.

**Why it matters**: Delivery coordinates are sourced directly from the linked partner record, so no manual coordinate entry is needed on the picking itself.

**How it works**: Three related fields are added to `stock.picking` — `partner_latitude`, `partner_longitude`, and `partner_contact_address` — all pulled from `partner_id`. The map view uses `partner_latitude` and `partner_longitude` as the marker position.

---

### Teal Marker Color
**What it does**: All delivery markers are rendered in teal.

**Why it matters**: Makes delivery pickings visually distinct from other record types when multiple map views are in use across the Odoo instance.

**How it works**: The `google_map` view definition includes `color="teal"`, which the base renderer applies to every marker in the view.

---

## Sidebar

### Picking List in Sidebar
**What it does**: A left-hand sidebar lists all visible pickings with their reference number and delivery address.

**Why it matters**: Provides a scrollable index of all deliveries on the map so users can locate a specific picking without panning.

**How it works**: The `google_map` view is configured with `sidebar_title="name"` and `sidebar_subtitle="partner_contact_address"`, which the base sidebar component uses to render each entry.

---

### Sidebar Navigation
**What it does**: Clicking a sidebar entry pans and zooms the map to that picking's marker.

**Why it matters**: Allows quick navigation to a specific delivery without manually searching the map.
