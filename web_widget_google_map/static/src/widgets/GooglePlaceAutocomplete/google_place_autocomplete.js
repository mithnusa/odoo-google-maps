/** @odoo-module **/

import { useRef, Component } from '@odoo/owl';
import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { useInputField } from '@web/views/fields/input_field_hook';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { formatChar } from '@web/views/fields/formatters';

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
        if (
            ev.key === this.dynamicPlaceholder.TRIGGER_KEY &&
            ev.target === this.input.el
        ) {
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
            const triggerKeyReplaceRegex = new RegExp(
                `${this.dynamicPlaceholder.TRIGGER_KEY}$`
            );
            let dynamicPlaceholder = '{{object.' + chain.join('.');
            dynamicPlaceholder +=
                defaultValue && defaultValue !== ''
                    ? ` or '''${defaultValue}'''}}`
                    : '}}';
            this.props.update(
                this.input.el.value.replace(triggerKeyReplaceRegex, '') +
                    dynamicPlaceholder
            );
        }
    }

    onDynamicPlaceholderClose() {
        this.input.el.focus();
    }

    defaultFillField() {
        super.defaultFillField();
        this.fillfields = {
            general: {
                name: 'name',
                website: 'website',
                phone: ['international_phone_number', 'formatted_phone_number'],
            },
            address: {
                street: ['street_number', 'route'],
                street2: [
                    'administrative_area_level_3',
                    'administrative_area_level_4',
                    'administrative_area_level_5',
                ],
                city: ['locality', 'administrative_area_level_2'],
                zip: 'postal_code',
                state_id: 'administrative_area_level_1',
                country_id: 'country',
            },
            geolocation: {},
        };
    }

    getFillFieldsType() {
        if (!this.props.readonly && this.address_mode === 'address_format') {
            const fieldsType = [];
            Object.values(this.fillfields).forEach((option) => {
                Object.keys(option).forEach((field) => {
                    fieldsType.push({
                        name: field,
                        type: this.props.record.fields[field].type,
                        relation: this.props.record.fields[field].relation,
                    });
                });
            });
            return fieldsType;
        }
        return [];
    }

    async prepareOptions() {
        super.prepareOptions();
        const { readonly, options } = this.props;
        if (!readonly) {
            if (options) {
                if (options.hasOwnProperty('force_override')) {
                    this.force_override = true;
                }

                if (options.hasOwnProperty('fillfields')) {
                    if (options.fillfields.hasOwnProperty('address')) {
                        if (this.force_override) {
                            this.fillfields['address'] = options.fillfields.address;
                        } else {
                            this.fillfields['address'] = _.defaults(
                                {},
                                options.fillfields.address,
                                this.fillfields.address
                            );
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
            this.target_fields = this.getFillFieldsType();
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
        const res = {};
        if (this.fillfields.geolocation) {
            Object.keys(this.fillfields.geolocation).forEach((alias) => {
                if (this.fillfields.geolocation[alias] === 'latitude') {
                    res[alias] = lat;
                }
                if (this.fillfields.geolocation[alias] === 'longitude') {
                    res[alias] = lng;
                }
            });
        }
        return res;
    }

    async populateAddress(place) {
        const requests = [];
        let index_of_state = _.findIndex(
            this.target_fields,
            (f) => f.name === this.address_form.state_id
        );
        const target_fields = this.target_fields.slice();
        const field_state =
            index_of_state > -1 ? target_fields.splice(index_of_state, 1)[0] : false;

        const google_address = this._prepareAddress(
            place,
            this.fillfields.address,
            this.fillfields_delimiter
        );
        const google_place = this._preparePlace(place, this.fillfields.general);
        const google_geolocation = this._prepareGeolocation(
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
        const values = Object.assign(google_address, google_place, google_geolocation);

        target_fields.forEach((field) => {
            requests.push(
                this._prepareValue(field.relation, field.name, values[field.name])
            );
        });

        const result = await Promise.all(requests);
        const changes = {};

        result.forEach((vals) => {
            Object.keys(vals).forEach((key) => {
                if (this.props.record.fields.hasOwnProperty(key)) {
                    if (this.props.record.fields[key].type === 'char') {
                        changes[key] = formatChar(vals[key]);
                    } else if (this.props.record.fields[key].type === 'many2one') {
                        changes[key] = Object.values(vals[key]);
                    } else {
                        changes[key] = vals[key];
                    }
                } else {
                    changes[key] = vals[key];
                }
            });
        });
        changes[this.props.name] = changes[this.display_name] || place.name;
        this._update(changes);
        if (field_state) {
            const country = Object.keys(changes).includes(this.address_form.country_id)
                ? changes[this.address_form.country_id]
                    ? changes[this.address_form.country_id][0]
                    : false
                : false;
            const state_code = google_address[this.address_form.state_id];
            await this.setCountryState(field_state.relation, country, state_code);
        }
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
