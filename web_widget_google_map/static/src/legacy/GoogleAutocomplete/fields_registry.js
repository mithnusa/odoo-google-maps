odoo.define('web_widget_google_map.FieldsRegistry', function (require) {
    'use strict';

    console.log(' [web_widget_google_map.FieldsRegistry] ');

    const registry = require('web.field_registry');
    const GplacesAutocomplete = require('web_widget_google_map.GplaceAutocompleteFields');

    registry
        .add('gplaces_address_autocomplete', GplacesAutocomplete.GplacesAddressAutocompleteField)
        .add('gplaces_autocomplete', GplacesAutocomplete.GplacesAutocompleteField);
});
