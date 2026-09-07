{
    'name': 'CRM Google Places Autocomplete',
    'summary': 'Google Places autocomplete for the company name and street fields on the Lead/Opportunity form',
    'description': """
CRM Google Places Autocomplete
================================

Enhances the Lead/Opportunity form with Google Places autocomplete on the company
name and street fields.

Provides:

- ``gplace_autocomplete_el`` widget on ``partner_name`` (places mode) and ``street`` (address mode) in both the quick-entry group and the detailed lead tab
- Two mapping modes: ``places`` on the company name field (fetches company name, address, phone, website, and coordinates) and ``address`` on the street field (fetches address components and coordinates, restricted to streets and routes)
- ``_compute_customer_geo`` override that skips the lead's coordinate reset when the address is being updated from the Google Maps workflow (``is_from_google_maps`` context flag)
- Post-install hook that automatically creates ``google.places.mapping`` records for ``crm.lead`` — no manual mapping configuration required after installation
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '19.0.1.0.4',
    'depends': ['crm_google_map', 'web_widget_google_place_autocomplete'],
    'data': ['views/crm_lead_views.xml'],
    'post_init_hook': '_post_install_hook_configure_crm_google_place_mapping',
}
