import secrets

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
        ('name', '=', 'latitude'),
    ], limit=1).id
    field_longitude_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'longitude'),
    ], limit=1).id

    # Other fields
    field_name_id = env['ir.model.fields'].search([
        ('model', '=', 'res.partner'),
        ('name', '=', 'name'),
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
            'gplace_place_fetch_fields': "['addressComponents', 'displayName', 'location']",
            'latitude': field_latitude_id,
            'longitude': field_longitude_id,
            'mapping_address_ids': [
                (0, 0, {
                    'field_id': field_street_id,
                    'gplace_component': "['street_number', 'route']",
                }),
                (0, 0, {
                    'field_id': field_street2_id,
                    'gplace_component': "['sublocality', 'sublocality_level_1']",
                }),
                (0, 0, {
                    'field_id': field_city_id,
                    'gplace_component': "['locality']",
                }),
                (0, 0, {
                    'field_id': field_state_id,
                    'gplace_component': "['administrative_area_level_1']",
                }),
                (0, 0, {
                    'field_id': field_zip_id,
                    'gplace_component': "['postal_code']",
                }),
                (0, 0, {
                    'field_id': field_country_id,
                    'gplace_component': "['country']",
                }),
            ],
            'mapping_other_ids': [
                (0, 0, {
                    'field_id': field_name_id,
                    'gplace_component': "'displayName'",
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
            'gplace_address_fetch_fields': "['addressComponents', 'location']",
            'latitude': field_latitude_id,
            'longitude': field_longitude_id,
            'mapping_address_ids': [
                (0, 0, {
                    'field_id': field_street_id,
                    'gplace_component': "['street_number', 'route']",
                }),
                (0, 0, {
                    'field_id': field_street2_id,
                    'gplace_component': "['sublocality', 'sublocality_level_1']",
                }),
                (0, 0, {
                    'field_id': field_city_id,
                    'gplace_component': "['locality']",
                }),
                (0, 0, {
                    'field_id': field_state_id,
                    'gplace_component': "['administrative_area_level_1']",
                }),
                (0, 0, {
                    'field_id': field_zip_id,
                    'gplace_component': "['postal_code']",
                }),
                (0, 0, {
                    'field_id': field_country_id,
                    'gplace_component': "['country']",
                }),
            ],
        })