# Change Log

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
