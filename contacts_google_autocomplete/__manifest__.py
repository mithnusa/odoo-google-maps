# -*- coding: utf-8 -*-
{
    'name': 'Contacts Google Autocomplete',
    'summary': 'Google Places autocomplete for the name and street fields on the Contact form',
    'description': """
Contacts Google Autocomplete
=============================

Enhances the Odoo Contact form with Google Places autocomplete on the name and street fields.

Provides:

- ``gplace_autocomplete_el`` widget on the name and street fields in the Contact form and inside the child-contacts inline sub-form
- Two mapping modes: ``places`` on the name fields (fetches name, address, phone, website, and coordinates) and ``address`` on the street field (fetches address components and coordinates, restricted to streets and routes)
- Post-install hook that automatically creates ``google.places.mapping`` records for ``res.partner`` — no manual mapping configuration required after installation
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.2',
    'depends': ['contacts', 'web_widget_google_place_autocomplete'],
    'data': ['views/res_partner_views.xml'],
    'post_init_hook': '_post_install_hook_configure_contact_google_place_mapping',
    'installable': True,
    'application': False,
    'auto_install': False,
}
