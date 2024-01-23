# Web Widget Google Maps

There are two widgets:
- `gplaces_autocomplete`
- `gplaces_address_autocomplete`

### 1. Widget `gplaces_autocomplete`
This widget uses Google places autocomplete API [https://developers.google.com/maps/documentation/javascript/examples/places-autocomplete](https://developers.google.com/maps/documentation/javascript/examples/places-autocomplete)

How to use?    
Example:
```xml
<field name="name" widget="gplaces_autocomplete" options="{'fillfields': {
    'geolocation': {
        'lat': 'partner_latitude',
        'lng': 'partner_longitude'
    }
}}"/>
```

Available option `fillfields` that you can customize:
```javascript
{
    general: {
        ODOO_FIELD: [GOOGLE_PLACES_FIELDS],
        ...
    },
    address: {
        street: ODOO_FIELD,
        street2: ODOO_FIELD,
        city: ODOO_FIELD,
        zip: ODOO_FIELD,
        state_id: ODOO_FIELD,
        country_id: ODOO_FIELD,
    },
    geolocation: {
        lat: ODOO_FIELD,
        lng: ODOO_FIELD,
    },
}
```
Replace `ODOO_FIELD` with field in your model    
Replace `GOOGLE_PLACES_FIELDS` with Google autocomplete component form (address section) and Google places field name (general section), and Google geocode (geolocation section), you can assigned multiple values

The option are devided into three sections:
- `general`    
This option is to represent fields: `name`, `website`, and `phone` in your model.    
On the left side is where you define Odoo field name.    
On the right side is Google places field name.    
- `address`    
Behave like `general`, this section is where you define your address fields of your model
- `geolocation`    
Same as `general` and `address`, this section is for the fields that represent geolocation (latitude and longitude) in your model.


Example:
```javascript
{
    general: {
        name: 'name',
        website: 'website',
        phone: ['international_phone_number', 'formatted_phone_number'],
    },
    address: {
        street: 'street',
        street2: 'street2',
        city: 'city',
        zip: 'zip',
        state_id: 'state_id',
        country_id: 'country_id',
    },
    geolocation: {
        lat: 'partner_latitude',
        lng: 'partner_longitude',
    },
}
```


Notes:    
For options `fillfields`, the default values are 
```javascript
{
    general: {
        name: 'name',
        website: 'website',
        phone: ['international_phone_number', 'formatted_phone_number'],
    },
    address: {
        street: 'street',
        street2: 'street2',
        city: 'city',
        zip: 'zip',
        state_id: 'state_id',
        country_id: 'country_id',
    },
},
```
If "general" section and "address" section in your model defined like fields in `res.partner` model than no need to set it.    
Section "geolocation" is not define by default so you must set it manually.

### 2. Widget `gplaces_address_autocomplete`
This widget uses Google Autocomplete Address Form API [https://developers.google.com/maps/documentation/javascript/examples/places-autocomplete-addressform](https://developers.google.com/maps/documentation/javascript/examples/places-autocomplete-addressform)    


This widget works similar to the widget `gplaces_autocomplete`.

How to use?    
Example: 
```xml
<field name="name" widget="gplaces_address_autocomplete" options="{
    fillfields: {
        street: 'street',
        street2: 'street2',
        city: 'city',
        zip: 'zip',
        state_id: 'state_id',
        country_id: 'country_id',
    },
    lat: 'partner_latitude',
    lng: 'partner_longitude',
}"/>
```

Available option `fillfields` that you can customize:
```javascript
{
    fillfields: {
        ODOO_FIELD: [ADDRESS_COMPONENTS],
        ...
    },
    lat: ODOO_FIELD,
    lng: ODOO_FIELD 
}
```

Example:
```javascript
{
    fillfields: {
        street: 'street',
        street2: 'street2',
        city: 'city',
        zip: 'zip',
        state_id: 'state_id',
        country_id: 'country_id',
    },
    lat: 'partner_latitude',
    lng: 'partner_longitude',
}
```

Notes:    
For options `fillfields`, the default value are 
```javascript
{
    street: 'street',
    street2: 'street2',
    city: 'city',
    zip: 'zip',
    state_id: 'state_id',
    country_id: 'country_id',
},
```
If the address fields in your model are defined like the address fields in `res.partner` model than no need to set it.

## New setting "Google Address Format" on res.country    
A setting to construct an address returned by Google Services (service used by the two new widgets)
![country_google_address_format](./static/img/country_google_address_format.png)
Note: needs developer mode enabled to see the setting.

Useful links:
- [https://developers.google.com/maps/documentation/javascript/place-data-fields](https://developers.google.com/maps/documentation/javascript/place-data-fields)
- [https://developers.google.com/maps/documentation/geocoding/requests-geocoding#Types](https://developers.google.com/maps/documentation/geocoding/requests-geocoding#Types)

If you have difficulties implement or use these widget on your custom module, please do not hesitate to open an issue.