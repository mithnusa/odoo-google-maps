# Change Log

## 19.0.1.0.7

### Changed

- **`project_project.xml` — Site tab map widget layout**: The `google_map` widget on the project form's Site tab was moved from a standalone `<group>` below the coordinates into the `<div>` that already contains the lat/lng coordinate display. `width="100%"` and `height="400"` attributes were removed so the widget renders as its default single-button form inline with the coordinates.

## 19.0.1.0.6

### Changed

- **`post_init_hook` → XML Data File**: Replaced the Python `post_init_hook` that imperatively appended `google_map` to action `view_mode` strings with a declarative `data/ir_actions_act_window.xml` file. The XML approach re-applies the view mode on every module update, surviving upgrades of the `project` module that would otherwise reset `view_mode` to its default.
- **Removed `post_init_hook`**: `post_init_hook` function and its manifest entry removed; view mode injection is now handled entirely by the data file.

### Improved

- **`uninstall_hook` — Extended Coverage**: Added cleanup for 2 additional task actions (`project.action_view_all_task`, `project.action_view_my_task`) that were previously missing from the uninstall cleanup.

## 19.0.1.0.5

### Changed

- **Dependency**: Removed `web_widget_google_map` from module dependencies — the embedded satellite map in project and task forms is now rendered by `web_view_google_map`.

### Improved

- **Python — Black format** (`__init__.py`, `models/project_project.py`): Reformatted long `env.ref(...)` calls and field definitions to multi-line style.
- **JS code style** (`google_map_renderer.js`): Reformatted `_actionViewTasks` `.call(...).then(...)` chain.
- **XML format** (all XML files): Self-closing tags, multi-line attribute layout for `<google_map>`, `<button>`, `<widget>`, and `<t t-name=...>` elements; trailing newline added.
- **Manifest**: Version normalized to `19.0.1.0.5`; removed `installable`, `application`, `auto_install` keys.

## 1.0.4

### Improved

- **Manifest**: Rewrote summary and description; replaced wildcard asset glob with explicit ordered file entries; removed empty `demo` key
- **i18n**: Regenerated POT — updated dates; removed stale `"Create a Customer"` and `"Create a Task"` website form label entries; added task quick-entry keyword help text string

## 1.0.3

### Fixed

- **`MarkerInfoWindow` XPath — Button Selector**: Updated XPath from `//button[@id='btn-open_form']` to `//button[@data-role='btn-open_form']` to align with the upstream ID → `data-role` selector change adopted by `web_view_google_map`
- **"View Tasks" Button — `id` → `data-role`**: Replaced `id="btn-view_tasks"` with `data-role="btn-view_tasks"` on the button element for consistency with the updated selector convention
- **`_createInfoWindowContent` — Button Selector**: Updated `content.querySelector('#btn-view_tasks')` to `content.querySelector('[data-role="btn-view_tasks"]')` to match the button attribute change

## 1.0.2

- [Improved] **Sidebar Actions Hook Migration**: Replaced `RecordItem` primary template inheritance (xpath before the marker span) with the new `recordActionsTemplate` slot from `web_view_google_map` v1.0.22; `GoogleMapSidebarProject` now sets `static recordActionsTemplate = 'project_google_map.RecordActionsTemplate'` instead of overriding `recordItemTemplate`
- [Improved] **`RecordActionsTemplate` Template**: Rewrote the "View Tasks" button as a standalone `<t t-name="project_google_map.RecordActionsTemplate">` block; button class updated to `btn btn-sm btn-link` for consistency with the base sidebar action buttons
- [Added] **`google_map_sidebar.scss`**: New stylesheet that widens the actions column (`td:last-child`) to `95px` for project sidebar rows, accommodating the additional "View Tasks" button without wrapping

## 1.0.1

### Added

- **Task Map View**: Tasks within a project can now be viewed on a Google Map using their site locations
- **Task Site Location**: Tasks have a new "Site Information" section (under Extra Info tab) with a site address field, coordinates display, and embedded satellite map
- **Task Marker Color**: Each task can have a custom marker color set via a color picker
- **"View Tasks" Button**: Project markers on the map and sidebar entries now include a "View Tasks" button that opens the filtered task list for that project
- **Custom Project Map View** (`google_map_project`): Dedicated JavaScript view type for projects, extending the base Google Map view with the "View Tasks" action in both the marker info window and sidebar

### Improved

- **View Mode Registration**: Moved from static XML to `post_init_hook` / `uninstall_hook` for cleaner installation and uninstallation

## 1.0.0

- [Added] **Project Map View**: Google Map view for the Projects list showing each project as a marker at its site location
- [Added] **Site Address Field**: `partner_site_id` field on `project.project` linking a project to a physical site address
- [Added] **Coordinates Display**: Latitude and longitude shown on the project form's Site tab, derived from the linked site partner's geolocation data
- [Added] **Embedded Satellite Map**: Project form Site tab displays an embedded satellite map of the selected site location
- [Added] **Status-Colored Markers**: Project markers are automatically color-coded by health status — green (on track), orange (at risk), red (off track), cyan (on hold), purple (done), gray (none)
- [Added] **Site Partner Type**: New "Site" option added to the partner type selection, with a dedicated avatar icon, to keep site addresses organized separately from regular contacts
