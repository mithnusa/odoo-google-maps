import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { useInputField } from '@web/views/fields/input_field_hook';
import { formatChar } from '@web/views/fields/formatters';
import { useRef } from '@odoo/owl';
import { BaseGoogleAutocomplete } from '../BaseGoogleAutocomplete/base_google_autocomplete';

export class GoogleAddressAutocompleteField extends BaseGoogleAutocomplete {
    static template = 'web_widget_google_map.GoogleAddressAutocomplete';
    static props = {
        ...standardFieldProps,
        placeholder: { type: String, optional: true },
        maxLength: { type: Number, optional: true },
        options: { type: Object, optional: true },
    };

    setup() {
        super.setup();

        this.input = useRef('input');

        useInputField({
            getValue: () => this.props.record.data[this.props.name] || '',
            parse: (v) => this.parse(v),
        });
    }

    defaultFillField() {
        super.defaultFillField();
        this.autocomplete_types = ['address'];
    }

    _prepareGeolocation(lat, lng) {
        const values = {};
        const geoFields = [this.fieldLat, this.fieldLng];
        if (
            Object.keys(this.props.record.fields).filter((field) => geoFields.includes(field))
                .length === geoFields.length
        ) {
            values[this.fieldLat] = lat;
            values[this.fieldLng] = lng;
        }
        return values;
    }

    async prepareOptions() {
        super.prepareOptions();
        if (!this.props.readonly) {
            this.initGplacesAutocomplete();
        }
    }

    handlePopulateAddress() {
        const place = this.placesAutocomplete.getPlace();
        if (place) {
            if (this.address_mode === 'no_address_format') {
                const geoValues = this._prepareGeolocation(
                    place.geometry.location.lat(),
                    place.geometry.location.lng()
                );
                if (geoValues) {
                    geoValues[this.props.name] = formatChar(place.formatted_address);
                    this._update(geoValues);
                }
            } else if (place.hasOwnProperty('address_components')) {
                this.populateAddress(place);
            }
        }
    }

    async populateAddress(place) {
        console.log(' GoogleAddressAutocompleteField.populateAddress ');
        // geolocation
        const partner_geometry = this._prepareGeolocation(
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
        // address
        const google_address = await this.prepareAddressFields(place);
        console.log('partner_geometry: ', partner_geometry);
        console.log('google_address: ', google_address);
        // merge
        const values = Object.assign({}, partner_geometry, google_address);
        console.log('values: ', values);
        values[this.props.name] = place.name;
        this._update(values);
    }
}

export const googleAddressAutocompleteField = {
    component: GoogleAddressAutocompleteField,
    displayName: _t('Google Address Form Autocomplete'),
    supportedTypes: ['char'],
    extractProps: ({ attrs, options }) => ({
        options,
        placeholder: attrs.placeholder,
    }),
};

registry.category('fields').add('gplaces_address_autocomplete', googleAddressAutocompleteField);
