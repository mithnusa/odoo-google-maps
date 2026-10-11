# Project Google Map - Features

## Project Features

### Map View for Projects

**What it does**: Adds a "Map" view to the Projects list, showing each project's drawn area on a satellite map.

**Why it matters**: Lets you see where all your projects are geographically, and assess their status at a glance, without opening each one individually.

**How it works**: The map view displays each project's area using the shape drawn on its Site tab. The sidebar lists all projects alongside the map. Click an area to see project details and available actions.

---

### Status-Based Area Colors

**What it does**: A project's area on the map is automatically color-coded based on the project's health status.

**Why it matters**: Gives you an instant visual overview of project health across your entire portfolio — no need to click into each project.

**How it works**: The area color is computed from the project's last update status using these colors:

- Green: On Track
- Orange: At Risk
- Red: Off Track
- Cyan: On Hold
- Purple: Done
- Gray: No status set

---

### Draw Project Area

**What it does**: Adds a "Site" tab to the project form where you can draw the project's boundary directly on a satellite map.

**Why it matters**: Marks exactly where the project's work takes place, rather than relying on a single address pin — useful for projects that cover a site, a plot of land, or a defined zone.

**How it works**: An interactive drawing tool on the Site tab lets you place a shape (polygon, line, or point) on the map. The area (m²) is calculated automatically as you draw and shown alongside the shape.

---

### Quick Task Access from Map

**What it does**: A "View Tasks" button in the project's map popup and in the map sidebar lets you open the task list for that project directly from the map.

**Why it matters**: Reduces navigation steps when you want to drill into a project's tasks from the map view.

**How it works**: Clicking "View Tasks" in the popup or sidebar item opens a filtered task list for that specific project.

---

## Task Features

### Map View for Tasks

**What it does**: Adds a "Map" view to the task list within a project, showing each task's drawn area alongside its project's boundary.

**Why it matters**: Gives a geographic overview of all work within a project, and shows at a glance how each task's area relates to the overall project site — useful for field service and multi-site operations.

**How it works**: The map view displays each task's own area, drawn in its chosen color. The parent project's boundary is shown underneath as a dotted reference outline so it's clear where each task sits relative to the project. The sidebar lists task names alongside their project.

---

### Draw Task Area with Project Boundary Reference

**What it does**: Adds a "Site Information" section to the task form's Extra Info tab, where you can draw the task's own area on a satellite map — with the parent project's boundary already shown as a guide.

**Why it matters**: Tasks often cover a smaller zone within, next to, or overlapping a project's overall site. Seeing the project's boundary while drawing makes it easy to position the task's area accurately relative to it, without accidentally editing the project's own shape.

**How it works**: The project's boundary is displayed as a dotted, non-editable outline on the map. You draw the task's own shape (polygon, line, or point) on top of or around it using the same drawing tools as the project. The task's area (m²) is calculated automatically as you draw.

---

### Auto-Focus on Project Area

**What it does**: When a task doesn't have an area drawn yet, opening its Site Information map automatically zooms to the parent project's boundary instead of showing a default world view.

**Why it matters**: Immediately shows you where the project's site is, so you know where to start drawing the task's own area.

**How it works**: The map checks whether the task already has a shape. If not, it fits the view to the project's boundary; once the task has its own shape, the map focuses on that instead.

---

### Custom Task Area Color

**What it does**: Each task can have its own area color, set via a color picker in the task form.

**Why it matters**: Lets teams visually categorize task areas on the map using their own color schemes (by priority, type, team, etc.), distinct from the project's status-based color.

**How it works**: A color picker field on the task form lets you choose a color. That color is used for the task's area on the map view.
