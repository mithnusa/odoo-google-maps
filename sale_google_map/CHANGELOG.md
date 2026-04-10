# Change Log

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
