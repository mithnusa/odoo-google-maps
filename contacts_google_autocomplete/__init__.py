# -*- coding: utf-8 -*-
import secrets
from odoo import Command


def _post_install_hook_configure_contact_google_place_mapping(env):
    google_place_mapping = env['google.places.mapping']

    model_contact_id = env['ir.model']._get('res.partner').id
    # Address fields
    field_street_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'street'),
    ], limit=1).id
    field_street2_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'street2'),
    ], limit=1).id
    field_city_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'city'),
    ], limit=1).id
    field_state_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'state_id'),
    ], limit=1).id
    field_zip_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'zip'),
    ], limit=1).id
    field_country_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'country_id'),
    ], limit=1).id

    # Geo fields
    field_latitude_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'partner_latitude'),
    ], limit=1).id
    field_longitude_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'partner_longitude'),
    ], limit=1).id

    # Other fields
    field_name_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'name'),
    ], limit=1).id
    field_website_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'website'),
    ], limit=1).id
    field_phone_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'phone'),
    ], limit=1).id

    # Create Google Places Mapping for res.partner if not exists
    mapping_place = google_place_mapping.search([
        ('model_id', '=', model_contact_id),
        ('mode', '=', 'places'),
    ], limit=1)
    if not mapping_place:
        mapping_place = google_place_mapping.create({
            'description': 'Google Place mapping for Contacts',
            'code': secrets.token_urlsafe(6),
            'model_id': model_contact_id,
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
                    'field_id': field_name_id,
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
    
    mapping_address = google_place_mapping.search([
        ('model_id', '=', model_contact_id),
        ('mode', '=', 'address'),
    ], limit=1)
    if not mapping_address:
        mapping_address = google_place_mapping.create({
            'description': 'Google Address mapping for Contacts',
            'code': secrets.token_urlsafe(6),
            'model_id': model_contact_id,
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