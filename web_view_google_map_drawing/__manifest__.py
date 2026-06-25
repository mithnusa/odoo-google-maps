# -*- coding: utf-8 -*-
{
    "name": "Web View Google Map Drawing",
    "summary": "Extends the Google Map view with Terra Draw shape editing, Deck.gl rendering, and GeoJSON storage",
    "description": """
Web View Google Map Drawing
============================

Adds geographic shape drawing, editing, and storage to the Google Maps view.

Provides:

- ``SearchableJson`` field type extending Odoo's ``fields.Json`` with four JSONB-backed operators: ``json_eq``, ``json_ne``, ``json_contains``, ``json_not_contains``; ``JsonValue`` / ``JsonContainsValue`` wrapper types make values hashable for Odoo's ``OrderedSet`` domain optimizer
- ``google.drawing.shape`` abstract mixin adding ``gshape_name``, ``gshape_description``, ``gshape_geojson`` (``SearchableJson``), ``gshape_area``, and ``gshape_color`` to any model with a single ``_inherit`` declaration
- View validation override: ``geojson`` attribute required for ``js_class="google_map_drawing"`` views; warns if ``lat`` / ``lng`` are also set
- ``google_map_terra_draw`` OWL widget wrapping Terra Draw + Google Maps Adapter with 7 drawing modes: Point, LineString, Polygon, Rectangle, Circle, Freehand, and Select
- Smart rendering: automatically switches between Terra Draw (editable) and Deck.gl (GPU-accelerated, read-only) based on four thresholds — polygons with interior rings, 3D coordinates, ≥ 3 000 features, or ≥ 5 000 vertices
- Real-time area and perimeter measurements via Turf.js in metric or imperial units; ``field_area`` widget option writes the value back to a Float field on save
- GeoJSON import (up to 5 MB) and export; Terra Draw metadata stripped on export for clean standard output
- Douglas-Peucker geometry simplification (``Ctrl+E``) to bring complex imported shapes within editing limits
- Full undo/redo session history
- ``google_map_drawing`` view variant activated via ``js_class="google_map_drawing"`` on a ``<google_map>`` arch element
- ``google_map_drawing_one2many`` and ``google_map_drawing_many2many`` field widgets for embedding the drawing canvas in form views
- All three libraries (Terra Draw v1.31.1, Terra Draw Google Maps Adapter v1.6.1, Deck.gl v9.3.4, Turf.js v7.3.5) bundled locally as static assets and loaded on-demand via ``loadJS`` — no external CDN required
""",
    "license": "LGPL-3",
    "author": "Yopi Angi",
    "website": "https://www.mithnusa.com",
    "support": "yopiangi@gmail.com",
    "category": "Extra Tools",
    "version": "19.0.1.0.22",
    "depends": ["web_view_google_map"],
    "assets": {
        "web.assets_backend": [
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_drawing_view.scss",
            "web_view_google_map_drawing/static/src/views/components/deck-gl-editor/deck-gl-editor.scss",
            "web_view_google_map_drawing/static/src/views/components/terra-tools-ui/terra-tools-ui.scss",
            "web_view_google_map_drawing/static/src/views/components/upload_geojson_dialog/upload_geojson_dialog.scss",
            "web_view_google_map_drawing/static/src/widget/terra_draw/terra_draw.scss",
            "web_view_google_map_drawing/static/src/fields/x2many/google_map_drawing_x2many_field.scss",
            "web_view_google_map_drawing/static/src/utils/geometry_performance_utils.js",
            "web_view_google_map_drawing/static/src/utils/map_config.js",
            "web_view_google_map_drawing/static/src/utils/utils.js",
            "web_view_google_map_drawing/static/src/widget/terra_draw/terra_draw.js",
            "web_view_google_map_drawing/static/src/widget/terra_draw/terra_draw.xml",
            "web_view_google_map_drawing/static/src/views/components/deck-gl-editor/deck-gl-editor.js",
            "web_view_google_map_drawing/static/src/views/components/deck-gl-editor/deck-gl-editor.xml",
            "web_view_google_map_drawing/static/src/views/components/terra-tools-ui/terra-tools-ui.js",
            "web_view_google_map_drawing/static/src/views/components/terra-tools-ui/terra-tools-ui.xml",
            "web_view_google_map_drawing/static/src/views/components/upload_geojson_dialog/upload_geojson_dialog.js",
            "web_view_google_map_drawing/static/src/views/components/upload_geojson_dialog/upload_geojson_dialog.xml",
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_drawing_arch_parser.js",
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_drawing_model.js",
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_drawing_sidebar.js",
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_drawing_sidebar.xml",
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_deckgl_renderer.js",
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_deckgl_renderer.xml",
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_drawing_controller.js",
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_drawing_controller.xml",
            "web_view_google_map_drawing/static/src/views/google_map_drawing/google_map_drawing_view.js",
            "web_view_google_map_drawing/static/src/fields/x2many/google_map_drawing_x2many_field.js",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
