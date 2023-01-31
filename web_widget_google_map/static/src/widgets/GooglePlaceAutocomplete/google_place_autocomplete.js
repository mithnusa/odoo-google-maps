/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { formatChar } from '@web/views/fields/formatters';
import { useInputField } from '@web/views/fields/input_field_hook';
import { Component, onWillRender, useRef, onRendered } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import {
    GOOGLE_PLACES_COMPONENT_FORM,
    ADDRESS_FORM,
    fetchValues,
    gmaps_populate_address,
    gmaps_populate_places,
    fetchCountryState,
} from '../utils';

export class GooglePlaceAutocomplete extends Component {
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

        useInputField({ getValue: () => this.props.value || '', parse: (v) => this.parse(v) });
        onWillRender(this.defaultFillField);
        onRendered(this.prepareOptions);
    }

    async fetchConfig() {
        const data = await this.rpc('/web/base_google_map/google_autocomplete_conf', { context: this.user.context });
        if (data) {
            this.autocomplete_settings = data;
        }
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
            dynamicPlaceholder += defaultValue && defaultValue !== '' ? ` or '''${defaultValue}'''}}` : '}}';
            this.props.update(this.input.el.value.replace(triggerKeyReplaceRegex, '') + dynamicPlaceholder);
        }
    }

    onDynamicPlaceholderClose() {
        this.input.el.focus();
    }

    defaultFillField() {
        this.fillfields = {
            general: {
                name: 'name',
                website: 'website',
                phone: ['international_phone_number', 'formatted_phone_number'],
            },
            address: {
                street: ['street_number', 'route'],
                street2: ['administrative_area_level_3', 'administrative_area_level_4', 'administrative_area_level_5'],
                city: ['locality', 'administrative_area_level_2'],
                zip: 'postal_code',
                state_id: 'administrative_area_level_1',
                country_id: 'country',
            },
            geolocation: {},
        };
        this.address_mode = 'address_format';
        // Autocomplete request types
        this.autocomplete_types = ['establishment'];
    }

    getGoogleFieldsRestriction() {
        return ['address_components', 'name', 'geometry', 'formatted_address'];
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
        const { readonly, options } = this.props;
        if (!readonly) {
            if (options) {
                if (options.hasOwnProperty('mode')) {
                    console.warn('Option "mode" is not supported');
                }

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

                if (options.hasOwnProperty('component_form')) {
                    this.component_form = _.defaults({}, options.component_form, this.component_form);
                }
                if (options.hasOwnProperty('delimiter')) {
                    this.fillfields_delimiter = _.defaults({}, options.delimiter, this.fillfields_delimiter);
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
                        this.address_form = _.defaults({}, options.address_form, this.address_form);
                    }
                }
                if (options.hasOwnProperty('display_name')) {
                    this.display_name = options.display_name;
                }
                if (options.hasOwnProperty('mode')) {
                    this.address_mode = ADDRESS_MODE.indexOf(options.mode) != -1 ? options.mode : 'address_format';
                }
            }
            this.target_fields = this.getFillFieldsType();
            await this.fetchConfig();
            await this.initGplacesAutocomplete();
            this._geolocate();
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
        return gmaps_populate_places(place, fill_fields);
    }

    _prepareAddress(place, fill_fields, delimiter) {
        place = typeof place !== 'undefined' ? place : false;
        fill_fields = typeof fill_fields !== 'undefined' ? fill_fields : this.fillfields;
        delimiter = typeof delimiter !== 'undefined' ? delimiter : this.fillfields_delimiter;
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

    initGplacesAutocomplete() {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (!this.places_autocomplete) {
                    const google_fields = this.getGoogleFieldsRestriction();
                    this.places_autocomplete = new google.maps.places.Autocomplete(this.input.el, {
                        types: this.autocomplete_types,
                        fields: google_fields,
                    });
                    if (this.autocomplete_settings) {
                        this.places_autocomplete.setOptions(this.autocomplete_settings);
                    }
                    this.places_autocomplete.addListener('place_changed', this.handlePopulateAddress.bind(this));
                }
                // When the user selects an address from the dropdown, populate the address fields in the form.
                resolve(this);
            }, 100);
        });
    }

    async populateAddress(place) {
        const requests = [];
        let index_of_state = _.findIndex(this.target_fields, (f) => f.name === this.address_form.state_id);
        const target_fields = this.target_fields.slice();
        const field_state = index_of_state > -1 ? target_fields.splice(index_of_state, 1)[0] : false;

        const google_address = this._prepareAddress(place, this.fillfields.address, this.fillfields_delimiter);
        const google_place = this._preparePlace(place, this.fillfields.general);
        const google_geolocation = this._prepareGeolocation(
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
        const values = Object.assign(google_address, google_place, google_geolocation);

        target_fields.forEach((field) => {
            requests.push(this._prepareValue(field.relation, field.name, values[field.name]));
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

    handlePopulateAddress() {
        const place = this.places_autocomplete.getPlace();
        if (this.address_mode === 'no_address_format') {
            const geoValues = this._prepareGeolocation(place.geometry.location.lat(), place.geometry.location.lng());
            if (geoValues) {
                geoValues[this.props.name] = formatChar(place.formatted_address);
                this._update(geoValues);
            }
        } else if (place.hasOwnProperty('address_components')) {
            this.populateAddress(place);
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
});

GooglePlaceAutocomplete.displayName = _lt('Text');
GooglePlaceAutocomplete.supportedTypes = ['char'];

registry.category('fields').add('gplaces_autocomplete', GooglePlaceAutocomplete);
