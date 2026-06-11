# Web View Google Map Drawing - Features

## Drawing Tools

**What it does**: Provides seven interactive drawing modes for creating and editing geographic shapes directly on a Google Map.

**Why it matters**: Users can capture service territories, routes, boundaries, and coverage areas inside Odoo without needing external GIS software.

**How it works**: A drawing toolbar appears on the map. Each mode creates a different shape type:

- **Point**: Click to place a location marker
- **LineString**: Click to add waypoints and form a connected path
- **Polygon**: Click to define vertices, close to form a filled area
- **Rectangle**: Drag to draw a rectangular area
- **Circle**: Click and drag to define center and radius
- **Freehand**: Draw naturally with the cursor, shape is auto-smoothed
- **Select**: Click and drag vertices to modify existing shapes

Keyboard shortcuts are available for switching modes (keys `1`–`7`), saving (`Ctrl+S`), undoing (`Ctrl+Z`), simplifying (`Ctrl+E`), and deleting selected features (`Delete`).

---

## GeoJSON Storage

**What it does**: Stores all drawn shapes as GeoJSON in a dedicated field on the Odoo model, with a custom field type that supports geographic filtering.

**Why it matters**: GeoJSON is a universal geospatial standard supported by all major mapping tools, enabling data portability and server-side filtering.

**How it works**: The module provides a `SearchableJson` field type that extends Odoo's standard JSON field with four additional search operators: `json_eq`, `json_ne`, `json_contains`, and `json_not_contains`. These map to PostgreSQL JSONB operators, allowing domain filters like "find all records whose shape is a polygon" directly from the Odoo ORM.

| Operator | Description |
| --- | --- |
| `json_eq` | Exact match — returns records whose GeoJSON is structurally identical to the given value |
| `json_ne` | Not equal — returns records with a different value, including records with no GeoJSON at all |
| `json_contains` | Containment — returns records whose GeoJSON contains the given sub-object (PostgreSQL `@>` operator) |
| `json_not_contains` | Not contains — returns records that do not contain the sub-object, including records with no GeoJSON |

Records with no GeoJSON stored (NULL) are correctly included in `json_ne` and `json_not_contains` results. Standard Odoo `= False` and `!= False` operators also work correctly on the field for explicit NULL checks.

---

## Google Drawing Shape Mixin

**What it does**: Provides a reusable base for any Odoo model that needs drawing capabilities, adding four standard fields automatically.

**Why it matters**: Any model can gain shape storage by inheriting from a single mixin, without manually defining fields.

**How it works**: Inheriting `google.drawing.shape` adds:

- `gshape_name`: Display name for the shape
- `gshape_geojson`: The GeoJSON data (SearchableJson field)
- `gshape_area`: Auto-calculated area in square meters (Float)
- `gshape_color`: Color picker value for visual identification (Integer)

---

## Intelligent Rendering: Terra Draw vs Deck.gl

**What it does**: Automatically selects the best rendering engine based on the complexity and size of the geographic data being displayed.

**Why it matters**: Terra Draw is ideal for editing but has hard limits on geometry complexity. Deck.gl uses GPU acceleration and handles very large datasets without freezing the browser.

**How it works**: When data is loaded, the module analyses the geometry and routes to the appropriate engine:

| Condition | Engine | Reason |
|---|---|---|
| Simple polygons, small datasets | Terra Draw | Full editing available |
| Polygons with holes (interior rings) | Deck.gl | Not supported by Terra Draw |
| 3D coordinates (altitude data) | Deck.gl | Not supported by Terra Draw |
| 3,000+ total features | Deck.gl | Performance threshold exceeded |
| 5,000+ total vertices | Deck.gl | Performance threshold exceeded |

When Deck.gl is active, a notice is shown to users explaining that direct editing is unavailable and import/export should be used instead.

---

## Area and Length Measurements

**What it does**: Calculates and displays area and perimeter measurements as shapes are drawn, and stores the area value back into a configurable field.

**Why it matters**: Gives users immediate feedback on shape size during drawing, and enables area-based reporting and analysis in Odoo.

**How it works**: Uses the Turf.js library for accurate geodesic calculations. Measurements are shown in human-readable units:

- Area: m², ha, or km² (metric) / ft², ac, or mi² (imperial)
- Length: m or km (metric) / ft, yd, or mi (imperial)

The `field_area` widget option can point to a Float field on the model; the calculated area is written to that field automatically on save.

---

## Import and Export GeoJSON

**What it does**: Allows users to upload GeoJSON files created in external tools and download the current shapes as a GeoJSON file.

**Why it matters**: Bridges the gap between Terra Draw's editing limitations and real-world geospatial data. Complex shapes (polygons with holes, 3D geometries, large datasets) can be created in tools like QGIS or geojson.io and imported directly into Odoo.

**How it works**: An upload button (↑) accepts `.geojson` or `.json` files up to 5 MB. After import, the module analyses the geometry and switches to Deck.gl automatically if the data is too complex to edit. A download button (↓) exports current features as a clean GeoJSON file (internal Terra Draw metadata is stripped before export).

---

## Geometry Simplification

**What it does**: Reduces the number of vertices in complex shapes to bring them within Terra Draw's editing limits, while preserving the overall shape.

**Why it matters**: Shapes imported from national mapping agencies or aerial surveys often contain thousands of vertices. Simplification makes them editable without freezing the browser.

**How it works**: Uses the Douglas-Peucker algorithm (standard geographic simplification). Users can trigger simplification by pressing `Ctrl+E` or clicking the simplify button when a complex feature is selected. The module applies a tolerance based on complexity level, replacing the original feature with a simplified version.

---

## Drawing Map View Type

**What it does**: Adds a `google_map_drawing` view type that displays records with GeoJSON shapes as an interactive layer on a map.

**Why it matters**: Enables spatial overview of all shapes associated with a model — useful for visualising territories, boundaries, or asset locations across a region.

**How it works**: Declare the view with `js_class="google_map_drawing"` and a `geojson` attribute pointing to the GeoJSON field. Shapes are rendered as a coloured overlay on the map. Clicking a shape opens that record's details. The view supports all standard `web_view_google_map` attributes (`sidebar_title`, `color`, `map_type`, etc.) and adds the `geojson` attribute.

---

## Embedded Drawing Widget in Form Views

**What it does**: Embeds an interactive drawing map directly inside a form view for One2many or Many2many fields.

**Why it matters**: Users can draw and edit shapes for related records without leaving the parent form, keeping all spatial data in context.

**How it works**: Apply `widget="google_map_drawing_one2many"` or `widget="google_map_drawing_many2many"` to the field in the form arch XML, with `mode="google_map"` and a `<google_map js_class="google_map_drawing">` child element defining the view. The embedded map shows all related shapes and supports full drawing and editing.

---

## Deck.gl High-Performance Viewer

**What it does**: Renders very large datasets of geographic shapes using GPU acceleration, with interactive tooltips, hover highlighting, and feature selection.

**Why it matters**: Datasets with thousands of polygons or points would freeze a standard browser renderer. The GPU-based viewer maintains smooth 60fps interaction regardless of dataset size.

**How it works**: When data exceeds Terra Draw's limits, the renderer switches to Deck.gl. Users can hover over shapes to see measurement tooltips (area, perimeter, vertex count), click to select features, and use import/export for any edits.

---

## Nearby Records (Drawing View)

The "Show Nearby" button is intentionally removed from the drawing view's sidebar. The nearby search action is not applicable in the drawing context and is inherited from the base map view.

---

## Bundled Libraries

**What it does**: Ships all required geospatial libraries as local static assets, avoiding external CDN dependencies.

**Why it matters**: Ensures the module works in air-gapped or restricted network environments, and prevents version conflicts with CDN updates.

**Included libraries**:

- **Terra Draw** (v1.30.1): Drawing tools and feature editing
- **Terra Draw Google Maps Adapter** (v1.6.0): Integration layer between Terra Draw and the Google Maps JavaScript API
- **Deck.gl** (v9.3.2): GPU-accelerated rendering for large datasets
- **Turf.js** (v7.3.5): Geospatial calculations (area, distance, simplification)
