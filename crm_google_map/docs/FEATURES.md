# CRM Google Maps - Features

## Map View

### Google Map View for Leads and Opportunities

**What it does**: Adds a dedicated Google Map view accessible from the Leads, Opportunities, My Activities, Pipeline, and Forecast menus in CRM.

**Why it matters**: Sales teams can see the geographic distribution of their pipeline at a glance, making it easier to plan visits and identify territory coverage gaps.

**How it works**: Leads and opportunities are plotted as markers on an interactive Google Map based on their stored latitude and longitude coordinates. The map view is available alongside standard list, kanban, and calendar views.

---

### CRM-Specific Marker Design

**What it does**: Displays each lead or opportunity as a custom marker showing the lead name, stage badge, address, company name, contact name, phone, salesperson, expected revenue, probability, and expected closing date.

**Why it matters**: Key deal information is visible directly on the map without needing to open each record individually.

**How it works**: Each marker renders a styled card using the lead's data. Clicking a marker highlights it and reveals a full detail grid with icon indicators and tooltips for each field. Markers can be color-coded using a configurable marker color field on each lead.

---

### Activity Scheduling from Map

**What it does**: Each lead's info window provides two action buttons — one to schedule a new activity and one to view all existing scheduled activities for that lead.

**Why it matters**: Sales teams can log follow-ups and check pending tasks directly from the map without navigating into the lead form.

**How it works**: The "Schedule an Activity" button opens a `mail.activity` creation form pre-filled with the lead's context. The "Show Scheduled Activities" button opens a read-only list of activities for that lead. Both actions open in a dialog without leaving the map view.

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

**How it works**: The `customer_latitude` and `customer_longitude` fields are computed from the linked `partner_id` coordinates and recompute automatically whenever the partner's own coordinates are updated.

---

### Automatic Background Geocoding

**What it does**: A scheduled background job automatically geocodes leads that have address data but no stored coordinates.

**Why it matters**: Ensures the map stays up to date without requiring manual intervention, even for leads created in bulk or imported without coordinates.

**How it works**: The cron runs every 12 hours and processes up to 80 ungeolocated leads per run. It skips leads with no country or no address fields. When geocoding fails for a lead, a notification is sent to the user who triggered the job. When using OpenStreetMap, requests are spaced one second apart to respect API rate limits.

---

### Compute Geolocation from Address

**What it does**: Two contextual buttons on the Geolocation tab geocode the lead's address — "Compute based on address" appears when no coordinates are set; "Refresh" appears when coordinates already exist.

**Why it matters**: Allows leads without a linked partner, or leads with a different address, to still appear on the map. The contextual labels make it clear whether you are computing for the first time or updating existing coordinates.

**How it works**: Both buttons call the same `geo_localize` action, which queries the Odoo geocoding service (base.geocoder) using the lead's street, city, state, zip, and country fields and stores the returned coordinates. Visibility is toggled automatically based on whether coordinates are already present.

---

### Geolocation Tab on Lead Form

**What it does**: Adds a dedicated "Geolocation" tab to the lead and opportunity form view showing the stored coordinates, contextual geocode buttons, a map button, and a color picker — all in a single inline row.

**Why it matters**: Gives users a single place to review, update, and visualize the geographic data for each lead, with all actions immediately accessible without scrolling.

**How it works**: The tab displays `customer_latitude` and `customer_longitude` fields, then an inline row containing the contextual geocode buttons, the `google_map` widget button (opens the interactive map dialog), and a `color_picker` widget for `marker_color`.

---

### Marker Color Customization

**What it does**: Each lead has a `marker_color` field that controls the color of its map marker.

**Why it matters**: Allows visual differentiation between leads on the map, for example by priority, salesperson, or stage.

**How it works**: The marker color value is passed to the marker template and applied as the icon color. The field is edited using a color picker widget in the Geolocation tab.
