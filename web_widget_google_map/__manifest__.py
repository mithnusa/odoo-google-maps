# -*- coding: utf-8 -*-
{
    "name": "Web widget Google Maps",
    "summary": "Google Maps widget for form views — single-button access to an interactive coordinate-edit dialog",
    "description": """
Web Widget Google Maps
======================

Provides a ``google_map`` form widget that renders a single button opening a
full interactive Google Maps dialog directly from any Odoo form view.

Provides:

- ``GoogleMapWidget`` registered in the ``view_widgets`` registry as ``google_map``; renders a single contextual button — "View on Map" in read-only mode, "Update on Map" in edit mode — that opens ``GeolocationEditDialog`` centred on the record's current coordinates; ``lat`` and ``lng`` XML attributes required; ``maptype`` (``roadmap`` / ``satellite``) optional
- ``GeolocationEditDialog`` extending ``ConfirmationDialog``; initializes a full Google Maps JavaScript API instance via ``useGoogleMapsAPILoader`` and places an ``AdvancedMarkerElement`` with ``gmpDraggable: true`` at the current coordinates; drag-end position is stored locally and written to the record via ``record.update()`` on Save; async unmount guards (``_isUnmounted``, ``_tilesLoadedListener``, ``clearInstanceListeners``) prevent stale callbacks after the dialog closes
- ``GoogleMapSearchPlaces`` component bundled in this module; used inside the geolocation dialog for place-autocomplete navigation before marker placement; also exported for consumption by ``web_view_google_map``'s map view
- ``GoogleMapGeolocate`` component bundled in this module; adds a browser geolocation button to any Google Map instance (``RIGHT_BOTTOM`` control position); places an ``AdvancedMarkerElement`` at the user's coordinates with an info window on click; exported for consumption by ``web_view_google_map``'s map view
- Read-only mode: dialog marker non-draggable, Save button hidden, "Open in Google Maps" link active
- ``GoogleMapStreetViewSideBySideDialog`` — opens an XL dialog with a Google Map on the left and Google Street View on the right; checks Street View coverage via ``StreetViewService`` before rendering and falls back to a marker-only map with an informational placeholder when no imagery is available at the given coordinates
""",
    "license": "LGPL-3",
    "author": "Yopi Angi",
    "website": "https://www.mithnusa.com",
    "support": "yopiangi@gmail.com",
    "category": "Extra Tools",
    "version": "19.0.1.0.9",
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
