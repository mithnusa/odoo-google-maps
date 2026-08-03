# -*- coding: utf-8 -*-
{
    "name": "Web View Google Map",
    "summary": "Core Google Maps view type for Odoo with clustering, grouping, nearby search, and dark mode",
    "description": """
Web View Google Map
===================

Registers the ``google_map`` view type in Odoo and provides the full
frontend stack for displaying records as interactive map markers.

Provides:

- ``google_map`` view type registered on ``ir.ui.view`` and ``ir.actions.act_window.view``; view validation enforces ``lat``, ``lng``, and ``sidebar_title`` attributes, and verifies all referenced fields are declared in the view's ``<field>`` nodes
- ``_get_view_fields`` override that auto-loads ``id`` and ``write_date`` for all ``google_map`` views
- ``google_map_one2many`` and ``google_map_many2many`` field widgets for embedding a map inside a form view's x2many field
- ``nearby_radius_search`` Integer setting on ``res.config.settings`` (default: 1000 m), served to the frontend via the ``map_setting`` controller
- ``GoogleMapArchParser``, ``GoogleMapModel``, ``GoogleMapRenderer``, ``GoogleMapController``, and ``GoogleMapView`` — the full OWL view stack
- Sidebar panel synced with the map; collapsible group headers when group-by is active; each group assigned one of 20 distinct colors
- MarkerClusterer (v2.6.2, loaded on-demand via ``loadJS``) for clustering markers at low zoom; disable per view with ``disable_cluster_marker="1"``
- Overlapping-marker spread: same-coordinate records offset in a circle with a line drawn back to the true location on zoom-in
- Multi-selection via Alt/Cmd-drag rectangle; Shift-drag extends selection
- ``GoogleMapGeolocate`` component (sourced from ``web_widget_google_map``): shows the user's browser location on the map
- ``GoogleMapSearchPlaces`` component (sourced from ``web_widget_google_map``): in-map Google Places autocomplete using ``PlaceAutocompleteElement`` (requires Places API New and the "Enable Google Places Search" setting)
- Nearby-records search: bounding-box domain filter with rectangle overlay and view-title update; antimeridian wraparound handled
- Google Maps external links (navigation and search) in every marker info window
- Street View button in every marker info window; opens ``GoogleMapStreetViewSideBySideDialog`` (from ``web_widget_google_map``) with a side-by-side map and Street View panel, falling back to a marker-only map when no imagery is available
- Dark mode: separate ``*.dark.scss`` stylesheet loaded via ``web.dark_mode_assets_backend``
- ``uninstall_hook`` that removes the ``google_map`` view mode from all ``ir.actions.act_window`` records on uninstall
""",
    "license": "LGPL-3",
    "author": "Yopi Angi (Mithnusa), Brian McMaster (McMaster Lawn & Pest Services)",
    "website": "https://github.com/mithnusa",
    "support": "yopiangi@gmail.com",
    "category": "Extra Tools",
    "version": "19.0.2.0.1",
    "depends": ["base_google_map", "web_widget_google_map"],
    "data": ["views/res_config_settings.xml"],
    "assets": {
        "web.assets_backend": [
            "web_view_google_map/static/src/views/google_map/google_map_view.scss",
            "web_view_google_map/static/src/views/google_map/google_map_sidebar.scss",
            "web_view_google_map/static/src/fields/x2many/google_map_x2many_fields.scss",
            "web_view_google_map/static/src/helpers/view_attrs_context_manager.js",
            "web_view_google_map/static/src/views/google_map/utils.js",
            "web_view_google_map/static/src/views/google_map/google_map_arch_parser.js",
            "web_view_google_map/static/src/views/google_map/google_map_model.js",
            "web_view_google_map/static/src/views/google_map/google_map_search_bar.js",
            "web_view_google_map/static/src/views/google_map/google_map_sidebar.js",
            "web_view_google_map/static/src/views/google_map/google_map_sidebar.xml",
            "web_view_google_map/static/src/views/google_map/google_map_renderer.js",
            "web_view_google_map/static/src/views/google_map/google_map_renderer.xml",
            "web_view_google_map/static/src/views/google_map/google_map_controller.js",
            "web_view_google_map/static/src/views/google_map/google_map_controller.xml",
            "web_view_google_map/static/src/views/google_map/google_map_view.js",
            "web_view_google_map/static/src/fields/x2many/google_map_x2many_field.js",
            "web_view_google_map/static/src/fields/x2many/google_map_x2many_field.xml",
        ],
        "web.dark_mode_assets_backend": [
            "web_view_google_map/static/src/views/google_map/google_map_view.dark.scss",
        ],
        "web.assets_unit_tests": [
            "web_view_google_map/static/tests/**/*",
        ],
    },
    "uninstall_hook": "_uninstall_view_google_map",
}
