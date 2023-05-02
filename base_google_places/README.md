# Base Google Places
### Base module to implement Google Places   


This module is designed to be flexible enough to be used in any custom module.    
Contains one Abstract Model `google.places.mixin` and a concrete model `google.places.types`

1. Abstract model `google.places.mixin`    
The idea was to store information of a place and store in Odoo.    
Reference: https://developers.google.com/maps/documentation/places/web-service/place-data-fields    
    ```python
    gplace_formatted_address = fields.Char(string='Google Address')
    gplace_id = fields.Char(string='Place ID', help='A textual identifier that uniquely identifies a place')
    gplace_url = fields.Char(string='Place URL')
    gplace_opening_hours = fields.Text(string='Opening Hours')
    gplace_type_ids = fields.Many2many(comodel_name='google.places.type', column1='address_id',
    column2='place_type', string='Types')
    gplace_plus_code_global = fields.Char(string='Global Code')
    gplace_plus_code_compound = fields.Char(string='Compound Code')
    gplace_plus_code_url = fields.Char(compute='compute_gplace_plus_url', string='Plus code URL')
    gplace_vicinity = fields.Char(string='Vicinity', help='A simplified address for the place, including the street name, street number, and locality, but not the province/state, postal code, or country')
    gplace_photos_url = fields.Text(string='Photos')
    ```

2. Concrete model `google.places.types`    
To manage Google Places Types    
Reference: https://developers.google.com/maps/documentation/places/web-service/supported_types#table1


For implementation, please have a look on the module `contacts_google_places` and module `crm_google_places`