import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { sprintf } from '@web/core/utils/strings';
import { ConfirmationDialog } from '@web/core/confirmation_dialog/confirmation_dialog';
import { renderToString } from '@web/core/utils/render';
import { Component, useRef, useEffect, useState, onWillDestroy, markup } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';
import { useGooglePlaceAutocompleteMapping } from '../../hooks/use_google_place_autocomplete_mapping';

export class GooglePlaceMappingTestField extends Component {
    static template = 'web_widget_google_map.GooglePlacesMappingTestField';
    static props = { ...standardFieldProps };

    setup() {
        this.button = useRef('button');
        this.divInputRef = useRef('divInput');
        this.notificationService = useService('notification');
        this.dialogService = useService('dialog');
        this.placesAutocompleteEl = null;
        this.fetchFields = null;

        
        this.state = useState({
            isGoogleLoaded: false,
        });
        
        this.apiLoader = useGoogleMapsAPILoader(this.onLoad.bind(this), this.onError.bind(this));
        
        const is_testing = true;
        this.usePlaceMapping = useGooglePlaceAutocompleteMapping(is_testing);

        useEffect(
            (isGoogleLoaded, divInputRef) => {
                const mappingCode = this.props.record.data['code'];
                if (isGoogleLoaded && divInputRef.el && !this.placesAutocompleteEl && mappingCode) {
                    this.initGplacesAutocompleteElement();
                }
            },
            () => [this.state.isGoogleLoaded, this.divInputRef]
        );

        onWillDestroy(() => {
            this.cleanUp();
        });
    }

    onLoad() {
        this.state.isGoogleLoaded = true;
    }

    onError(error) {
        console.error(error);
        this.state.isGoogleLoaded = false;
    }

    async initGplacesAutocompleteElement() {
        try {
            await this.apiLoader.importLibrary('places');

            const mappingCode = this.props.record.data['code'];
            const mappingConfig = await this.usePlaceMapping.getMappingConfigByCode(mappingCode);

            if (!mappingConfig || !mappingConfig.gplace_fetch_fields) {
                this.notificationService.add(
                    _t('Test terminated! Please configure the fetch fields first'),
                    { type: 'warning' }
                );
                return;
            }

            this.fetchFields = mappingConfig.gplace_fetch_fields;
            if (mappingConfig.gplace_options) {
                this.placesAutocompleteEl = new google.maps.places.PlaceAutocompleteElement(
                    mappingConfig.gplace_options
                );
            } else {
                this.placesAutocompleteEl = new google.maps.places.PlaceAutocompleteElement();
            }
            this.placesAutocompleteEl.id =
                'test-place-autocomplete-input-widget-' + this.props.id.toString();

            this.divInputRef.el.appendChild(this.placesAutocompleteEl);
            this.placesAutocompleteEl.addEventListener(
                'gmp-select',
                this.handlePlaceSelect.bind(this)
            );
        } catch (error) {
            console.error('Error initializing Google Places Autocomplete:', error);
            this.notificationService.add(
                sprintf(
                    _t('Test failed! Error initializing Google Places Autocomplete.\n%s'),
                    error
                ),
                { type: 'danger' }
            );
        }
    }

    async handlePlaceSelect({ placePrediction }) {
        if (!this.fetchFields || this.fetchFields.length === 0) {
            this.notificationService.add(
                _t('Test terminated! Please configure the fetch fields first'),
                { type: 'warning', autocloseDelay: 10000 }
            );
            return;
        }
        try {
            const mappingCode = this.props.record.data['code'];
            const place = placePrediction.toPlace();
            await place.fetchFields({ fields: this.fetchFields });
            const placeJson = place.toJSON();
            const mappingResult = await this.usePlaceMapping.parsePlace(placeJson, mappingCode);

            const view = renderToString('web_widget_google_map.ViewMappingResult', {
                mode: mappingResult.mode,
                addressMappingResult: JSON.stringify(mappingResult.address, null, 2),
                otherMappingResult: JSON.stringify(mappingResult.other, null, 2),
                geoLocationResult: JSON.stringify(mappingResult.geolocation, null, 2),
                placeDetailsResult: JSON.stringify(placeJson, null, 2),
            });
            this.dialogService.add(ConfirmationDialog, {
                title: _t('Result'),
                body: markup(view),
                confirm: () => {},
                confirmLabel: _t('Close'),
            });
        } catch (error) {
            console.error('Error fetching place details:', error);
            this.notificationService.add(
                sprintf(_t('Test failed! Error fetching place details.\n%s'), error),
                { type: 'danger', autocloseDelay: 10000 }
            );
        }
    }

    cleanUp() {
        if (this.placesAutocompleteEl) {
            this.placesAutocompleteEl.removeEventListener(
                'gmp-select',
                this.handlePlaceSelect.bind(this)
            );
            this.placesAutocompleteEl = null;
        }
    }
}

export const googlePlacesMappingTestField = {
    component: GooglePlaceMappingTestField,
    displayName: _t('Test Google Place Mapping'),
};

registry.category('fields').add('GoogleMappingTest', googlePlacesMappingTestField);
