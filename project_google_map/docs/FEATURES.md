# Project Google Map - Features

## Project Features

### Site Address Field

**What it does**: Adds a "Site" tab to the project form where you can link the project to a physical site address.

**Why it matters**: Separates the site location from the billing/customer address, letting you track where work actually happens.

**How it works**: A dedicated site address field on each project stores a partner (contact) record as the site location. Latitude and longitude are automatically read from that partner's geolocation data.

---

### Status-Based Marker Colors

**What it does**: Project markers on the map are automatically color-coded based on the project's health status.

**Why it matters**: Gives you an instant visual overview of project health across your entire portfolio — no need to click into each project.

**How it works**: The marker color is computed from the project's last update status using these colors:

- Green: On Track
- Orange: At Risk
- Red: Off Track
- Cyan: On Hold
- Purple: Done
- Gray: No status set

---

### Map View for Projects

**What it does**: Adds a "Map" view to the Projects list, showing each project as a colored marker at its site location.

**Why it matters**: Lets you see where all your projects are geographically and assess their status at a glance.

**How it works**: The map view displays project markers using the site address coordinates. The sidebar lists all projects alongside the map. Click a marker to see project details and available actions.

---

### Map Button in Project Form

**What it does**: Adds a map button inline with the coordinates display on the project form's Site tab.

**Why it matters**: Lets you confirm the correct site location without leaving the project form.

**How it works**: The `google_map` widget is placed inside the coordinates div on the Site tab. Clicking the button opens `GeolocationEditDialog` in read-only mode (satellite view) centred on the site's coordinates.

---

### Quick Task Access from Map

**What it does**: A "View Tasks" button in the project marker info window and in the map sidebar lets you open the task list for a project directly from the map.

**Why it matters**: Reduces navigation steps when you want to drill into a project's tasks from the map view.

**How it works**: Clicking "View Tasks" in the marker popup or sidebar item opens a filtered task list for that specific project.

---

## Task Features

### Task Site Location

**What it does**: Adds a "Site Information" section in the task form's Extra Info tab where you can assign a site address to each task.

**Why it matters**: Tasks often need to be performed at locations different from the project's main site — this lets each task track its own location.

**How it works**: Each task has its own site address field (linked to a partner record). Latitude and longitude are read from that partner's geolocation data.

---

### Custom Task Marker Color

**What it does**: Each task can have its own marker color, set via a color picker in the task form.

**Why it matters**: Lets teams visually categorize tasks on the map using their own color schemes (by priority, type, team, etc.).

**How it works**: A color picker field on the task form lets you choose a color. That color is used for the task's marker on the map view.

---

### Map View for Tasks

**What it does**: Adds a "Map" view to the task list within a project, showing tasks as markers at their site locations.

**Why it matters**: Gives a geographic overview of all work within a project, useful for field service and multi-site operations.

**How it works**: The map view displays task markers using site address coordinates, with task name and customer shown in the sidebar. The marker color reflects the custom color set on each task.

---

### Embedded Satellite Map in Task Form

**What it does**: Shows a satellite map of the task's site location directly within the "Site Information" section of the task form.

**Why it matters**: Lets you verify the exact task location without leaving the form.

**How it works**: When a site address is selected on the task, an embedded satellite map (400px height) renders automatically alongside the address fields.

---

## Site Partner Management

### Site Partner Type

**What it does**: Adds a "Site" option to the partner type selection, allowing contacts to be designated as physical site locations.

**Why it matters**: Keeps site addresses organized separately from regular customer and vendor contacts, making them easier to find and manage.

**How it works**: When creating or editing a partner, you can set its type to "Site". Site-type partners are offered by default when selecting a site address on projects or tasks.

---

### Custom Site Partner Icon

**What it does**: Site-type partners display a distinctive icon instead of the standard contact avatar.

**Why it matters**: Makes site partners immediately recognizable in lists and dropdowns, helping distinguish locations from people and companies.

**How it works**: When a partner's type is "Site", the module automatically uses a dedicated site icon as the avatar placeholder.
