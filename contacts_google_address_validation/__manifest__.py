# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Address Validation',
    'summary': 'Validate, standardize, and geocode Contact addresses with the Google Address Validation API',
    'description': """
Contacts Google Address Validation
===================================

Adds Google Address Validation (``addressValidation`` library) to the Odoo Contact form.

Provides:

- **Validate Address** button on the Contact form next to the address block; sends the current address to ``AddressValidation.fetchAddressValidation`` with the contact's country as ``regionCode``
- **Validation dialog** summarizing the API verdict (validation granularity, address completeness, unconfirmed / inferred / replaced components) with a recommendation following Google's accept / confirm / fix guidance
- **Side-by-side comparison** of the current address and Google's standardized formatted address, plus a component-level breakdown with confirmation levels
- **Apply Google's Address**: writes the standardized address (street, street2, city, state, zip, country) and the geocode latitude / longitude back to the contact in a single write; state and country are resolved server-side
- **Keep current Address**: stores only the validation verdict without changing the address
- **Stored verdict fields** on ``res.partner``: validation status (Validated / Needs Review / Invalid), validation granularity, validation date, and API response ID — usable in list views, filters, and automations
- **Automatic reset**: editing any address field resets the validation status to Not Validated
- **Search filters** for validated, needs-review, invalid, and not-validated contacts
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '19.0.2.0.0',
    'depends': ['contacts', 'base_google_map'],
    'data': [
        'views/res_config_settings.xml',
        'views/res_partner_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'contacts_google_address_validation/static/src/components/address_validation_dialog/address_validation_dialog.js',
            'contacts_google_address_validation/static/src/components/address_validation_dialog/address_validation_dialog.xml',
            'contacts_google_address_validation/static/src/widgets/GoogleAddressValidation/google_address_validation.js',
            'contacts_google_address_validation/static/src/widgets/GoogleAddressValidation/google_address_validation.xml',
        ],
    },
}
