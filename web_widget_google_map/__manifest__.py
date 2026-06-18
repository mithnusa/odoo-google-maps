# -*- coding: utf-8 -*-
{
    'name': 'Web widget Google Maps',
    'summary': 'Google Maps embed widget for form views with an interactive coordinate-edit dialog',
    'description': """
Web Widget Google Maps
======================

Provides a ``google_map`` form widget that embeds a Google Maps preview and
an interactive coordinate-edit dialog in any Odoo form view.

Provides:

- ``GoogleMapWidget`` registered in the ``view_widgets`` registry as ``google_map``; renders a Google Maps Embed API ``<iframe>`` at the record's current coordinates with configurable ``zoom`` (default 14), ``maptype`` (``roadmap`` / ``satellite``), ``width`` (default 400 px), and ``height`` (default 200 px) XML attributes; falls back to world-level zoom when coordinates are ``(0, 0)``
- ``GeolocationEditDialog`` extending ``ConfirmationDialog``; initializes a full Google Maps JavaScript API instance via ``useGoogleMapsAPILoader`` and places an ``AdvancedMarkerElement`` with ``gmpDraggable: true`` at the current coordinates; drag-end position is stored locally and written to the record via ``record.update()`` on Save
- ``GoogleMapSearchPlaces`` component from ``web_view_google_map`` reused inside the dialog for place-autocomplete navigation before marker placement
- Read-only mode: edit button hidden, dialog marker non-draggable
- ``lat`` and ``lng`` XML attributes required; validated at component init with a clear error if the referenced fields are missing from the view
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.5',
    'depends': ['base_google_map', 'web_view_google_map'],
    'assets': {
        'web.assets_backend': [
            'web_widget_google_map/static/src/widgets/GoogleMap/google_map.scss',
            'web_widget_google_map/static/src/widgets/GoogleMap/google_map.js',
            'web_widget_google_map/static/src/widgets/GoogleMap/google_map.xml',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
