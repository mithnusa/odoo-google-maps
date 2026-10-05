{
    'name': 'Partner Autocomplete with Google Autocomplete',
    'summary': 'Combines Odoo partner autocomplete with a Google Places panel on the Contact name field',
    'description': """
Partner Autocomplete with Google Autocomplete
=============================================

Extends Odoo's built-in partner autocomplete on ``res.partner`` with a
side-by-side Google Places autocomplete panel.

Provides:

- ``_get_view()`` override on ``res.partner`` that automatically applies the combined widget to every ``name`` field on all partner form views — no per-module view XML changes required
- ``field_partner_autocomplete_with_google_place`` field widget extending ``PartnerAutoCompleteCharField`` with a collapsible Google Places panel triggered by a toggle button; mapping config is fetched lazily on first open
- Atomic ``record.update()`` combining address components, place details (phone, website — places mode only), and geolocation in a single write
- ``no_manual_edit`` widget option that sets the name input to read-only, enforcing selection via autocomplete rather than free-text entry
- Mapping configuration validation on panel open with user-visible warnings when the config is missing or the mapping mode is invalid
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '19.0.1.0.6',
    'depends': ['partner_autocomplete', 'contacts_google_autocomplete'],
    'assets': {
        'web.assets_backend': [
            'partner_autocomplete_with_google_autocomplete/static/src/js/partner_autocomplete_with_google_place.scss',
            'partner_autocomplete_with_google_autocomplete/static/src/js/partner_autocomplete_with_google_place.js',
            'partner_autocomplete_with_google_autocomplete/static/src/js/partner_autocomplete_with_google_place.xml',
        ],
    },
}
