/** @odoo-module **/

import { _lt } from '@web/core/l10n/translation';
import { formatChar } from '@web/views/fields/formatters';
import { Component, onWillStart, onWillUnmount, onWillDestroy } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import {
    GOOGLE_PLACES_COMPONENT_FORM,
    ADDRESS_FORM,
    fetchValues,
    gmaps_populate_address,
    gmaps_populate_places,
    fetchCountryState,
} from './utils';

export class BaseGoogleAutocomplete extends Component {
    setup() {
        this.rpc = useService('rpc');
        this.user = useService('user');

        this.loader = null;
        this.settings = {};

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

        onWillStart(() => {
            this._onWillStart();
        });
        onWillUnmount(() => {
            // Reset the placeAutocomplete and remove the event listener attached
            if (this.places_autocomplete) {
                this.places_autocomplete.set('place', null);
            }
            if (this.placeAutocompleteListener) {
                google.maps.event.removeListener(this.placeAutocompleteListener);
            }
        });
        onWillDestroy(() => {
            // set display none for all pac-container residu on the dom
            setTimeout(() => {
                document.body.querySelectorAll('.pac-container').forEach((el) => {
                    el.style.display = 'none';
                });
            }, 150);
        });
    }

    async _onWillStart() {
        if (!this.loader) {
            const settings = await this._fetchSettings();
            this.settings = { ...settings };
            this.loader = new google.maps.plugins.loader.Loader({
                apiKey: settings.api_key,
                version: settings.version,
                libraries: settings.libraries,
            });
        }
    }

    async _fetchSettings() {
        const data = await this.rpc('/web/base_google_map/settings', {
            context: this.user.context,
        });
        return data;
    }

    defaultFillField() {
        this.address_mode = 'address_format';
        // Autocomplete request types
        this.autocomplete_types = ['establishment'];
    }

    getGoogleFieldsRestriction() {
        return ['address_components', 'name', 'geometry', 'formatted_address'];
    }

    initGplacesAutocomplete(inputRef) {
        if (!this.places_autocomplete) {
            const google_fields = this.getGoogleFieldsRestriction();
            this.loader.loadCallback((e) => {
                if (e) {
                    console.log(e);
                } else {
                    this.places_autocomplete = new google.maps.places.Autocomplete(
                        inputRef.el,
                        {
                            types: this.autocomplete_types,
                            fields: google_fields,
                        }
                    );

                    if (this.settings.language) {
                        this.places_autocomplete.setOptions({
                            language: this.settings.language,
                        });
                    }

                    this.placeAutocompleteListener =
                        this.places_autocomplete.addListener(
                            'place_changed',
                            this.handlePopulateAddress.bind(this)
                        );
                    this._geolocate();
                }
            });
        }
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
        return gmaps_populate_places(place, fill_fields);
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

    async populateAddress() {
        // Not implemented
    }

    handlePopulateAddress() {
        const place = this.places_autocomplete.getPlace();
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
