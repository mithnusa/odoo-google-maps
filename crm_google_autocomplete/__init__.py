import secrets
from odoo import Command
from . import models


def _post_install_hook_configure_crm_google_place_mapping(env):
    google_place_mapping = env['google.places.mapping']

    model_crm_lead_id = env['ir.model']._get('crm.lead').id
    # Address fields
    field_street_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'street'),
    ], limit=1).id
    field_street2_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'street2'),
    ], limit=1).id
    field_city_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'city'),
    ], limit=1).id
    field_state_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'state_id'),
    ], limit=1).id
    field_zip_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'zip'),
    ], limit=1).id
    field_country_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'country_id'),
    ], limit=1).id

    # Geo fields
    field_latitude_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'customer_latitude'),
    ], limit=1).id
    field_longitude_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'customer_longitude'),
    ], limit=1).id

    # Other fields
    field_partner_name_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'partner_name'),
    ], limit=1).id
    field_website_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'website'),
    ], limit=1).id
    field_phone_id = env['ir.model.fields'].search([
        ('model', '=', 'crm.lead'),
        ('name', '=', 'phone'),
    ], limit=1).id

    # Create Google Places Mapping for res.partner if not exists
    mapping_place_count = google_place_mapping.search_count([
        ('model_id', '=', model_crm_lead_id),
        ('mode', '=', 'places'),
    ])
    if mapping_place_count == 0:
        google_place_mapping.create({
            'description': 'Google Place mapping for CRM',
            'code': secrets.token_urlsafe(6),
            'model_id': model_crm_lead_id,
            'mode': 'places',
            'gplace_place_fetch_fields': "['addressComponents', 'displayName', 'location', 'websiteURI', 'internationalPhoneNumber']",
            'latitude': field_latitude_id,
            'longitude': field_longitude_id,
            'mapping_address_ids': [
                Command.create({
                    'field_id': field_street_id,
                    'gplace_component': "['street_number', 'route']",
                    'handling_mode': 'concat',
                }),
                Command.create({
                    'field_id': field_street2_id,
                    'gplace_component': "['administrative_area_level_4', 'administrative_area_level_3', 'administrative_area_level_5']",
                    'handling_mode': 'concat',
                    'separator': 'comma',
                }),
                Command.create({
                    'field_id': field_city_id,
                    'gplace_component': "['locality', 'administrative_area_level_2']",
                    'handling_mode': 'fallback',
                }),
                Command.create({
                    'field_id': field_state_id,
                    'gplace_component': "['administrative_area_level_1']",
                    'handling_mode': 'direct',
                }),
                Command.create({
                    'field_id': field_zip_id,
                    'gplace_component': "['postal_code']",
                    'handling_mode': 'direct',
                }),
                Command.create({
                    'field_id': field_country_id,
                    'gplace_component': "['country']",
                    'handling_mode': 'direct',
                }),
            ],
            'mapping_other_ids': [
                Command.create({
                    'field_id': field_partner_name_id,
                    'gplace_component': "'displayName'",
                }),
                Command.create({
                    'field_id': field_website_id,
                    'gplace_component': "'websiteURI'",
                }),
                Command.create({
                    'field_id': field_phone_id,
                    'gplace_component': "'internationalPhoneNumber'",
                }),
            ],
        })
    
    mapping_address_count = google_place_mapping.search_count([
        ('model_id', '=', model_crm_lead_id),
        ('mode', '=', 'address'),
    ])
    if mapping_address_count == 0:
        google_place_mapping.create({
            'description': 'Google Address mapping for CRM',
            'code': secrets.token_urlsafe(6),
            'model_id': model_crm_lead_id,
            'mode': 'address',
            'gplace_options': "{'includedPrimaryTypes': ['route', 'street_address']}",
            'gplace_address_fetch_fields': "['addressComponents', 'location']",
            'latitude': field_latitude_id,
            'longitude': field_longitude_id,
            'mapping_address_ids': [
                Command.create({
                    'field_id': field_street_id,
                    'gplace_component': "['street_number', 'route']",
                    'handling_mode': 'concat',
                }),
                Command.create({
                    'field_id': field_street2_id,
                    'gplace_component': "['administrative_area_level_4', 'administrative_area_level_3', 'administrative_area_level_5']",
                    'handling_mode': 'concat',
                    'separator': 'comma',
                }),
                Command.create({
                    'field_id': field_city_id,
                    'gplace_component': "['locality', 'administrative_area_level_2']",
                    'handling_mode': 'fallback',
                }),
                Command.create({
                    'field_id': field_state_id,
                    'gplace_component': "['administrative_area_level_1']",
                    'handling_mode': 'direct',
                }),
                Command.create({
                    'field_id': field_zip_id,
                    'gplace_component': "['postal_code']",
                    'handling_mode': 'direct',
                }),
                Command.create({
                    'field_id': field_country_id,
                    'gplace_component': "['country']",
                    'handling_mode': 'direct',
                }),
            ],
        })