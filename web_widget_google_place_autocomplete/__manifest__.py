# -*- coding: utf-8 -*-
{
    'name': 'Web widget Google Place Autocomplete',
    'summary': 'Configurable Google Places autocomplete widget and field mapping system for any Odoo model',
    'description': """
Web Widget Google Place Autocomplete
=====================================

Provides the ``gplace_autocomplete_el`` widget and the ``google.places.mapping``
configuration system for connecting the Google Places API (New) to any Odoo field.

Provides:

- ``google.places.mapping`` model: unique ``code`` (SQL-unique), ``model_id``, ``mode`` (``places`` / ``address``), optional ``PlaceAutocompleteElement`` options (``gplace_options``), fetch-field lists, ``latitude`` / ``longitude`` Many2one fields pointing to ``ir.model.fields``, ``active``, ``sequence``; computed ``is_address_component_missing`` and ``is_location_field_missing`` warning flags shown as inline alerts on the mapping form; ``unlink`` override prevents deletion while the mapping is referenced in views
- ``google.places.mapping.address.line``: maps a Google address component list to an Odoo field with ``text_option`` (``shortText`` / ``longText``), ``handling_mode`` (``direct`` / ``fallback`` / ``concat``), and ``separator`` (space, comma, hyphen, underscore, slash, new line); SQL-unique per mapping
- ``google.places.mapping.other.line``: maps a single Google Places property key (e.g. ``displayName``, ``internationalPhoneNumber``) to any stored Odoo field; SQL-unique per mapping
- ``google_street_format`` selection field on ``res.country`` (``route_street_number`` / ``street_number_route``); used in ``parse_place`` to assemble the street string in the correct order for each country
- ``parse_place()`` server-side method: resolves address components in country → state → other-relational → text priority order, assembles concatenated / fallback / direct text fields, resolves ``Many2one`` country and state records by name or code, returns a structured dict with ``address``, ``geolocation``, and ``other`` keys ready for ``record.update()``
- ``get_widget_mapping_by_code()`` and ``get_widget_mapping_by_mode()``: serve the mapping configuration to the frontend, validated against the calling record's model
- ``useGooglePlaceAutocompleteMapping`` OWL hook: fetches the mapping config from the backend at panel-open time and exposes a shared widget-ID generator
- ``GooglePlaceAutocompleteElement`` OWL component: wraps Google's ``PlaceAutocompleteElement`` (Places API New) and calls ``parse_place`` on selection, returning structured data to the parent widget
- ``gplace_autocomplete_el`` widget: extends ``CharField``; accepts ``mapping_code`` (priority) or ``mapping_mode`` as options; ``no_manual_edit`` option makes the input read-only; validates and fetches mapping on panel open; writes all mapped values in a single atomic ``record.update()``
- ``GooglePlaceMappingTestField`` widget: embeds a live autocomplete test inside the mapping configuration form, showing parsed address, other, geolocation, and raw API JSON for any selected place
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.0',
    'depends': ['base_google_map'],
    'assets': {
        'web.assets_backend': [
            'web_widget_google_place_autocomplete/static/src/widgets/GooglePlaceAutocompleteElement/google_place_autocomplete_element.scss',
            'web_widget_google_place_autocomplete/static/src/widgets/GooglePlaceMappingTest/google_place_mapping_test.scss',
            'web_widget_google_place_autocomplete/static/src/hooks/use_google_place_autocomplete_mapping.js',
            'web_widget_google_place_autocomplete/static/src/component/google_place_autocomplete.js',
            'web_widget_google_place_autocomplete/static/src/component/google_place_autocomplete.xml',
            'web_widget_google_place_autocomplete/static/src/widgets/GooglePlaceAutocompleteElement/google_place_autocomplete_element.js',
            'web_widget_google_place_autocomplete/static/src/widgets/GooglePlaceAutocompleteElement/google_place_autocomplete_element.xml',
            'web_widget_google_place_autocomplete/static/src/widgets/GooglePlaceMappingTest/google_place_mapping_test.js',
            'web_widget_google_place_autocomplete/static/src/widgets/GooglePlaceMappingTest/google_place_mapping_test.xml',
        ],
    },
    'data': [
        'views/res_country.xml',
        'views/google_places_mapping_views.xml',
        'security/ir.access.csv',
    ],
}
