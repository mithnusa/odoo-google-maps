/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { useInputField } from '@web/views/fields/input_field_hook';
import { formatChar } from '@web/views/fields/formatters';
import { useRef } from '@odoo/owl';

import { useGoogleMapLoader } from '@base_google_map/utils/base_google_map';

import { BaseGoogleAutocomplete } from '../BaseGoogleAutocomplete/base_google_autocomplete';

export class GoogleAddressAutocomplete extends BaseGoogleAutocomplete {
    setup() {
        super.setup();

        this.input = useRef('input');

        useGoogleMapLoader({
            onLoad: (settings) => {
                this.settings = { ...settings };
                this.initialize();
            },
        });

        useInputField({
            getValue: () => this.props.value || '',
            parse: (v) => this.parse(v),
        });
    }

    async onKeydownListener(ev) {
        if (ev.key === this.dynamicPlaceholder.TRIGGER_KEY && ev.target === this.input.el) {
            const baseModel = this.props.record.data.mailing_model_real;
            if (baseModel) {
                await this.dynamicPlaceholder.open(this.input.el, baseModel, {
                    validateCallback: this.onDynamicPlaceholderValidate.bind(this),
                    closeCallback: this.onDynamicPlaceholderClose.bind(this),
                });
            }
        }
    }

    onDynamicPlaceholderValidate(chain, defaultValue) {
        if (chain) {
            const triggerKeyReplaceRegex = new RegExp(`${this.dynamicPlaceholder.TRIGGER_KEY}$`);
            let dynamicPlaceholder = '{{object.' + chain.join('.');
            dynamicPlaceholder +=
                defaultValue && defaultValue !== '' ? ` or '''${defaultValue}'''}}` : '}}';
            this.props.update(
                this.input.el.value.replace(triggerKeyReplaceRegex, '') + dynamicPlaceholder
            );
        }
    }

    onDynamicPlaceholderClose() {
        this.input.el.focus();
    }

    defaultFillField() {
        super.defaultFillField();
        this.autocomplete_types = ['address'];
    }

    _prepareGeolocation(lat, lng) {
        const values = {};
        const geoFields = [this.fieldLat, this.fieldLng];
        if (Object.keys(this.props.record.fields).filter(field => geoFields.includes(field)).length === geoFields.length) {
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
        // geolocation
        const partner_geometry = this._prepareGeolocation(
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
        // address
        const google_address = await this.prepareAddressFields(place);
        const values = Object.assign({}, partner_geometry, google_address);
        values[this.props.name] = place.name;
        this._update(values);
    }
}

GoogleAddressAutocomplete.template = 'web_widget_google_map.GoogleAddressAutocomplete';
GoogleAddressAutocomplete.defaultProps = {
    dynamicPlaceholder: false,
    shouldTrim: true,
};
GoogleAddressAutocomplete.props = {
    ...standardFieldProps,
    placeholder: { type: String, optional: true },
    dynamicPlaceholder: { type: Boolean, optional: true },
    shouldTrim: { type: Boolean, optional: true },
    maxLength: { type: Number, optional: true },
    options: { type: Object, optional: true },
};
GoogleAddressAutocomplete.extractProps = ({ attrs }) => ({
    options: attrs.options,
    placeholder: attrs.placeholder,
    dynamicPlaceholder: attrs.options.dynamic_placeholder,
});

GoogleAddressAutocomplete.displayName = _lt('Google Address Form Autocomplete');
GoogleAddressAutocomplete.supportedTypes = ['char'];

registry.category('fields').add('gplaces_address_autocomplete', GoogleAddressAutocomplete);
