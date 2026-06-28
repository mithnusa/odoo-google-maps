# -*- coding: utf-8 -*-
{
    "name": "Web widget Google Maps",
    "summary": "Google Maps embed widget for form views with an interactive coordinate-edit dialog",
    "description": """
Web Widget Google Maps
======================

Provides a ``google_map`` form widget that embeds a Google Maps preview and
an interactive coordinate-edit dialog in any Odoo form view.

Provides:

- ``GoogleMapWidget`` registered in the ``view_widgets`` registry as ``google_map``; renders a Google Maps Embed API ``<iframe>`` at the record's current coordinates with configurable ``zoom`` (default 14), ``maptype`` (``roadmap`` / ``satellite``), ``width`` (default 400 px), and ``height`` (default 200 px) XML attributes; falls back to world-level zoom when coordinates are ``(0, 0)``
- ``GeolocationEditDialog`` extending ``ConfirmationDialog``; initializes a full Google Maps JavaScript API instance via ``useGoogleMapsAPILoader`` and places an ``AdvancedMarkerElement`` with ``gmpDraggable: true`` at the current coordinates; drag-end position is stored locally and written to the record via ``record.update()`` on Save
- ``GoogleMapSearchPlaces`` component bundled in this module; used inside the geolocation dialog for place-autocomplete navigation before marker placement; also exported for consumption by ``web_view_google_map``'s map view
- ``GoogleMapGeolocate`` component bundled in this module; adds a browser geolocation button to any Google Map instance (``RIGHT_BOTTOM`` control position); places an ``AdvancedMarkerElement`` at the user's coordinates with an info window on click; exported for consumption by ``web_view_google_map``'s map view
- Read-only mode: edit button hidden, dialog marker non-draggable
- ``lat`` and ``lng`` XML attributes required; validated at component init with a clear error if the referenced fields are missing from the view
- ``GoogleMapStreetViewSideBySideDialog`` — opens an XL dialog with a Google Map on the left and Google Street View on the right; checks Street View coverage via ``StreetViewService`` before rendering and falls back to a marker-only map with an informational placeholder when no imagery is available at the given coordinates
""",
    "license": "LGPL-3",
    "author": "Yopi Angi",
    "website": "https://github.com/mithnusa",
    "support": "yopiangi@gmail.com",
    "category": "Extra Tools",
    "version": "19.0.1.0.6",
    "depends": ["base_google_map"],
    "assets": {
        "web.assets_backend": [
            "web_widget_google_map/static/src/components/geolocate/geolocate.scss",
            "web_widget_google_map/static/src/components/geolocate/geolocate.xml",
            "web_widget_google_map/static/src/components/geolocate/geolocate.js",
            "web_widget_google_map/static/src/components/search_places/search_places.scss",
            "web_widget_google_map/static/src/components/search_places/search_places.xml",
            "web_widget_google_map/static/src/components/search_places/search_places.js",
            "web_widget_google_map/static/src/widgets/GoogleMap/google_map.scss",
            "web_widget_google_map/static/src/widgets/GoogleMap/google_map.js",
            "web_widget_google_map/static/src/widgets/GoogleMap/google_map.xml",
            "web_widget_google_map/static/src/widgets/GoogleMapStreetViewSideBySideDialog/google_map_street_view_side_by_side_dialog.scss",
            "web_widget_google_map/static/src/widgets/GoogleMapStreetViewSideBySideDialog/google_map_street_view_side_by_side_dialog.js",
            "web_widget_google_map/static/src/widgets/GoogleMapStreetViewSideBySideDialog/google_map_street_view_side_by_side_dialog.xml",
        ],
    },
}
