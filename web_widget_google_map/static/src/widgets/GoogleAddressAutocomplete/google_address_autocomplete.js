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
            [this.address_form.street]: ['street_number', 'route'],
            [this.address_form.street2]: [
                'administrative_area_level_3',
                'administrative_area_level_4',
                'administrative_area_level_5',
            ],
            [this.address_form.city]: ['locality', 'administrative_area_level_2'],
            [this.address_form.zip]: 'postal_code',
            [this.address_form.state_id]: 'administrative_area_level_1',
            [this.address_form.country_id]: 'country',
        };
        this.autocomplete_types = ['address'];
    }

    _prepareGeolocation(lat, lng) {
        const res = {};
        if (
            _.intersection(_.keys(this.props.record.fields), [
                this.fieldLat,
                this.fieldLng,
            ]).length === 2
        ) {
            res[this.fieldLat] = lat;
            res[this.fieldLng] = lng;
        }
        return res;
    }

    getFillFieldsType() {
        if (!this.props.readonly && this.address_mode === 'address_format') {
            const fieldsType = [];
            Object.keys(this.fillfields).forEach((field) => {
                fieldsType.push({
                    name: field,
                    type: this.props.record.fields[field].type,
                    relation: this.props.record.fields[field].relation,
                });
            });
            return fieldsType;
        }
        return [];
    }

    async prepareOptions() {
        super.prepareOptions();
        if (!this.props.readonly) {
            this.target_fields = this.getFillFieldsType();
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
                const google_address = this._prepareAddress(place);
                this.populateAddress(place, google_address);
            }
        }
    }

    async populateAddress(place, parse_address) {
        const requests = [];
        let index_of_state = _.findIndex(
            this.target_fields,
            (f) => f.name === this.address_form.state_id
        );
        const target_fields = this.target_fields.slice();
        const field_state =
            index_of_state > -1 ? target_fields.splice(index_of_state, 1)[0] : false;

        target_fields.forEach((field) => {
            requests.push(
                this._prepareValue(
                    field.relation,
                    field.name,
                    parse_address[field.name]
                )
            );
        });
        // Set geolocation
        const partner_geometry = this._prepareGeolocation(
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
        Object.keys(partner_geometry).forEach((key) => {
            requests.push(this._prepareValue(false, key, partner_geometry[key]));
        });

        const result = await Promise.all(requests);
        const changes = {
            [this.props.name]: parse_address[this.display_name] || place.name,
        };
        result.forEach((data) => {
            Object.keys(data).forEach((key) => {
                if (this.props.record.fields.hasOwnProperty(key)) {
                    if (this.props.record.fields[key].type === 'char') {
                        changes[key] = formatChar(data[key]);
                    } else if (this.props.record.fields[key].type === 'many2one') {
                        changes[key] = Object.values(data[key]);
                    } else {
                        changes[key] = data[key];
                    }
                } else {
                    changes[key] = data[key];
                }
            });
        });
        this._update(changes);
        if (field_state) {
            const country = Object.keys(changes).includes(this.address_form.country_id)
                ? changes[this.address_form.country_id]
                    ? changes[this.address_form.country_id][0]
                    : false
                : false;
            const state_code = parse_address[this.address_form.state_id];
            await this.setCountryState(field_state.relation, country, state_code);
        }
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

registry
    .category('fields')
    .add('gplaces_address_autocomplete', GoogleAddressAutocomplete);
