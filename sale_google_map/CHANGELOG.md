<!-- markdownlint-disable MD024 -->
# Change Log

## 19.0.1.0.10

- [Removed] **`google_map_sidebar.scss`**: Deleted the module-specific sidebar SCSS file — the viewport-based media-query breakpoints for `.o_map_sidebar_group` max-width are now superseded by the `clamp()`-based rule added to the base `web_view_google_map` sidebar styles, making the per-module overrides redundant

## 19.0.1.0.9

### Performance

- **Pre-unfolded Groups on Load**: `GoogleMapControllerSaleOrder.modelParams` now sets `openGroupsByDefault: true` on the model config when `defaultGroupBy` is active; this passes `auto_unfold: true` to `web_read_group`, returning each group's records in the initial RPC and eliminating the per-group `web_search_read` that `group.toggle()` would otherwise fire
- **Immediate Group Loading on Mount**: `loadGroupRecord` is now called directly in `onMounted` instead of through the debounced wrapper, eliminating the 500 ms forced wait before the first group toggle RPC fires
- **Reduced `onWillUpdateProps` Debounce**: Debounce delay for prop-triggered group loading reduced from 500 ms to 200 ms, cutting re-render latency after filter or search changes while still batching rapid updates

### Improved

- **Marker Display Name Shows Count**: `_createMarkerElement` now renders the group display name as `"{Customer} ({count})"` using `sprintf`, giving a quick visual count of orders per customer directly on the map marker
- **Manifest Description**: Expanded `summary` and `description` in `__manifest__.py` to document key features, supported action windows, and configuration requirements

## 19.0.1.0.8

### Added

- **"Find Nearby Records" Button on Markers**: Each marker now renders a second action button (fa-location-arrow) alongside the existing "Open" button; clicking it calls `searchNearbyRecords` for the group's first record
- **"Nearby" Button in Sidebar**: Added a `fa-location-arrow` button in the sidebar group header that triggers `props.showNearbyRecords` for the group's first record
- **`getTotalAmount` in Sidebar**: New method on `GoogleMapSidebarSaleOrder` that returns a formatted `$ amount_total` string using `formatNumber` and the current user locale; displayed as a `<small>` line below the group title in the sidebar
- **`HOVER_EFFECT_DURATION_MS` Constant**: Extracted the hardcoded `1000` ms hover-effect timeout into a named constant for clarity

### Improved

- **Stored Geolocation Fields**: `partner_latitude` and `partner_longitude` related fields now have `store=True`, enabling direct DB queries on sale orders without joining to `res.partner`
- **Marker Layout**: Updated CSS classes — layout changed from `justify-content-end` to `justify-content-around`; info section is now `d-flex flex-column gap-1`; order name has `py-1 border-bottom` styling; `INFO_ICON` no longer floats right
- **Marker Width**: Increased from `250px` to `280px` to accommodate the new two-button action column
- **`_createActionButtons` Container**: Refactored single `_createActionButton` into `_createActionButtons` which composes `_createActionOpenButton` and `_createActionNearbyButton` inside a `d-flex flex-column` wrapper
- **Sidebar Group Item Layout**: Redesigned using a flex row — avatar thumbnail, title + total amount column side by side; replaced bare `<span>` with a structured `d-flex flex-column` sub-layout
- **`onWillUpdatePropsRenderMarkers`**: Now shows an `info` notification when the view is not grouped, informing the user that grouped data is required for markers to appear
- **`handleMouseLeave`**: Also removes the `marker-drop-animation` class on mouse-leave, not only `marker-hover-animation`, preventing the drop animation from persisting after hover ends
- **SCSS Responsive Breakpoints**: Added a `2560px` breakpoint (`max-width: 220px`); tightened existing breakpoint widths (1920px: 250px → 200px, 1600px: 230px → 180px); added new `1200px` breakpoint at `140px`; fixed missing newline at end of file
- **JSDoc `@override`**: Corrected `@overwrite` typo to `@override` in `onWillUpdatePropsRenderMarkers`

### Removed

- **`partner_contact_address` Field**: Removed the `related` field and its references in both google_map view definitions — address data is no longer passed to the frontend view
- **`console.error` / `console.warn` Calls**: Replaced noisy console statements in marker creation and click-handler error paths with silent failures (`_error` convention), keeping individual marker failures from polluting the browser console

### Fixed

- **`_createActionButton` Rename**: Method split and renamed to `_createActionOpenButton` / `_createActionOpenButtonIcon` for clarity; callers updated accordingly

## 19.0.1.0.7

### Fixed

- **`GoogleMapSidebarSaleOrder` — UI Block Restored**: Re-introduced `uiService.block()` / `uiService.unblock()` around the batch group-toggling loop to prevent user interaction during loading; added the required `useService('ui')` import and hook call

## 19.0.1.0.6

### Marker Animations

- [Added] **Marker Hover Glow Animation**: Added `markerBorderGlow` keyframe animation to `.marker-hover-animation` — pulses a blue `outline` on the marker border once on hover
- [Improved] **Marker Hover Scale**: Replaced `font-size: large` with `transform: translateY(-8px) scale(1.06)` to enlarge the marker on hover without affecting the layout hit-box, fixing hover oscillation/jitter

### Bug Fixes

- [Fixed] **Hover Jitter / Oscillation**: `font-size: large` caused the marker to resize its layout bounds, triggering a `mouseleave`/`mouseenter` loop — replaced with `transform: scale()` which is compositor-only and does not affect the hit-box
- [Fixed] **Customer Logo Guard**: Strengthened `_createCustomerLogo` null check — now validates `partnerId` with `Number.isFinite` and `typeof === 'number'` before rendering the avatar image
- [Fixed] **Avatar URL Guard**: Applied the same `Number.isFinite` + `typeof` guard in `getAvatarUrl()` to prevent invalid partner IDs from generating broken image URLs

### Improvements

- [Improved] **`GoogleMapControllerSaleOrder`**: Removed the custom `static template` override and replaced it with a `modelParams` getter that sets `maxGroupByDepth = 1` when `defaultGroupBy` is active, limiting group nesting depth
- [Removed] **`google_map_controller.xml`**: Deleted the custom XML template that hid the `SearchBar` — now handled natively by the parent controller's search bar toggler
- [Improved] **`GoogleMapSidebarSaleOrder` — Debounced Loading**: Replaced `setTimeout` + `tilesloaded` listener with a `debounce`-based `loadGroupRecord` call on `onMounted` and `onWillUpdateProps`, ensuring groups are loaded reliably on mount and on prop changes
- [Improved] **`GoogleMapSidebarSaleOrder` — Batched Group Toggling**: Groups are now toggled in batches of 10 instead of all at once via `Promise.all`, reducing the risk of overwhelming the server with concurrent requests
- [Improved] **`GoogleMapSidebarSaleOrder` — Loading Guard**: Added `_isLoading` flag to prevent concurrent `loadGroupRecord` executions
- [Removed] **`GoogleMapSidebarSaleOrder` — UI Block**: Removed `uiService.block()` / `uiService.unblock()` calls — group loading no longer blocks the entire UI
- [Improved] **`onWillUpdatePropsRenderMarkers`**: Added override to debounce and re-render grouped markers when props update, cancelling any in-flight debounce before re-queuing
- [Improved] **SCSS Cleanup**: Removed all vendor prefixes, moved `@keyframes` to root level, updated `:after` to `::after`, and removed unused `opacity` and `font-size` transition

## 19.0.1.0.5
### Performance Improvements
- Added marker caching to prevent duplicate marker creation for existing groups
- Optimized loadGroupRecord method to skip groups that already have loaded records
- Reduced unnecessary group toggle operations for better performance

### UI/UX Enhancements
- Enabled marker clustering for better map organization (removed disable_cluster_marker attribute)
- Standardized marker width to fixed 250px for consistent display
- Removed collision behavior setting for cleaner marker management

### Code Quality
- Improved group filtering logic in sidebar to avoid redundant processing
- Enhanced cache utilization in marker creation workflow

## 19.0.1.0.4
- Removed unused action button reference storage
- Added data-id attribute to action buttons for better traceability
- Improved code quality with consistent variable naming (datas → data)
- Simplified parameter destructuring in getAvatarUrl method

## 19.0.1.0.3
- Enhanced marker visual design with color-coded left borders matching group colors
- Improved marker container sizing with flexible min/max width (250px-400px) for better responsiveness
- Added responsive design support for screens 1600px and below
- Fixed partner avatar field reference (changed from `image_128` to `avatar_128`)


## 19.0.1.0.2
Small UI improvements on the map sidebar.

## 19.0.1.0.1
- Clean up code, no functional changes.
- Visual improvements when showing individual marker in the map.

## 19.0.1.0.0
Migration to version 19.0
