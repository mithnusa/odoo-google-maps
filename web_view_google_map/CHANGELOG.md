# Change Log

## 19.0.2.0.1

### Added

- **Hoot JS Test Suite** (`static/tests/google_map_view.test.js`): First test suite for the module — covers unlocated-records domain exclusion, `mapDomain`'s 0.0 equator/prime-meridian handling, arch-parser mandatory-attribute validation, `groupsLimit` defaults, marker creation and click, grouping, header buttons, and record deletion.
- **`static/tests/helpers/google_maps_test_helpers.js`**: Shared fakes for the `google.maps` API boundary (`FakeMap`, `FakeAdvancedMarkerElement`, `FakePinElement`, `FakeInfoWindow`, etc.) plus `mockGoogleMapsApi()` and `waitUntil()` helpers; reused by dependent modules (e.g. `web_view_google_map_drawing`) instead of duplicating the harness.
- **`web.assets_unit_tests` Bundle** (`__manifest__.py`): Registered `static/tests/**/*` so the new suite runs under Odoo's Hoot test runner.
- **`GoogleMapArchParser.mandatoryAttrs()` — Required-Attribute Validation**: `parseGoogleMapAttrs()` now throws `Missing required attribute(s): ...` when any of `lat`, `lng`, `sidebar_title`, `sidebar_subtitle` is absent from the arch, uncovered while writing the arch-parser tests.

### Fixed

- **`sidebarTitleField` / `sidebarSubtitleField` — Null vs Undefined Prop Crash**: `xmlDoc.getAttribute()` returns `null` (not `undefined`) when an attribute is absent; `GoogleMapSidebar`'s `title`/`subTitle` props are optional strings, and OWL's prop validator only treats `undefined` as "not provided" — an explicit `null` still failed the `String` type check. Both fields now fall back to `undefined` via `|| undefined`.

## 19.0.1.0.26

### Added

- **Street View Button in Info Window** (`google_map_renderer.xml`): Each marker info window now includes a "Street View Side by Side" button (fa-street-view) that opens `GoogleMapStreetViewSideBySideDialog` from `web_widget_google_map` — a side-by-side panel showing a Google Map on the left and Street View on the right. Falls back gracefully when no Street View imagery exists at the location.
- **`showGoogleStreetViewSideBySide(record)`** (`google_map_controller.js`): New controller method that reads `lat`/`lng` from the record, validates coordinates, and opens the Street View dialog via `dialogService`. Shows a warning notification when the view lacks geolocation fields or the record has no valid coordinates.
- **`formatAddressForInfoWindow(title, address)`** (`google_map_renderer.js`): New renderer method that formats the marker info window subtitle, removing redundant title prefix from the address string for cleaner display.

### Improved

- **Marker Overlap Spread**: `OFFSET_RADIUS` increased from `0.00009` to `0.0003` (~33 m at the equator) and `POSITION_TOLERANCE` from `0.000001` to `0.00001` (~1.1 m), improving separation for records geocoded to the same address. Connection line `strokeWeight` increased from 1 to 2 for better visibility.
- **`ir_ui_view.py` — Black Format + Odoo 19 Translations**: Reformatted with Black (line length 79); `_()` import replaced with `self.env._()` calls throughout `_validate_tag_google_map`, aligning with Odoo 19 translation conventions.
- **i18n placeholders**: `sprintf(_t('Nearby %s (within %s km)'), ...)` replaced with named-placeholder form `_t('Nearby %(title)s (within %(radius)s km)', {...})`.

### Changed

- **Dependencies**: Added `web_widget_google_map` to module dependencies — the Street View dialog and the `GoogleMapGeolocate`/`GoogleMapSearchPlaces` components are now sourced from that module.

## 19.0.1.0.25

### Added

- **MarkerClusterer Library**: Bundled MarkerClusterer v2.6.2 static files (`index.min.js`, `index.min.js.map`, `note.txt`) moved from `base_google_map` into this module, which is the sole consumer of the library
- **`loadMarkerClustererAssets()` — On-Demand Loader** (`utils.js`): New async helper that loads the MarkerClusterer script lazily via `loadJS` (with a `window.MarkerClusterer` guard to skip if already present), replacing the unconditional QWeb bootstrap injection that was previously in `base_google_map`
- **`_onWillStart()` Hook** (`google_map_renderer.js`): New `onWillStart` lifecycle hook added to `GoogleMapRenderer` that calls `loadMarkerClustererAssets()`, ensuring the library is loaded before the map component mounts

### Improved

- **`__manifest__.py` — Summary & Description**: Rewrote the summary to a single concise line and the description to a structured bullet-point block documenting all provided components: the view stack, field widgets, sidebar, clustering, multi-selection, nearby search, Google Maps links, and dark mode
- **`__manifest__.py` — Explicit Asset Entries**: Replaced all wildcard globs (`views/**/*`, `fields/**/*`, `helpers/*`) with explicit file entries in dependency order, ensuring deterministic asset loading; dark mode stylesheet updated to explicit path
- **`__manifest__.py` — Cleanup**: Removed empty `demo: []` key
- **`README.md` — Key Features**: Added "Google Maps Links" entry documenting navigation and search links in each marker info window
- **`docs/FEATURES.md` — Sidebar Position**: Corrected sidebar position description from "right side" to "left side" to match the layout change shipped in v1.0.22
- **`docs/FEATURES.md` — Google Maps External Links**: Added new feature section documenting the navigation link (`/maps/dir/`) and search link (`/maps/search/`) rendered in each marker info window
- **`i18n/web_view_google_map.pot`**: Regenerated translation template — updated POT creation/revision dates, normalized version string to `19.0`, added new strings (`"Collapse side panel"`, `"Expand side panel"`, `"Nearby"`, `"Nearby %s (within %s km)"`, `"Nearby Search Radius (m)"`, `"Open Google Maps"`, `"Records"`, `"Show nearby records"`, `"The selected record does not have valid geolocation data."`, `"This view is not configured with latitude and longitude fields."`), removed obsolete strings (`"Are you sure you want to delete these records?"`, `"Bye-bye, record!"`, `"No, keep it"`, `"View on Google Maps"`)

## 19.0.1.0.24

### Fixed

- **`ir_ui_view.py` — Lat/Lng Validation Logic**: The condition `not att_lat and not att_lng` required both attributes to be absent before raising an error; changed to `not att_lat or not att_lng` so either missing attribute triggers the validation error, as intended
- **`ir_ui_view.py` — `node.iterchildren` Tag Filter**: `tag=etree.Element` passed the class itself as a tag filter, matching nothing correctly; replaced with `tag='field'` string literal for proper child filtering. Removed the now-unnecessary `from lxml import etree` import
- **`geolocate.js` — Missing `ev.preventDefault()`**: `geolocation()` handler did not call `ev.preventDefault()`, allowing the default browser action to fire alongside the geolocation request; added `ev` parameter and `ev.preventDefault()` call
- **`google_map_sidebar.xml` — `record.id` vs `record.resId`**: `fnPinPointInMap` was called with `record.id` (OWL component id) instead of `record.resId` (database ID), causing the wrong record to be pinpointed on the map
- **`_selectMarker()` / `_deselectMarker()` — Forced Zoom Override**: Both methods always called `setZoom(14)`, overriding the user's current zoom level even when already zoomed in further; zoom is now only applied when the current level is below 14
- **`onGroupBySelected()` — Brief Double-Group State**: Previous implementation called `super.onGroupBySelected()` first, then checked the count — leaving a window where two groups were briefly active. Now validates before calling super, blocking activation entirely if another group is already active
- **`mapDomain` — `0.0` Excluded as Null**: `0.0` was listed in `nullValues` alongside `null` and `false`, which incorrectly excluded records located exactly on the equator or prime meridian. Removed `0.0` from the null exclusion list
- **`parseRecord()` — Color Processing for Falsy/Zero Values**: Color logic incorrectly called `processColor(color)` when `color` was `0` (a valid integer color index), and fell back to `processColor(otherFields.__geoColor)` (the field name string) when color was absent. Added explicit `if (color)` guard and a separate `typeof color === 'number'` branch
- **`_updateExistingMarker()` — Stale Cached `dataView`**: The `cacheRecordDataView` entry for an updated record was not invalidated, causing the cached (pre-update) coordinates to be returned on subsequent reads; added `cacheRecordDataView.delete(record.resId)` before updating
- **`GoogleMapRecord.dataView` — Monkey-Patch Removed**: `dataView` was defined via `patch(Record.prototype, ...)` which applied globally to all `Record` instances; replaced with a proper override directly on `GoogleMapRecord` class, scoping the behavior correctly

### Improved

- **`generateColor()` — Deterministic Seed-Based Hash**: Accepts an optional `seed` parameter; when provided, derives a stable color via a djb2-style hash so the same group value always produces the same color across reloads. Falls back to random when seed is absent
- **`GoogleMapGroup` — Stable Group Colors**: Group color is now derived from the group value (`colorSeed`) via the seeded `generateColor()` call, replacing the previous random assignment that changed on every reload
- **`GoogleMapDynamicGroupList` — `defaultGroupBy` Initialized in `setup()`**: Moved `defaultGroupBy` initialization from inside the `groupBy` getter (lazy, repeated side-effect) to `setup()`, so it runs exactly once and the getter is a pure read
- **`mapDomain` — Memoized Computation**: Added `_mapDomainCache` to store the computed domain after first access; subsequent reads return the cached value without recomputing field lookups
- **`_processSelectionInBatches()` — Async/While Refactor**: Replaced the `new Promise` + recursive `setTimeout` callback pattern with a straightforward `async/while` loop, yielding between batches via `await new Promise(resolve => setTimeout(resolve, 0))`
- **`useEffect` — Async Error Surfaced**: `onSelectionChanged()` call inside `useEffect` is now chained with `.catch()` so rejections are logged rather than silently swallowed (OWL `useEffect` callbacks must be synchronous)
- **`useBus` `google-map-center-map` — Error Handling**: Wrapped `centerMap()` in an arrow function with `.catch()` to log errors from async bus handler
- **`getGroupsOrRecords()` Cache Check**: Replaced `JSON.stringify` equality check with direct per-field comparison (`isGrouped`, `length`, and per-id `recordsIds.every(...)`) to avoid serialization overhead on every render
- **`archiveDialogProps` — Stable Callback References**: `confirm` and `cancel` callbacks are now stored as `_onConfirmArchive` / `_onCancelArchive` properties during `setup()` rather than creating new closures on every getter invocation
- **`getExportableFields()` — Respects `column_invisible` and `properties`**: Added two additional filter passes — one evaluating `column_invisible` modifiers against the current context and one excluding `properties`-type fields — matching the behavior of standard list view export
- **`_renderMarkerForRecord()` — Cache Check Before Element Creation**: Moved the `cache.has(record.resId)` early-return check before `_createMarkerElementValues()`, avoiding unnecessary DOM element creation for markers that will be updated rather than created
- **`_scheduleNextBatch()` — Idle Callback Tracking**: Idle callback handles are now stored in `_idleCallbackHandles` Set and cancelled in `_cleanUp()` via `window.cancelIdleCallback`, preventing post-destroy callbacks from accessing a torn-down component
- **`handleGroupCollapse()` — Cleaned Up Logic**: Extracted common `getGroupsOrRecords().filter(...)` call; both the expand and collapse branches now `await` their respective props calls for correct async sequencing
- **`geolocationInfoTooltip` / `getGroupTitle()` Getters**: Tooltip text and group header label are now returned from getter methods, making them translatable via `_t()` rather than being hardcoded strings in the template
- **XML — `t-att-class` Object Syntax**: Replaced `t-attf-class` string interpolation with `t-att-class` object bindings throughout `google_map_renderer.xml` and `google_map_sidebar.xml` for cleaner conditional class handling
- **XML — `data-role` Replaces Element IDs**: InfoWindow and sidebar action buttons now use `data-role` attributes instead of `id` attributes for event delegation, avoiding duplicate-ID issues when multiple info windows or sidebars are present on the page
- **XML — `aria-hidden="true"` on Decorative Icons**: Added `aria-hidden="true"` to all purely decorative `<i class="fa ...">` icon elements across renderer and sidebar templates to reduce screen reader noise

### Removed

- **`subTitle` Prop from Sidebar**: Removed the `subTitle` string prop from `GoogleMapSidebar` props definition and its passing in `sidebarProps`
- **`lxml.etree` Import**: Removed unused `etree` import from `ir_ui_view.py` following the `iterchildren` fix
- **`patch` Import from `google_map_model.js`**: Removed unused `@web/core/utils/patch` import after replacing the monkey-patch with a proper class override
- **`debounceToggleRecordSelection`**: Removed unused debounced wrapper that was never called
- **`_markerPositionIndex` Map**: Removed the unused position-index Map; the corresponding `.clear()` call in `_invalidateMarkerPositionIndex()` was also removed

## 19.0.1.0.23

- [Improved] **Sidebar Table Layout — Content Cell Class**: Replaced the `table:not(:has([colspan]))` fixed-layout approach with a dedicated `o_sidebar_content_cell` CSS class. The content `<td>` in `RecordItem` and both `<td colspan="99">` cells in `GroupItem` now carry this class, making the layout target explicit rather than relying on a structural selector
- [Improved] **Sidebar Table Layout — Auto Layout**: Switched from `table-layout: fixed` to auto layout. All tables get `width: 100%`; the `.o_sidebar_content_cell` cell uses `width: 100%` + `max-width: 0` to absorb all remaining space without forcing a minimum width from its content; its inner `.d-flex` child also gets `width: 100%; overflow: hidden` to contain long text correctly
- [Improved] **Sidebar Action Column Sizing**: Replaced the `min-width: 70px` / `max-width: 100px` hard-coded action column bounds with `white-space: nowrap` on `tr td:last-child`, letting the column shrink naturally to its button content width in auto table layout
- [Removed] **`table tr td { overflow: hidden }` Block**: Removed the standalone overflow rule that clipped all table cells — overflow is now controlled directly on `.o_sidebar_content_cell` and its inner `.d-flex` wrapper
- [Removed] **`max-width: clamp(...)` on Record Title**: Removed the `max-width: clamp(140px, calc(25vw - 150px), 260px)` constraint from the record/group title text — the cell-level `max-width: 0` approach makes the viewport-relative clamp unnecessary

## 19.0.1.0.22

- [Improved] **Sidebar Position — Left Side**: Moved the sidebar from the right side of the map to the left. The sidebar now renders before the map div in the DOM; renamed all CSS classes (`o_map_right_sidebar` → `o_map_left_sidebar`, `toggle_right_sidenav` → `toggle_left_sidenav`) and updated all selector references in `google_map_sidebar.scss` and `google_map_x2many_fields.scss`
- [Improved] **Sidebar Toggle Button — Flip**: Toggle button border/radius flipped to match the new left-side position (`border-left: 0`, `border-right: 1px solid`, `border-radius: 0 10px 10px 0`); positioning changed from `right: 100%` to `left: 100%`; tooltip placement changed from `right` to `left`; open/close arrow glyphs swapped (`\f0da` ↔ `\f0d9`) to correctly indicate direction
- [Improved] **Sidebar Width**: Default sidebar width reduced from `25%` to `18%` for a less intrusive footprint while keeping the `max-width: 400px` cap and `min-width: 300px` open-state floor
- [Improved] **Sidebar Border**: Replaced `box-shadow` on the open state with `border-right` using the control panel border variable (`--ControlPanel-border-bottom`); removed `box-shadow` from the closed-state override (now commented out) for a cleaner edge
- [Improved] **Sidebar Table Layout**: Applied `table-layout: fixed; width: 100%` to all record tables (those without a `colspan` cell) via `:not(:has([colspan]))`, giving the actions column a fixed `min-width: 70px` / `max-width: 100px` so action buttons never wrap or overflow
- [Improved] **Sidebar Text Clipping**: Unified `.o_map_sidebar_record` and `.o_map_sidebar_group` overflow rules under a single `table tr td` block; added `overflow: hidden` on `td` cells directly; adjusted `max-width` clamp offset from `130px` to `150px`
- [Improved] **Group Collapse — Table Structure**: Wrapped the collapsible group record list in a `<tr><td colspan="99">` row so it forms a valid `<table>` structure; nested record table now includes `table-striped` class
- [Improved] **Group Count Row**: Added `d-flex align-items-center justify-content-center` to the group count container for consistent vertical alignment with the marker icon and count badge
- [Improved] **"See More" Row**: Replaced `d-flex justify-content-center align-items-center` with `text-center` on the "see more" trigger row
- [Added] **`recordExtraTemplate` Hook**: New `static recordExtraTemplate = 'web_view_google_map.RecordItemExtra'` property on `GoogleMapSidebar`; an empty `<t t-name="web_view_google_map.RecordItemExtra"/>` template is called inside the content `<td>` below the record title — sub-classes can override this static property to inject extra fields (e.g. amount, stage) without modifying `RecordItem`
- [Added] **`recordActionsTemplate` Hook**: New `static recordActionsTemplate = 'web_view_google_map.RecordActionsTemplate'` property on `GoogleMapSidebar`; an empty `<t t-name="web_view_google_map.RecordActionsTemplate"/>` template is called inside the actions `<td>` between the Nearby and Open buttons — sub-classes can override this static property to inject extra action buttons (e.g. View Tasks) without modifying `RecordItem`
- [Improved] **Checkbox Column Width**: Increased the selector checkbox column from `width: 10px` to `width: 20px` to prevent clipping of the checkbox control

## 19.0.1.0.21

- [Improved] **Sidebar Toggle Button — Icons**: Replaced Unicode angle quotation marks (`\203A` / `\2039`) with FontAwesome glyphs — `fa-caret-right` (`\f0da`) for the open state and `fa-caret-left` (`\f0d9`) for the closed state; added `font-family: 'FontAwesome'` to the `::before` pseudo-element so the glyphs render correctly
- [Improved] **Sidebar Toggle Button — Styling**: Reduced icon size from `20px` to `16px` and set icon color to `#6c757d` (Bootstrap `text-muted`) for a subtler appearance; adjusted button vertical position from `top: 25%` to `top: 45%` to better center it within the viewport
- [Improved] **Sidebar Toggle Button — Border**: Changed border width from `1.5px` to `1px` with a `6%` darkened background color, and increased `border-radius` to `10px 0 0 10px` for a softer rounded edge

## 19.0.1.0.20

- [Fixed] **`GoogleMapGeolocate` — OWL Lifecycle Hook**: Replaced `onMounted(this._onRendered)` with `onMounted(() => { this._onMounted(); })` and `onWillUnmount(this._cleanup)` with `onWillUnmount(() => { this._cleanup(); })` — arrow-function wrappers ensure correct `this` binding; method renamed from `_onRendered` to `_onMounted` to reflect its actual lifecycle timing
- [Fixed] **`GoogleMapGeolocate` — `geolocateBtn` Initialization**: Added explicit `this.geolocateBtn = null` in `setup()` so the null-check guard in `_onMounted` is reliable from the first render
- [Fixed] **Geolocate Marker Click Event**: Changed the marker click listener from the deprecated `'click'` to `'gmp-click'`, matching the correct event name for `AdvancedMarkerElement`
- [Improved] **Geolocate Marker SVG**: Replaced the plain red Feather map-pin (24×24) with a styled blue-gradient teardrop pin (28×36) — uses a radial gradient (`#5b9cf6` → `#1a56c4`), a `feDropShadow` filter, and a white inner circle for a more polished, map-native appearance

## 19.0.1.0.19

- [Added] **`defaultGroupsLimit` Getter**: New getter on `GoogleMapArchParser` returning `80` as the default groups limit, used as a fallback when `groups_limit` is not defined in the view arch
- [Improved] **`groupsLimit` Auto-Default**: When `default_group_by` is set on the view and no explicit `groups_limit` is defined, `groupsLimit` is now automatically set to `defaultGroupsLimit` (80) to avoid loading excessive groups on the map
- [Fixed] **`groupsLimit` Parsing**: Changed the fallback when `groups_limit` attribute is absent from `this.defaultGroupsLimit` to `null`, so the arch parser no longer overrides the default prematurely — the controller's downstream logic now applies the correct default
- [Improved] **`groupsLimit` Validation in Controller**: Replaced `this.archInfo.groupsLimit || Number.MAX_SAFE_INTEGER` with an explicit `Number.isFinite` and positive-value guard before falling back to `Number.MAX_SAFE_INTEGER`, preventing `0` or negative values from being passed to the model
- [Improved] **Pager — Sample Model Guard**: `usePager` now returns early when `useSampleModel` is active, preventing the pager from rendering against sample data
- [Improved] **Pager — Grouped View**: Pager is now always rendered (grouped and ungrouped); `updateTotal` is only provided when the list is not grouped and `hasLimitedCount` is true
- [Improved] **Pager — Removed `onUpdatedPager` call**: Removed the `onUpdatedPager()` call from the pager `onUpdate` handler as it is no longer needed
- [Improved] **Search Bar Toggler**: Updated `SearchBar` usage to pass `toggler` prop directly; toggler component is now conditionally rendered only when no records are selected
- [Improved] **Marker Colors**: Updated `generateColor()` palette — brightened colors replaced with darker, more accessible variants for better contrast on map markers

## 19.0.1.0.18

- [Improved] **Color Picker Palette**: Updated `WIDGET_COLOR_PICKER_COLOR` hex values with more vibrant and visually distinct colors across all 11 color slots
- [Improved] **Number Validation**: Replaced `isNaN`/`isFinite` check with `Number.isFinite` in `formatNumber()` for stricter validation

## 19.0.1.0.17

- [Improved] **Geolocate Button Layout**: Moved `margin-right` from the inner `.btn` element to the `.button_geolocate_user` container and added `margin-bottom: 8px`, ensuring consistent spacing regardless of button state
- [Improved] **Geolocate Button Size**: Set an explicit `width: 42px` on the geolocate `.btn` to give it a fixed, predictable size
- [Improved] **Child Component Environment**: Added `model` and `openRecord` to the env object passed to child components in `GoogleMapRenderer`, making the view model and record-opening callback available to components that extend the renderer

## 19.0.1.0.16

- [Added] **Nearby Search Crosshair Overlay**: The nearby search coverage area now renders two dotted polylines forming a crosshair at the bounding box center, visually marking the origin point used for the radius calculation
- [Added] **Dedicated Nearby Search Styling Constants**: Extracted overlay styling (stroke color, opacity, fill opacity, dot scale/repeat) into a `NEARBY_SEARCH` block within `MARKER_CONFIG`, keeping visual configuration in one place
- [Improved] **Nearby Coverage Area Rendering Order**: Moved `clearNearbySearchCoverageArea()` from `renderGeolocationData()` into `renderNearbySearchCoverageArea()` itself, so the coverage overlay is cleared and redrawn atomically on each render cycle
- [Improved] **Bounding Box Validation**: Added a `Number.isFinite` guard on all four bbox coordinates before rendering; logs a warning and exits early if any value is invalid
- [Improved] **Antimeridian-Aware Crosshair**: Midpoint longitude for the crosshair is computed correctly when the bounding box crosses the antimeridian (east < west)
- [Fixed] **Polyline Cleanup**: `clearNearbySearchCoverageArea()` now also removes and resets `_nearbySearchCoveragePolylines`, preventing orphaned overlay elements when the nearby search is cleared

## 19.0.1.0.15

- [Fixed] **Nearby Search Robustness**: Invalid `nearby_radius_search` config values (e.g. non-integer strings) now fall back to the default 1000 meters instead of raising an unhandled exception
- [Fixed] **Antimeridian Wraparound**: Nearby search bounding box now correctly handles locations near the international date line (±180° longitude) by splitting the longitude domain into two OR segments, ensuring accurate results for records in that region
- [Fixed] **Latitude Clamping**: Nearby search bounding box latitude values are now clamped to the valid range [-90, 90] to prevent invalid domain queries
- [Fixed] **Nearby Button Handler**: Fixed the "Show nearby" button click handler calling the wrong method (`showNearbyRecords` instead of `searchNearbyRecords`), which caused nearby search to silently fail
- [Fixed] **Search Radius Validation**: Added guard to reject non-finite or non-positive radius values before computing the bounding box, falling back to the configured default
- [Improved] **Geolocation Validation**: Replaced loose `isFinite()` check with `Number.isFinite()` for stricter validation of latitude/longitude values before triggering nearby search
- [Improved] **Nearby Button Semantics**: Replaced `<a href="#">` anchor with a `<button>` element for the nearby search trigger, improving semantic HTML and keyboard accessibility
- [Cleanup] **Settings View**: Removed unused import from `res_config_settings.xml`
- [Docs] **README**: Updated "Nearby Records" key feature description to mention the sidebar row as an additional trigger and the rectangle overlay shown on the map
- [Docs] **Features Reference**: Updated `Nearby Records Search` section to document the sidebar row trigger, bounding box rectangle overlay visualization, and view title update during a nearby search

## 19.0.1.0.14

- [Added] **Nearby Search Radius Setting**: Added `nearby_radius_search` configuration field (default: 1000 meters) to Settings → General Settings → Google Maps, allowing administrators to control the search radius used by the "Show nearby records" feature on the map
- [Added] **Settings Controller**: Added HTTP controller extending the `base_google_map` settings endpoint to include `nearby_radius_search` in the values returned to the frontend
- [Added] **Settings UI**: Added "Nearby Search Radius (m)" input to the Google Maps settings block, visible only when `web_view_google_map` is installed

## 19.0.1.0.13

- [Docs] **README**: Rewrote `README.md` to follow the project documentation template — added Overview, What It Does, Key Features, Dependencies, Installation, Basic Usage, Attributes Reference, Embedding guide, and Related Modules sections; replaced inline HTML image tags with standard Markdown image syntax
- [Docs] **Features Reference**: Created `docs/FEATURES.md` with detailed descriptions of all module features: Map View Type, Record Markers, Sidebar Panel, Marker Clustering, Overlapping Marker Handling, Grouping, Multi-Selection, In-Map Place Search, Geolocation Button, Nearby Records Search, Record Actions, Embedded Map in Forms, and Dark Mode Support

## 19.0.1.0.12

- [Added] **Header Button Support**: The map view now parses `<header>` buttons from the view's arch XML and renders them in the control panel using `MultiRecordViewButton`, matching the behavior of standard list views. Buttons with `display="always"` appear persistently; others appear in the selection actions area and in the cog menu on small screens.
- [Fixed] **Export Button**: Fixed the export action by replacing the manual `ExportDataDialog` implementation with Odoo's built-in `useExportRecords` hook, resolving errors triggered when clicking the Export button in the Action Menu
- [Fixed] **Action Service Calls**: Replaced `this.model.action.doAction` with `this.actionService.doAction` throughout the controller, resolving errors when opening form views or switching views from the map.
- [Fixed] **Domain Handling in `_getNextConfig`**: Map domain is now applied after calling `super._getNextConfig()` rather than before, preventing the map's geolocation filter from being overridden by the parent config.
- [Fixed] **Form View and Views Checks**: Changed truthy checks on `form_view` and `views` to use `.length` to correctly detect empty arrays.
- [Fixed] **Missing Form View Notification**: Replaced `console.warn` with a proper `notificationService` danger notification when no form view is available for a record.
- [Fixed] **Unselect All**: Simplified `onUnselectAll` by removing the marker-specific `_toggleMarkerSelection` branch; all records now use the standard `toggleSelection(false)` path.
- [Fixed] **Auto-Zoom Behavior**: Reduced `MAX_AUTO_ZOOM` from 17 to 15 and the smooth zoom increment on subsequent clicks from 3 to 2, resulting in less aggressive auto-zoom when centering on a marker.
- [Improved] **Delete with Confirmation**: Replaced the inline `ConfirmationDialog` call in `onDeleteSelectedRecords` with Odoo's built-in `useDeleteRecords` hook for consistent deletion behavior
- [Improved] **Exportable Fields**: Added `getExportableFields()` method that correctly filters visible, non-properties, exportable fields from the view's columns, respecting `column_invisible` modifiers and optional field visibility
- [Improved] **View Modifier Evaluation**: Added `evalViewModifier()` helper using `evaluateBooleanExpr` for evaluating view modifiers against the current record context
- [Improved] **`optionalActiveFields` Initialization**: Added `this.optionalActiveFields = {}` in the controller setup to prevent potential undefined access errors.
- [Cleanup] Removed the custom `getActionMenuItems()` method; action menu items are now handled by the standard Odoo mechanism.
- [Cleanup] Removed unused `deleteConfirmationMessage` import from `confirmation_dialog`.
- [Cleanup] Removed unused `RelationalModel` import from `google_map_view.js`.
- [Cleanup] Removed the duplicate `downloadExport` method left over from a prior refactor.
- [Cleanup] Removed the unused `getExportedFields` method and its associated `rpc` import.

## 19.0.1.0.11

- [Fixed] **Marker Listener Storage Key**: Fixed `_storeMarkerEventListener` being called with `'click'` instead of `'gmp-click'`, ensuring the stored listener key matches the actual event name used for proper cleanup

## 19.0.1.0.10

- [Added] **Pin-style Markers with Letter Glyphs**: Map markers now use Google's native `PinElement` instead of custom HTML elements. Each pin displays the first letter of the record's title as a glyph, giving a cleaner, map-native appearance.
- [Added] **Styled Place Search Marker**: The place search result is now shown as a distinctive orange teardrop marker with a search icon, making it easy to distinguish from record markers.
- [Improved] **Selected Marker Feedback**: Selected markers now scale up (1.4×) and highlight with a blue border (`#4285F4`), making the active record immediately obvious on the map.
- [Improved] **Default Zoom Level**: Reduced the default zoom level when panning to a marker from 17 to 15 for better spatial context.
- [Improved] **Color Processing**: `processColor()` was refactored for cleaner null/undefined handling. `normalizeColor()` now returns immediately for hex colors without unnecessary DOM manipulation, improving performance.
- [Fixed] **Marker Click Event**: Changed marker event listener from the deprecated `click` to `gmp-click`, which is the correct event for `AdvancedMarkerElement`.
- [Fixed] **Color Field Bug**: Fixed a bug in `parseRecord()` where `normalizeColor()` was incorrectly called with the field name instead of the actual color value, causing markers to always fall back to the default color.

## 19.0.1.0.9

- [Removed] **Libraries Data File**: Deleted `data/gmap_libraries.xml` — the `geometry,places` library initializer is no longer needed following the removal of the libraries configuration system in `base_google_map`
- [Improved] **Places API (New) Compatibility**: Replaced deprecated `componentRestrictions` with `includedRegionCodes` in `PlaceAutocompleteElement` options, aligning with the Places API (New) specification
- [Improved] **Country Code Validation**: Added proper filtering of country codes — strips whitespace and rejects entries that are not exactly 2 characters
- [Improved] **Language Support**: Added `requestedLanguage` option to `PlaceAutocompleteElement` when language restriction is enabled in settings
- [Improved] **Region Support**: Added `requestedRegion` option to `PlaceAutocompleteElement` based on the configured region setting
- [Improved] **Autocomplete Placeholder**: Set a translated placeholder text (`Search for a place`) on the `PlaceAutocompleteElement`
- [Improved] **Event Listener Cleanup**: Stored the bound `gmp-select` listener reference (`_boundHandlePlaceSelect`) and use `removeEventListener` instead of `google.maps.event.clearListeners` for proper cleanup
- [Improved] **Lifecycle Hook**: Wrapped `_cleanup` call in `onWillUnmount` with an arrow function for correct binding
- [Improved] **Box Selection Accuracy**: Reset map tilt to `0` before activating the marker box selection mode to ensure accurate pixel-to-lat/lng coordinate conversion

## 19.0.1.0.8

- [Fixed] **Geolocate button**: Fixed issue where geolocate button sometimes display twice.

## 19.0.1.0.7

- [Improved] **Domain Filtering**: Enhanced geolocation filtering to use 'not in' operator with comprehensive null value checks (null, false, 0.0)
- [Improved] **Sidebar UI**: Added striped styling to sidebar table for better visual distinction between rows
- [Fixed] **Code Cleanup**: Removed unused GoogleMapViewMixins model and `_getActionFormView` method
- [Fixed] **Code Quality**: Removed unnecessary blank lines in `models/__init__.py`
- Changed mapDomain to use `'not in'` operator with `nullValues = [null, false, 0.0]` instead of separate `'!='` comparisons
- Applied consistent null checking for both direct and related lat/lng fields
- Removed `google_map_view_mixins.py` and its import from `models/__init__.py`
- Removed `_getActionFormView` method from GoogleMapController
- Added `table-striped` class to sidebar table template

## 19.0.1.0.6

- [Improved] **Marker Selection Mode Activation**: Simplified keyboard shortcut to use only Alt or Meta (Command) keys, removing Ctrl key support for more consistent cross-platform behavior
- [Improved] **Code Quality**: Refactored keyboard event handlers with cleaner conditional logic and improved readability
- Updated `handleKeyDown` to check only `altKey` or `metaKey` (removed `ctrlKey` check)
- Simplified nested conditionals in both `handleKeyDown` and `handleKeyUp` methods
- Improved code maintainability in AdvancedMarkerBoxSelector class

## 19.0.1.0.5

- [Fixed] **Group Expansion Logic**: Fixed `handleGroupCollapse` to properly check if group records exist before toggling, preventing unnecessary API calls
- [Fixed] **Group Deletion**: Fixed `deleteGroupRecords` to properly iterate through grouped data structure when collapsing groups
- [Fixed] **Selection State in Grouped View**: Fixed marker selection state synchronization when staying in grouped view, ensuring selected markers remain highlighted
- [Improved] **Grouped View Performance**: Added debounce cancellation before clearing markers when switching to grouped view, preventing conflicting operations
- [Improved] **Group UI State**: Groups that already have records loaded now display in expanded state by default, improving user experience
- [Improved] **Color Palette**: Updated `generateColor` with cleaner, more vibrant colors for better marker visibility (20 colors with improved readability)
- [Improved] **Responsive Design**: Removed excessive media query breakpoints (1600px and 1200px) for cleaner responsive behavior
- [Improved] **Template Attributes**: Fixed `t-attf-data-tooltip` to use proper `t-att-data-tooltip` syntax in sidebar template
- Cancelled `debounceRenderGeolocationData` before marker clearing to prevent race conditions
- Cancelled `debounceSelectedMarkers` and re-evaluated all marker selection states when in grouped view
- Updated group collapse class to conditionally show expanded state based on records length
- Simplified color array with hex colors and descriptive comments

## 19.0.1.0.4

- Removed unused methods (hideGroupRecordsMarker, centerMapByGroup)
- Improved event listener cleanup in clearMarkers and `_cleanUp`
- Added data-id attribute to info window action buttons
- Enhanced invertColorDarken utility with opacity support and better documentation
- Removed redundant info window operations in marker selection

## 19.0.1.0.3

Improve the visibility of data displayed on the map when grouping the data.

## 19.0.1.0.2

Fix bug where updating (clicking the "edit" button below Google Maps view in form view) a record's geolocation in form view opened in a pop-up window caused an error.

## 19.0.1.0.1

- Visual improvements when showing individual marker in the map.
- When a marker is part of a cluster, clicking its record in the sidebar will automatically zoom in to reveal the marker within the cluster.

## 19.0.1.0.0

Migration to version 19.0.

This module includes a feature that was previously defined in module `web_view_google_map_selector_area`. A module to allow selecting markers within a drawn area on the map. This feature has now been integrated into this module.
