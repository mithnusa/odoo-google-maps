import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { onWillUnmount, onWillDestroy, onWillStart, useState, useRef, useEffect, useComponent } from '@odoo/owl';
import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';
import { useGooglePlaceAutocompleteMapping } from './use_google_place_autocomplete_mapping';

/**
 * Composable hook that provides Google Place Autocomplete functionality
 * This can be used in any component that needs Google Place features
 *
 * @returns {Object} Google Place autocomplete state and methods
 */
export function useGooglePlaceAutocomplete() {
    const notificationService = useService('notification');
    const actionService = useService('action');
    const component = useComponent();

    const props = component.props;
    const record = component.props.record;
    const componentId = component.props.id.toString();

    // Refs
    const divInputRef = useRef('divInput');

    let placesAutocompleteEl = null;

    // State
    const state = useState({
        isGoogleLoaded: false,
    });

    const localState = {
        mappingId: null,
        mappingMode: null,
        mappingCode: null,
        placeOptions: {},
        placeFetchFields: [],
    };

    // API Loader
    const apiLoader = useGoogleMapsAPILoader(
        () => {
            state.isGoogleLoaded = true;
        },
        (error) => {
            state.isGoogleLoaded = false;
            console.error(error);
        }
    );

    const placeMapping = useGooglePlaceAutocompleteMapping();

    // Validate props
    function validateProps() {
        if (!props.mappingCode && !props.mappingMode) {
            notificationService.add(
                _t(
                    'At least mapping code or mapping mode must be provided for Google Place Autocomplete Element widget'
                ),
                { type: 'warning', autocloseDelay: 5000 }
            );
        }
    }

    // Load mapping configuration
    async function loadMappingConfig() {
        let mappingConfig = null;
        if (props.mappingCode) {
            mappingConfig = await placeMapping.getMappingConfigByCode(props.mappingCode);
        } else if (props.mappingMode) {
            mappingConfig = await placeMapping.getMappingConfigByMode(props.mappingMode);
        }
        if (mappingConfig) {
            localState.mappingId = mappingConfig.mapping_id;
            localState.mappingCode = mappingConfig.mapping_code;
            localState.mappingMode = mappingConfig.mapping_mode;
            if (mappingConfig.gplace_options) {
                localState.placeOptions = mappingConfig.gplace_options;
            }
            if (mappingConfig.gplace_fetch_fields) {
                localState.placeFetchFields = mappingConfig.gplace_fetch_fields;
            }
        }
    }

    // Initialize Google Places Autocomplete Element
    async function initGplacesAutocompleteElement() {
        try {
            await apiLoader.importLibrary('places');
            const state = getState();
            if (state.placeOptions) {
                placesAutocompleteEl = new google.maps.places.PlaceAutocompleteElement(
                    state.placeOptions
                );
            } else {
                placesAutocompleteEl = new google.maps.places.PlaceAutocompleteElement();
            }
            placesAutocompleteEl.id =
                'place-autocomplete-input-widget-' + record?.id.toString() + '-' + componentId;

            divInputRef.el.appendChild(placesAutocompleteEl);
            placesAutocompleteEl.addEventListener('gmp-select', handlePlaceSelect);
        } catch (error) {
            console.error('Error initializing Google Places Autocomplete:', error);
        }
    }

    // Handle place selection
    async function handlePlaceSelect({ placePrediction }) {
        const state = getState();
        if (!state.placeFetchFields || state.placeFetchFields.length === 0) {
            console.warn(
                'No fetchFields specified for Place Autocomplete. Skipping place details fetch.'
            );
            return;
        }
        try {
            const place = placePrediction.toPlace();
            await place.fetchFields({ fields: state.placeFetchFields });
            const placeJson = place.toJSON();
            const mappingResult = await placeMapping.parsePlace(placeJson, state.mappingCode);
            const values = {};
            if (mappingResult) {
                if (mappingResult.address) {
                    Object.assign(values, mappingResult.address);
                }
                if (mappingResult.other && state.mappingMode === 'places') {
                    Object.assign(values, mappingResult.other);
                }
                if (values) {
                    await record.update(values);
                    if (mappingResult.geolocation) {
                        await record.update(mappingResult.geolocation);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling place select:', error);
        }
    }

    // Clean up
    function cleanUp() {
        if (placesAutocompleteEl) {
            placesAutocompleteEl.remove();
            placesAutocompleteEl = null;
        }
    }

    // Open mapping configuration
    function openMappingConfig() {
        const state = getState();
        if (!state.mappingId) {
            notificationService.add(
                _t('No mapping configuration is associated with this widget.'),
                { type: 'warning', autocloseDelay: 5000 }
            );
            return;
        }
        actionService.doAction({
            type: 'ir.actions.act_window',
            res_model: 'google.places.mapping',
            res_id: state.mappingId,
            views: [[false, 'form']],
            target: 'new',
        });
    }

    // Computed properties
    function getMappingUrl() {
        const state = getState();
        if (!state.mappingId) {
            return null;
        }
        return `/odoo/google.places.mapping/${state.mappingId}`;
    }

    function getWidgetId() {
        return 'gplace-autocomplete-el-' + record?.id.toString() + '-' + componentId;
    }

    function getState() {
        return { ...localState, isGoogleLoaded: state.isGoogleLoaded };
    }

    // Lifecycle hooks
    validateProps();

    onWillStart(async () => {
        await loadMappingConfig();
    });

    useEffect(
        (divRef, isGoogleLoaded) => {
            const state = getState();
            if (
                divRef.el &&
                isGoogleLoaded &&
                !placesAutocompleteEl &&
                state.placeFetchFields.length > 0 &&
                state.mappingId
            ) {
                initGplacesAutocompleteElement();
            }
        },
        () => [divInputRef, state.isGoogleLoaded]
    );

    onWillUnmount(cleanUp);
    onWillDestroy(cleanUp);

    // Return public API
    return {
        refs: {
            divInputRef,
        },
        methods: {
            openMappingConfig,
            initGplacesAutocompleteElement,
            handlePlaceSelect,
            getMappingUrl,
            getWidgetId,
            getState,
        },
    };
}
