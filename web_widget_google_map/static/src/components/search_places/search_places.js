import { useService } from '@web/core/utils/hooks';
import { _t } from '@web/core/l10n/translation';
import { Component, onWillUnmount, useRef, props, t } from '@odoo/owl';
import { useLayoutEffect } from '@web/owl2/utils';
import { debounce } from '@web/core/utils/timing';
import { renderToString } from '@web/core/utils/render';

const DEFAULT_ZOOM_LEVEL = 17;
const INFO_WINDOW_MAX_WIDTH = '400px';

export class GoogleMapSearchPlaces extends Component {
    static template = 'web_widget_google_map.SearchPlaces';
    props = props({ googleMap: t.or([t.object(), t.literal(null)]).optional() });

    setup() {
        this.searchRef = useRef('searchPlaces');
        this.notificationService = useService('notification');
        this.placeAutocomplete = null;
        this.markerPlacesSearch = null;
        this.markerInfoWindow = null;
        this.debouncedHandlePlaceSelect = debounce(this.handlePlaceSelect, 150);
        this.boundsChangedListener = null;

        useLayoutEffect(
            (googleMap, searchRef) => {
                if (googleMap && searchRef) {
                    this._initSearchBox();
                }
            },
            () => [this.props.googleMap, this.searchRef.el]
        );
        onWillUnmount(() => {
            this._cleanup();
        });
    }

    /**
     * Initialize the Places Autocomplete search box
     * @returns {Promise<void>}
     * @private
     */
    async _initSearchBox() {
        const settings = this.env.apiLoader.getSettings();
        if (!settings.in_map_place_search) return;

        if (!this.placeAutocomplete) {
            try {
                await this.env.apiLoader.importLibrary('places');
                const { AdvancedMarkerElement } = await this.env.apiLoader.importLibrary('marker');

                const searchOptions = {};
                if (settings.autocomplete_restrict_country && settings.autocomplete_list_countries_restriction) {
                    const countries = settings.autocomplete_list_countries_restriction;
                    // Validate that countries is an array or string
                    let countryCodes = [];
                    if (Array.isArray(countries) || typeof countries === 'string') {
                        countryCodes = Array.isArray(countries) ? countries : [countries];
                        countryCodes = countryCodes
                            .map((code) => code.trim())
                            .filter((code) => code !== '' && code.length === 2); // Basic validation for country codes
                    }
                    if (countryCodes.length) {
                        searchOptions.includedRegionCodes = countryCodes;
                    }
                }

                if (settings.restrict_language && settings.language && typeof settings.language === 'string') {
                    searchOptions.requestedLanguage = settings.language;
                }

                if (settings.region && typeof settings.region === 'string') {
                    searchOptions.requestedRegion = settings.region.trim();
                }

                google.maps.event.addListenerOnce(this.props.googleMap, 'idle', () => {
                    searchOptions.locationRestriction = this.props.googleMap.getBounds();
                    try {
                        this.placeAutocomplete = new google.maps.places.PlaceAutocompleteElement(searchOptions);
                        this.placeAutocomplete.placeholder = _t('Search for a place');
                        this.placeAutocomplete.id = 'place-autocomplete-input';
                        this.searchRef.el.classList.remove('o_hidden');
                        this.searchRef.el.style.zIndex = 1;
                        this.searchRef.el.appendChild(this.placeAutocomplete);

                        this.props.googleMap.controls[google.maps.ControlPosition.TOP_RIGHT].push(this.searchRef.el);

                        const markerContent = document.createElement('div');
                        markerContent.className = 'places-search-marker';
                        const icon = document.createElement('i');
                        icon.className = 'fa fa-search';
                        markerContent.appendChild(icon);
                        this.markerPlacesSearch = new AdvancedMarkerElement({
                            map: this.props.googleMap,
                            content: markerContent,
                        });
                        this.markerInfoWindow = new google.maps.InfoWindow();
                        this._boundHandlePlaceSelect = this.debouncedHandlePlaceSelect.bind(this);
                        this.placeAutocomplete.addEventListener('gmp-select', this._boundHandlePlaceSelect);
                    } catch (error) {
                        this.notificationService.add(
                            _t(
                                "Google Maps Places Autocomplete couldn't be created. You might need to check the Google Maps version and ensure that the Places API is enabled."
                            ),
                            {
                                title: _t('Google Maps Places Autocomplete'),
                                type: 'danger',
                                sticky: false,
                                autocloseDelay: 5000,
                            }
                        );
                    }
                });

                this.boundsChangedListener = this.props.googleMap.addListener('bounds_changed', () => {
                    if (this.placeAutocomplete) {
                        this.placeAutocomplete.locationRestriction = this.props.googleMap.getBounds();
                    }
                });
            } catch (error) {
                this.notificationService.add(
                    _t('Something went wrong. See Javascript console for technical details. '),
                    {
                        title: _t('Google Maps Places Autocomplete'),
                        type: 'danger',
                    }
                );
            }
        }
    }

    /**
     * Handle the place selection event from the autocomplete
     * @param {Object} param0 - The place select event object
     * @param {google.maps.places.Place} param0.place - The selected place
     * @returns {Promise<void>}
     */
    async handlePlaceSelect({ placePrediction }) {
        try {
            const place = placePrediction.toPlace();
            await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });

            if (place.viewport) {
                this.props.googleMap.fitBounds(place.viewport);
            } else {
                this.props.googleMap.setCenter(place.location);
                this.props.googleMap.setZoom(DEFAULT_ZOOM_LEVEL);
            }
            const content = this._createInfoWindowContent(place);
            this.updateInfoWindow(content, place.location);
            if (!this.markerPlacesSearch.map) {
                this.markerPlacesSearch.map = this.props.googleMap;
            }
            this.markerPlacesSearch.position = place.location;
        } catch (error) {
            this.notificationService.add(_t('Failed to fetch Google place detail.'), { type: 'warning' });
        }
    }

    /**
     * Update the info window with new content and position
     * @param {HTMLElement} content - The content to display in the info window
     * @param {google.maps.LatLng} position - The position to place the info window
     * @returns {void}
     */
    updateInfoWindow(content, position) {
        // Clear existing closeclick listeners to prevent memory leaks
        google.maps.event.clearListeners(this.markerInfoWindow, 'closeclick');

        this.markerInfoWindow.setContent(content);
        this.markerInfoWindow.setPosition(position);
        this.markerInfoWindow.open({
            map: this.props.googleMap,
            anchor: this.markerPlacesSearch,
            shouldFocus: false,
        });

        // Add the closeclick listener
        this.markerInfoWindow.addListener('closeclick', () => {
            this.markerPlacesSearch.map = null;
        });
    }

    /**
     * Create the content for the info window
     * @param {Object} place - The place object containing displayName and formattedAddress
     * @returns {HTMLElement} - The content element for the info window
     */
    _createInfoWindowContent(place) {
        const content = document.createElement('div');
        content.classList.add('p-4');
        content.style.maxWidth = INFO_WINDOW_MAX_WIDTH;

        // Use template rendering with t-esc to safely escape HTML content
        const htmlString = renderToString('web_widget_google_map.SearchPlacesInfoWindow', {
            displayName: place.displayName,
            formattedAddress: place.formattedAddress,
        });

        content.innerHTML = htmlString;
        return content;
    }

    /**
     * Cleanup method to remove markers, info windows, and event listeners
     * @returns {void}
     * @private
     */
    _cleanup() {
        if (this.markerPlacesSearch) {
            this.markerPlacesSearch.map = null;
            google.maps.event.clearInstanceListeners(this.markerPlacesSearch);
        }
        if (this.markerInfoWindow) {
            this.markerInfoWindow.close();
            google.maps.event.clearListeners(this.markerInfoWindow, 'closeclick');
        }
        if (this.placeAutocomplete) {
            // Remove event listener for place selection
            if (this._boundHandlePlaceSelect) {
                this.placeAutocomplete.removeEventListener('gmp-select', this._boundHandlePlaceSelect);
            }

            // Remove from DOM
            if (this.placeAutocomplete.parentNode) {
                this.placeAutocomplete.remove();
            }
        }
        // Remove search control from map
        if (this.searchRef?.el && this.props.googleMap) {
            const controls = this.props.googleMap.controls[google.maps.ControlPosition.TOP_RIGHT];
            const index = controls ? (controls.getArray() || []).indexOf(this.searchRef.el) : -1;
            if (index > -1) {
                controls.removeAt(index);
            }
        }
        if (this.boundsChangedListener) {
            google.maps.event.removeListener(this.boundsChangedListener);
        }
    }
}
