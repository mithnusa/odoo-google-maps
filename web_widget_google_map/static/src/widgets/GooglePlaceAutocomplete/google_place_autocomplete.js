/** @odoo-module **/

import { useRef } from '@odoo/owl';
import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { useInputField } from '@web/views/fields/input_field_hook';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { useGoogleMapLoader } from '@base_google_map/utils/base_google_map';
import { BaseGoogleAutocomplete } from '../BaseGoogleAutocomplete/base_google_autocomplete';

export class GooglePlaceAutocomplete extends BaseGoogleAutocomplete {
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
        this.fillfields = {
            // mapping general fields
            // key: odoo field
            // value: google place field
            general: {
                name: 'name',
                website: 'website',
                phone: ['international_phone_number', 'formatted_phone_number'],
            },
            // mapping address fields
            // key: alias
            // value: odoo field name
            address: {
                street: 'street',
                street2: 'street2',
                city: 'city',
                zip: 'zip',
                state_id: 'state_id',
                country_id: 'country_id',
            },
            // mapping geolocation fields
            // key: alias
            // value: odoo field name

            // valid key(alias): lat & lng
            // example:
            // geolocation: {
            //     lat: 'partner_latitude',
            //     lng: 'partner_longitude',
            // }
            geolocation: {},
        };
    }

    async prepareOptions() {
        super.prepareOptions();
        const { readonly, options } = this.props;
        if (!readonly) {
            if (options) {
                if (options.hasOwnProperty('fillfields')) {
                    if (options.fillfields.hasOwnProperty('address')) {
                        if (this.force_override) {
                            this.address_form = options.fillfields.address;
                            this.fillfields['address'] = options.fillfields.address;
                        } else {
                            const address_fields = _.defaults(
                                {},
                                options.fillfields.address,
                                this.fillfields.address
                            );
                            this.address_form = address_fields;
                            this.fillfields['address'] = address_fields;
                        }
                    }

                    if (options.fillfields.hasOwnProperty('general')) {
                        if (this.force_override) {
                            this.fillfields['general'] = options.fillfields.general;
                        } else {
                            this.fillfields['general'] = _.defaults(
                                {},
                                options.fillfields.general,
                                this.fillfields.general
                            );
                        }
                    }

                    if (options.fillfields.hasOwnProperty('geolocation')) {
                        this.fillfields.geolocation = options.fillfields.geolocation;
                    }
                }
            }
            this.initGplacesAutocomplete();
        }
    }

    getGoogleFieldsRestriction() {
        return [
            'address_components',
            'name',
            'website',
            'geometry',
            'international_phone_number',
            'formatted_phone_number',
        ];
    }

    _prepareGeolocation(lat, lng) {
        const values = {};
        if (this.fillfields.geolocation) {
            if (this.fillfields.geolocation.lat) {
                values[this.fillfields.geolocation.lat] = lat;
            }
            if (this.fillfields.geolocation.lng) {
                values[this.fillfields.geolocation.lng] = lng;
            }
        }
        return values;
    }

    async populateAddress(place) {
        // address
        const google_address = await this.prepareAddressFields(place);
        // general info
        const google_place = this._preparePlace(place, this.fillfields.general);
        // geolocation
        const google_geolocation = this._prepareGeolocation(
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
        const values = Object.assign({}, google_address, google_place, google_geolocation);
        values[this.props.name] = place.name;
        this._update(values);
    }
}

GooglePlaceAutocomplete.template = 'web_widget_google_map.GooglePlacesAutocomplete';
GooglePlaceAutocomplete.defaultProps = { dynamicPlaceholder: false, shouldTrim: true };
GooglePlaceAutocomplete.props = {
    ...standardFieldProps,
    placeholder: { type: String, optional: true },
    dynamicPlaceholder: { type: Boolean, optional: true },
    shouldTrim: { type: Boolean, optional: true },
    maxLength: { type: Number, optional: true },
    options: { type: Object, optional: true },
};
GooglePlaceAutocomplete.extractProps = ({ attrs }) => ({
    options: attrs.options,
    placeholder: attrs.placeholder,
    dynamicPlaceholder: attrs.options.dynamic_placeholder,
});

GooglePlaceAutocomplete.displayName = _lt('Google Places Autocomplete');
GooglePlaceAutocomplete.supportedTypes = ['char'];

registry.category('fields').add('gplaces_autocomplete', GooglePlaceAutocomplete);
