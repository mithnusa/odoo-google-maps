import { _t } from '@web/core/l10n/translation';
import { Component, useEffect, useRef, onWillDestroy } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { debounce } from '@web/core/utils/timing';

const DEFAULT_ZOOM_LEVEL = 17;
const INFO_WINDOW_MAX_WIDTH = '400px';


export class GoogleMapSearchPlaces extends Component {
    static template = 'web_view_google_map.SearchPlaces';
    static props = ['googleMap'];

    setup() {
        this.searchRef = useRef('searchPlaces');
        this.notificationService = useService('notification');
        this.placeAutocomplete = null;
        this.marker = null;
        this.infoWindow = null;
        this.debouncedHandlePlaceSelect = debounce(this.handlePlaceSelect, 300);
        this.boundsChangedListener = null;
        useEffect(
            (googleMap, searchEl) => {
                if (googleMap && searchEl) {
                    this._initSearchBox();
                }
            },
            () => [this.props.googleMap, this.searchRef.el]
        );
        onWillDestroy(this._cleanup);
    }

    /**
     * Cleanup method to remove markers, info windows, and event listeners
     * @returns {void}
     * @private
     */
    _cleanup() {
        if (this.markerPlacesSearch) {
            this.markerPlacesSearch.map = null;
        }
        if (this.markerInfoWindow) {
            this.markerInfoWindow.close();
            google.maps.event.clearListeners(this.markerInfoWindow, 'closeclick');
        }
        if (this.placeAutocomplete) {
            this.placeAutocomplete.remove();
            google.maps.event.clearListeners(this.placeAutocomplete, 'gmp-select');
        }
        if (this.boundsChangedListener) {
            google.maps.event.removeListener(this.boundsChangedListener);
        }
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

                const searchOptions = {}
                if (settings.autocomplete_restrict_country && settings.autocomplete_list_countries_restriction) {
                    searchOptions.componentRestrictions = {country: settings.autocomplete_list_countries_restriction};
                }

                google.maps.event.addListenerOnce(this.props.googleMap, 'idle', () => {
                    searchOptions.locationRestriction = this.props.googleMap.getBounds();
                    window.requestAnimationFrame(() => {
                        try {
                            this.placeAutocomplete = new google.maps.places.PlaceAutocompleteElement(searchOptions);
                            this.placeAutocomplete.id = 'place-autocomplete-input';
                            this.searchRef.el.classList.remove('o_hidden');
                            this.searchRef.el.style.zIndex = 1;
                            this.searchRef.el.appendChild(this.placeAutocomplete);

                            this.props.googleMap.controls[
                                google.maps.ControlPosition.TOP_RIGHT
                            ].push(this.searchRef.el);
                            this.markerPlacesSearch = new AdvancedMarkerElement({
                                map: this.props.googleMap,
                            });

                            this.markerInfoWindow = new google.maps.InfoWindow();
                            this.placeAutocomplete.addEventListener(
                                'gmp-select',
                                this.debouncedHandlePlaceSelect.bind(this)
                            );
                        } catch (error) {
                            console.error('Error initializing PlaceAutocompleteElement:', error);
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
                });

                this.boundsChangedListener = this.props.googleMap.addListener('bounds_changed', () => {
                    if (this.placeAutocomplete) {
                        this.placeAutocomplete.locationRestriction =
                            this.props.googleMap.getBounds();
                    }
                });
            } catch (error) {
                console.error(error);
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
            console.error('Error handling place select:', error);
            this.notificationService.add(
                _t('Failed to fetch Google place detail.'),
                { type: 'warning' }
            );
        }
    }

    /**
     * Update the info window with new content and position
     * @param {HTMLElement} content - The content to display in the info window
     * @param {google.maps.LatLng} position - The position to place the info window
     * @returns {void}
     */
    updateInfoWindow(content, position) {
        this.markerInfoWindow.setContent(content);
        this.markerInfoWindow.setPosition(position);
        this.markerInfoWindow.open({
            map: this.props.googleMap,
            anchor: this.markerPlacesSearch,
            shouldFocus: false,
        });
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
        content.classList.add('p-4', 'mt-4');
        content.style.maxWidth = INFO_WINDOW_MAX_WIDTH;
        content.innerHTML = `
            <div id="infowindow-content">
                <span id="place-displayname" class="fs-4 fw-bolder">
                    ${place.displayName}
                </span><br />
                <span id="place-address">
                    ${place.formattedAddress}
                </span>
            </div>
        `;
        return content;
    }
}
