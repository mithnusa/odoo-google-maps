/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { formatChar } from '@web/views/fields/formatters';
import { useInputField } from '@web/views/fields/input_field_hook';
import { Component, onRendered, onWillRender, useRef } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import {
    GOOGLE_PLACES_COMPONENT_FORM,
    ADDRESS_FORM,
    ADDRESS_MODE,
    fetchValues,
    gmaps_populate_address,
    fetchCountryState,
} from '../utils';

export class GoogleAddressAutocomplete extends Component {
    setup() {
        this.input = useRef('input');
        this.rpc = useService('rpc');
        this.user = useService('user');

        this.places_autocomplete = false;
        this.component_form = GOOGLE_PLACES_COMPONENT_FORM;
        this.address_form = ADDRESS_FORM;
        this.fillfields_delimiter = {
            street: ' ',
            street2: ', ',
        };
        // Fields to be filled when place/address is selected
        this.fillfields = {};
        // Longitude, field's name that hold longitude
        this.fieldLng = false;
        // Latitude, field's name that hold latitude
        this.fieldLat = false;
        // Google address form/places instance attribute to be assigned to the field
        this.display_name = 'name';
        // Utilize the default `fillfields` and then combined it with the fillfields options given if any
        // or overwrite the default values and used the `fillfields` provided in the view options instead.
        // This option will be applied only on `fillfields` and `address_form`
        this.force_override = false;
        this.autocomplete_settings = null;

        useInputField({
            getValue: () => this.props.value || '',
            parse: (v) => this.parse(v),
        });
        onWillRender(this.defaultFillField);
        onRendered(this.prepareOptions);
    }

    async fetchConfig() {
        const data = await this.rpc('/web/base_google_map/google_autocomplete_conf', {
            context: this.user.context,
        });
        if (data) {
            this.autocomplete_settings = data;
        }
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
        // possible value: `address_format` or `no_address_format`
        // address_format: widget will populate address returned by Google to Odoo address fields
        // no_address_format: no populate address, will take address and the geolocation data.
        this.address_mode = 'address_format';
        // Autocomplete request types
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

    getGoogleFieldsRestriction() {
        return ['address_components', 'name', 'geometry', 'formatted_address'];
    }

    async prepareOptions() {
        const { readonly, options } = this.props;
        if (!readonly) {
            if (options) {
                if (options.hasOwnProperty('component_form')) {
                    this.component_form = _.defaults(
                        {},
                        options.component_form,
                        this.component_form
                    );
                }
                if (options.hasOwnProperty('delimiter')) {
                    this.fillfields_delimiter = _.defaults(
                        {},
                        options.delimiter,
                        this.fillfields_delimiter
                    );
                }
                if (options.hasOwnProperty('lat')) {
                    this.fieldLat = options.lat;
                }
                if (options.hasOwnProperty('lng')) {
                    this.fieldLng = options.lng;
                }
                if (options.hasOwnProperty('address_form')) {
                    if (this.force_override) {
                        this.address_form = options.address_form;
                    } else {
                        this.address_form = _.defaults(
                            {},
                            options.address_form,
                            this.address_form
                        );
                    }
                }
                if (options.hasOwnProperty('display_name')) {
                    this.display_name = options.display_name;
                }
                if (options.hasOwnProperty('mode')) {
                    this.address_mode =
                        ADDRESS_MODE.indexOf(options.mode) != -1
                            ? options.mode
                            : 'address_format';
                }
            }
            this.target_fields = this.getFillFieldsType();
            await this.fetchConfig();
            await this.initGplacesAutocomplete();
            this._geolocate();
        }
    }

    _geolocate() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const geolocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };

                const circle = new google.maps.Circle({
                    center: geolocation,
                    radius: position.coords.accuracy,
                });

                this.places_autocomplete.setBounds(circle.getBounds());
            });
        }
    }

    _prepareValue(model, field_name, value) {
        model = typeof model !== 'undefined' ? model : false;
        field_name = typeof field_name !== 'undefined' ? field_name : false;
        value = typeof value !== 'undefined' ? value : false;
        return fetchValues(this.env.model.orm, model, field_name, value);
    }

    _preparePlace(place, fill_fields) {
        place = typeof place !== 'undefined' ? place : false;
        fill_fields = typeof fill_fields !== 'undefined' ? fill_fields : false;
        return gmaps_populate_address(place, fill_fields);
    }

    _prepareAddress(place, fill_fields, delimiter) {
        place = typeof place !== 'undefined' ? place : false;
        fill_fields =
            typeof fill_fields !== 'undefined' ? fill_fields : this.fillfields;
        delimiter =
            typeof delimiter !== 'undefined' ? delimiter : this.fillfields_delimiter;
        return gmaps_populate_address(place, fill_fields, delimiter);
    }

    _fetchCountryState(model, country, state) {
        model = typeof model !== 'undefined' ? model : false;
        country = typeof country !== 'undefined' ? country : false;
        state = typeof state !== 'undefined' ? state : false;
        return fetchCountryState(this.env.model.orm, model, country, state);
    }

    async setCountryState(model, country, state) {
        if (model && country && state) {
            const result = await this._fetchCountryState(model, country, state);
            const value = { [this.address_form.state_id]: Object.values(result) };
            this._update(value);
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

    initGplacesAutocomplete() {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (!this.places_autocomplete) {
                    const google_fields = this.getGoogleFieldsRestriction();
                    this.places_autocomplete = new google.maps.places.Autocomplete(
                        this.input.el,
                        {
                            types: this.autocomplete_types,
                            fields: google_fields,
                        }
                    );
                    if (this.autocomplete_settings) {
                        this.places_autocomplete.setOptions(this.autocomplete_settings);
                    }
                    this.places_autocomplete.addListener(
                        'place_changed',
                        this.handlePopulateAddress.bind(this)
                    );
                }
                // When the user selects an address from the dropdown, populate the address fields in the form.
                resolve(this);
            }, 100);
        });
    }

    handlePopulateAddress() {
        const place = this.places_autocomplete.getPlace();
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

    _update(values) {
        this.props.record.update(values);
    }

    get formattedValue() {
        return formatChar(this.props.value, { isPassword: false });
    }

    parse(value) {
        if (this.props.shouldTrim) {
            return value.trim();
        }
        return value;
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
});

GoogleAddressAutocomplete.displayName = _lt('Text');
GoogleAddressAutocomplete.supportedTypes = ['char'];

registry
    .category('fields')
    .add('gplaces_address_autocomplete', GoogleAddressAutocomplete);
