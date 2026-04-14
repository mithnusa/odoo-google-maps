# CRM Google Maps - Features

## Map View

### Google Map View for Leads and Opportunities
**What it does**: Adds a dedicated Google Map view accessible from the Leads, Opportunities, My Activities, Pipeline, and Forecast menus in CRM.

**Why it matters**: Sales teams can see the geographic distribution of their pipeline at a glance, making it easier to plan visits and identify territory coverage gaps.

**How it works**: Leads and opportunities are plotted as markers on an interactive Google Map based on their stored latitude and longitude coordinates. The map view is available alongside standard list, kanban, and calendar views.

---

### CRM-Specific Marker Design
**What it does**: Displays each lead or opportunity as a custom marker showing the lead name, stage badge, contact name, salesperson, expected revenue, probability, and expected closing date.

**Why it matters**: Key deal information is visible directly on the map without needing to open each record individually.

**How it works**: Each marker renders a styled card using the lead's data. Clicking a marker highlights it and reveals the full detail card. Markers can be color-coded using a configurable marker color field on each lead.

---

### Marker Highlight on Click
**What it does**: Clicking a marker on the map highlights it visually and brings it to the foreground.

**Why it matters**: Makes it easy to focus on a specific lead when multiple markers are close together.

**How it works**: Clicking toggles a highlight CSS class on the marker element and adjusts its z-index so it appears above neighboring markers.

---

### Overlap Handling with Visual Indicator
**What it does**: When two or more leads share the same address, their markers are slightly offset so they remain individually clickable. An info icon is shown on shifted markers to indicate the adjustment.

**Why it matters**: Prevents markers from stacking directly on top of each other, which would make them impossible to select individually.

**How it works**: The renderer detects overlapping markers and shifts them apart. A tooltip on the info icon explains that the marker has been moved and that the line points to its original location.

---

## Sidebar

### Record Sidebar with CRM Details
**What it does**: Displays a scrollable list of leads or opportunities beside the map, showing the lead name, address, expected revenue, and pipeline stage for each record.

**Why it matters**: Provides a quick overview of all records in the current view without having to interact with the map markers one by one.

**How it works**: The sidebar extends the base Google Map sidebar and adds expected revenue and stage fields beneath each record entry.

---

### Open Record from Sidebar
**What it does**: Clicking a record in the sidebar opens that lead or opportunity's form view.

**Why it matters**: Allows quick navigation from the map view directly into a record for editing or reviewing details.

**How it works**: Each sidebar entry is a clickable item that triggers the standard Odoo record open action.

---

## Geolocation

### Automatic Geolocation from Partner
**What it does**: When a partner is linked to a lead, the lead's latitude and longitude are automatically set from the partner's stored geolocation.

**Why it matters**: Reduces manual data entry when the linked contact already has a known location.

**How it works**: The `customer_latitude` and `customer_longitude` fields are computed from the linked `partner_id` coordinates.

---

### Compute Geolocation from Address
**What it does**: A button on the lead form's Geolocation tab lets users geocode the lead's address to obtain its latitude and longitude.

**Why it matters**: Allows leads without a linked partner, or leads with a different address, to still appear on the map.

**How it works**: The geocoder queries the Odoo geocoding service (base.geocoder) using the lead's street, city, state, zip, and country fields and stores the returned coordinates.

---

### Geolocation Tab on Lead Form
**What it does**: Adds a dedicated "Geolocation" tab to the lead and opportunity form view showing the stored coordinates, a geocode button, a color picker for the map marker, and an embedded mini-map preview.

**Why it matters**: Gives users a single place to review, update, and visualize the geographic data for each lead.

**How it works**: The tab displays `customer_latitude` and `customer_longitude` fields, a `geo_localize` action button, a `color_picker` widget for `marker_color`, and an embedded `google_map` widget showing the lead's location.

---

### Google Map Button on Lead Form
**What it does**: A smart button labeled "Google Map" appears on the lead form when the lead has valid coordinates, and opens the map view filtered to that specific lead.

**Why it matters**: Provides one-click access to see a single lead's location on the map directly from its form.

**How it works**: The button is visible only when both `customer_latitude` and `customer_longitude` are set. It triggers the `action_view_crm_lead_google_map` action scoped to the current record.

---

### Marker Color Customization
**What it does**: Each lead has a `marker_color` field that controls the color of its map marker.

**Why it matters**: Allows visual differentiation between leads on the map, for example by priority, salesperson, or stage.

**How it works**: The marker color value is passed to the marker template and applied as the icon color. The field is edited using a color picker widget in the Geolocation tab.
