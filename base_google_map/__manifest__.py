# -*- coding: utf-8 -*-
{
    'name': 'Base Google Maps',
    'summary': 'Core Google Maps API configuration and base utilities for Odoo',
    'description': """
Base Google Maps
================

Foundation module for the Google Maps integration suite.

Provides:

- Google Maps API Key and Map ID configuration in General Settings
- Backend controller exposing API settings to the frontend (``/web/base_google_map/settings``)
- ``GoogleMapsAPILoader`` — singleton JS class handling API script injection, retry logic, and status tracking
- ``useGoogleMapsAPILoader`` — OWL hook for components that need the Maps API
- ``BaseGoogleMapComponent`` — abstract OWL base class with lifecycle management, accessibility (ARIA), resize observer, and offline detection
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '1.0.11',
    'depends': ['web', 'base_geolocalize'],
    'data': [
        'data/google_map.xml',
        'views/res_config_settings.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'base_google_map/static/src/utils/loader_google_map.js',
            'base_google_map/static/src/utils/base_google_map.js',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
