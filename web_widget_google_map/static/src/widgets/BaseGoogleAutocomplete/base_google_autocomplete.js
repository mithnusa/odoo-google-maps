import { _t } from '@web/core/l10n/translation';
import { formatChar } from '@web/views/fields/formatters';
import { Component, onWillUnmount, onWillDestroy } from '@odoo/owl';
import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';
import { GOOGLE_PLACES_COMPONENT_FORM, ADDRESS_FORM, gmaps_populate_places } from './utils';

const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
};

export class BaseGoogleAutocomplete extends Component {
    setup() {
        this.settings = {};
        this.placesAutocomplete = false;
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

        this.apiLoader = useGoogleMapsAPILoader(
            this.onLoad.bind(this),
            this.onError.bind(this)
        );

        onWillUnmount(this._cleanUp);
        onWillDestroy(this._cleanUp);
    }

    _cleanUp() {
        if (this.placesAutocomplete) {
            google.maps.event.clearInstanceListeners(this.placesAutocomplete);
            this.placesAutocomplete.unbindAll();
            this.placesAutocomplete = null;
        }

        const pacContainers = document.querySelectorAll('.pac-container');
        pacContainers.forEach(container => {
            container.remove();
        });
    }

    async onLoad() {
        this.initialize();
    }

    onError(error) {
        console.error(error);
    }

    initialize() {
        this.defaultFillField();
        this.prepareOptions();
    }

    defaultFillField() {
        this.address_mode = 'address_format';
        // Autocomplete request types
        this.autocomplete_types = ['establishment'];
    }

    getGoogleFieldsRestriction() {
        return ['address_components', 'name', 'geometry', 'formatted_address'];
    }

    async initGplacesAutocomplete() {
        if (!this.placesAutocomplete && this.input) {
            await this.apiLoader.importLibrary('places');
            const google_fields = this.getGoogleFieldsRestriction();
            const options = {
                types: this.autocomplete_types,
                fields: google_fields,
            };

            // On this section, only set the country restriction if there is only one country configured in the settings
            if (this.settings.autocomplete_countries_restriction && this.settings.autocomplete_countries_restriction.length === 1) {
                options.componentRestrictions = { country: this.settings.autocomplete_countries_restriction[0] };
            }
            if (this.settings.language) {
                options.language = this.settings.language;
            }
            this.placesAutocomplete = new google.maps.places.Autocomplete(this.input.el, options);

            if (this.settings.autocomplete_countries_restriction && this.settings.autocomplete_countries_restriction.length > 1) {
                this.placesAutocomplete.setComponentRestrictions({
                    country: this.settings.autocomplete_countries_restriction,
                });
            }

            this.placeAutocompleteListener = this.placesAutocomplete.addListener(
                'place_changed',
                this.handlePopulateAddress.bind(this)
            );
            this._geolocate();
        }
    }

    async prepareOptions() {
        const { readonly, options } = this.props;
        if (!readonly && options) {
            this.force_override = options.force_override || false;
            if (options.hasOwnProperty('component_form')) {
                this.component_form = _.defaults({}, options.component_form, this.component_form);
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
                    this.address_form = _.defaults({}, options.address_form, this.address_form);
                }
            }
            if (options.hasOwnProperty('display_name')) {
                this.display_name = options.display_name;
            }
            if (options.hasOwnProperty('mode')) {
                this.address_mode =
                    ADDRESS_MODE.indexOf(options.mode) != -1 ? options.mode : 'address_format';
            }
        }
    }

    async _geolocate() {
        if (!navigator.geolocation) {
            console.log('Geolocation is not supported by this browser.');
            return;
        }
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, GEOLOCATION_OPTIONS);
            });

            const geolocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };

            const circle = new google.maps.Circle({
                center: geolocation,
                radius: position.coords.accuracy,
            });

            this.placesAutocomplete.setBounds(circle.getBounds());
        } catch (error) {
            console.error('Error getting geolocation:', error);
        }
    }

    _preparePlace(place, fill_fields) {
        place = typeof place !== 'undefined' ? place : false;
        fill_fields = typeof fill_fields !== 'undefined' ? fill_fields : false;
        return gmaps_populate_places(place, fill_fields);
    }

    async prepareAddressFields(place) {
        const address = await this.env.model.orm.call('res.country', 'prepare_google_address', [
            [],
            place.address_components,
            this.address_form,
        ]);
        return address;
    }

    async populateAddress() {
        // Not implemented
    }

    handlePopulateAddress() {
        if (this._debounceTimer) {
            this._cleanUp(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            const place = this.placesAutocomplete.getPlace();
            console.log({place});
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
        }, 300);
    }

    _update(values) {
        this.props.record.update(values);
    }

    get shouldTrim() {
        return this.props.record.fields[this.props.name].trim;
    }

    get maxLength() {
        return this.props.record.fields[this.props.name].size;
    }

    get formattedValue() {
        return formatChar(this.props.record.data[this.props.name], { isPassword: false });
    }

    parse(value) {
        if (!value) return '';

        value = String(value);
        if (this.shouldTrim) {
            value = value.trim();
        }
        if (this.maxLength) {
            value = value.slice(0, this.maxLength);
        }
        return value;
    }
}
