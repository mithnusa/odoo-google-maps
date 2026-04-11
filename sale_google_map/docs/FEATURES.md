# Sales Google Maps - Features

## Map View

### Customer-Grouped Markers
**What it does**: Displays one marker per customer on the map, rather than one per sales order.

**Why it matters**: A customer with many orders would otherwise flood the map with overlapping markers. Grouping gives a clean, readable overview of where your business is geographically concentrated.

**How it works**: The map view requires records to be grouped by customer (partner). Each group produces a single `AdvancedMarkerElement` placed at the customer's geolocated address.

---

### Marker Content
**What it does**: Each marker shows the customer name, aggregated order total, and customer avatar (when available).

**Why it matters**: Sales teams can scan the map and immediately see the value of each customer's orders without opening any records.

**How it works**: The marker renders a card with a color-coded left border (matching the group color), the customer's `avatar_128` image, the group display name, and the sum of `amount_total` for all orders in the group, formatted according to the user's locale.

---

### Overlap Indicator
**What it does**: When two customers share the exact same address, one marker is shifted slightly so both remain visible. The shifted marker displays a small info icon indicating it has been moved.

**Why it matters**: Without this, one marker would be hidden behind the other with no way to interact with it.

**How it works**: The renderer detects position collisions and applies a small positional offset. A tooltip on the indicator icon explains the adjustment to the user.

---

### Marker Hover Animation
**What it does**: Hovering over a marker lifts it upward and applies a blue glow animation on the border.

**Why it matters**: Makes it easy to identify which marker is being interacted with, especially when markers are close together.

**How it works**: `mouseenter` and `touchstart` events add `marker-hover-animation` CSS class; `mouseleave` and `touchend` remove it. The animation uses `transform: translateY` and a `box-shadow` keyframe, which avoids layout reflow.

---

### Auto-Hover After Zoom
**What it does**: When the map auto-zooms to a marker (e.g. when clicking a sidebar entry), the targeted marker briefly triggers its hover animation automatically.

**Why it matters**: Gives clear visual confirmation of which marker the map just navigated to.

**How it works**: After zooming, a synthetic `mouseenter` event is dispatched on the marker content; a `mouseleave` event is dispatched after `1000ms` to reset the state.

---

### Grouped-Only Enforcement
**What it does**: If the view is loaded without a group-by applied, the map renders no markers and shows an info notification asking the user to group the records.

**Why it matters**: Ungrouped sale orders can number in the thousands. Loading them all as individual markers would be slow and visually unusable.

**How it works**: `onWillUpdatePropsRenderMarkers` checks `list.isGrouped` before rendering; if false it shows a notification via `notificationService` and returns early.

---

## Sidebar

### Sidebar Group List
**What it does**: The left-hand panel lists all customer groups with their avatar, name, order count, and aggregated order total.

**Why it matters**: Provides a searchable, scrollable list of all customers on the map so users can find a specific customer without panning the map.

**How it works**: Each sidebar item renders the customer avatar (from `avatar_128`), the group display name + count as a tooltip, and the `amount_total` aggregate formatted with `formatNumber`.

---

### Pin-Point in Map
**What it does**: Clicking a sidebar group entry pans and zooms the map to that customer's marker.

**Why it matters**: Allows quick navigation to a specific customer without manually finding their marker on the map.

---

### "Find Nearby" Button in Sidebar
**What it does**: Each sidebar group entry has a location-arrow button that triggers a nearby-records search centered on that customer.

**Why it matters**: Lets sales reps quickly discover other customers in the same area without leaving the map view.

---

### Automatic Group Loading
**What it does**: When the map view opens, all groups are automatically expanded in batches so their markers appear without any manual action.

**Why it matters**: Without this, the sidebar would show collapsed groups and the map would be empty until the user manually expanded each one.

**How it works**: On `onMounted` and `onWillUpdateProps`, a debounced `loadGroupRecord` call iterates through folded groups in batches of 10 and toggles them open. The UI is blocked during this process to prevent interaction conflicts.

---

## Marker Actions

### Open Records
**What it does**: The arrow button (→) on each marker opens a filtered list of all sales orders for that customer.

**Why it matters**: Provides direct access from the map to the underlying order records.

**How it works**: The click handler calls `props.showRecordsByDomain` with the group's domain, opening a dialog or list view scoped to that customer's orders.

---

### Find Nearby Records (Marker)
**What it does**: The location-arrow button on each marker searches for other customers near that marker's position.

**Why it matters**: Useful for planning visits — a sales rep can see which other customers are in the same area as the one they just spotted on the map.

**How it works**: Click calls `searchNearbyRecords` with the group's first record; shows a warning notification if the group has no records.
