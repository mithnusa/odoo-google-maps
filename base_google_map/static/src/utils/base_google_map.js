/** @odoo-module **/
import { Component, useEffect, useState, onMounted } from '@odoo/owl';
import { AlertDialog } from '@web/core/confirmation_dialog/confirmation_dialog';
import { _lt } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { MAP_THEMES } from './themes';

// see https://googlemaps.github.io/js-api-loader/enums/LoaderStatus.html
export const LOADER_STATUS = {
    FAILURE: 3,
    INITIALIZED: 0,
    LOADING: 1,
    SUCCESS: 2,
    UNLOAD: 999, // custom status for internal usage
};

export function useGoogleMapLoader({ showLoading, onLoad = () => {}, onError = () => {} }) {
    showLoading = showLoading || false;
    const rpc = useService('rpc');
    const user = useService('user');
    const ui = useService('ui');

    onMounted(loadGoogleLoader);

    function prepareOptions(settings) {
        const loaderOptions = {
            apiKey: settings.api_key,
            version: settings.version,
            libraries: settings.libraries,
        };
        if (settings.region) {
            loaderOptions.region = settings.region;
        }
        if (settings.language) {
            loaderOptions.language = settings.language;
        }
        return loaderOptions;
    }

    async function loadGoogleLoader() {
        try {
            showLoading && ui.block();
            const data = await rpc('/web/base_google_map/settings', {
                context: user.context,
            });
            if (data) {
                const settings = { ...data };
                const loaderOptions = prepareOptions(settings);
                try {
                    const loader = new google.maps.plugins.loader.Loader(loaderOptions);
                    loader
                        .load()
                        .then((_google) => {
                            showLoading && ui.unblock();
                            window.google = _google;
                            delete settings.api_key;
                            delete settings.version;
                            onLoad(settings);
                        })
                        .catch((e) => {
                            showLoading && ui.unblock();
                            console.error(e);
                            onError(e);
                        });
                } catch (error) {
                    showLoading && ui.unblock();
                    console.error(error);
                    onError(error);
                }
            }
        } catch (error) {
            showLoading && ui.unblock();
            console.error(error);
            onError(error);
        }
    }
}

export class BaseGoogleMap extends Component {
    setup() {
        this.user = useService('user');
        this.rpc = useService('rpc');
        this.notification = useService('notification');
        this.dialog = useService('dialog');

        this.state = useState({ loaderStatus: LOADER_STATUS.UNLOAD });

        this.settings = {};
        this.isPlacesSearchEnable = null;
        this.markerPlacesSearch = null;
        this.googleMap = null;
        this.placesAutocomplete = null;
        this.currentDatapointId = null;

        useGoogleMapLoader({
            showLoading: false,
            onLoad: (setting) => {
                this.settings = { ...setting };
                this._handleGoogleLoaderSuccess();
                this.initialize();
            },
            onError: (msg) => {
                this._handleGoogleLoaderError(msg);
            },
        });

        useEffect(
            (loaderStatus) => {
                if (loaderStatus === LOADER_STATUS.FAILURE) {
                    this.dialog.add(AlertDialog, {
                        title: this.env._t('Google Maps'),
                        body: this.env._t(
                            'Something went wrong!\nGoogle Maps is not load correctly.\nSee the JavaScript console for technical details.'
                        ),
                    });
                }
            },
            () => [this.state.loaderStatus]
        );
    }

    initialize() {
        // not implemented
        // start Google stuff here
    }

    _handleGoogleLoaderError(msg) {
        console.error(msg);
        this.state.loaderStatus = LOADER_STATUS.FAILURE;
    }

    _handleGoogleLoaderSuccess() {
        this.state.loaderStatus = LOADER_STATUS.SUCCESS;
    }

    setMapTheme() {
        const style = this.settings.theme || 'default';
        if (!Object.prototype.hasOwnProperty.call(MAP_THEMES, style) || style === 'default') {
            return;
        }
        const styledMapType = new google.maps.StyledMapType(MAP_THEMES[style], {
            name: _lt('Custom'),
        });
        this.googleMap.setOptions({
            mapTypeControlOptions: {
                mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain', 'styled_map'],
            },
        });
        // Associate the styled map with the MapTypeId and set it to display.
        this.googleMap.mapTypes.set('styled_map', styledMapType);
        this.googleMap.setMapTypeId('styled_map');
    }

    getMapOptions() {
        const gestureHandling =
            ['cooperative', 'greedy', 'none', 'auto'].indexOf(
                this.props.archInfo.gestureHandling
            ) === -1
                ? 'auto'
                : this.props.archInfo.gestureHandling;

        return {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            center: { lat: 0, lng: 0 },
            zoom: 2,
            minZoom: 2,
            maxZoom: 22,
            fullscreenControl: true,
            mapTypeControl: true,
            gestureHandling,
        };
    }

    renderGooglePlaceSearch(searchRef, markerInfoWindow) {
        if (this.settings.is_places_search_enable) {
            searchRef.el.style.visiblity = 'visible';
            if (!this.markerPlacesSearch) {
                this.markerPlacesSearch = new google.maps.Marker({
                    map: this.googleMap,
                    anchorPoint: new google.maps.Point(0, -29),
                });
            } else {
                this.markerPlacesSearch.setVisible(false);
            }

            if (!this.placesAutocomplete) {
                this.placesAutocomplete = new google.maps.places.Autocomplete(
                    searchRef.el.querySelector('input#search'),
                    {
                        fields: ['geometry', 'formatted_address'],
                        types: ['establishment'],
                    }
                );
                this.placesAutocomplete.bindTo('bounds', this.googleMap);
                this.googleMap.controls[google.maps.ControlPosition.TOP_RIGHT].push(searchRef.el);
                google.maps.event.addListener(
                    this.placesAutocomplete,
                    'place_changed',
                    this.handleSearchPlaceResult.bind(this, markerInfoWindow)
                );
            }
        }
    }

    handleSearchPlaceResult(markerInfoWindow) {
        try {
            const place = this.placesAutocomplete.getPlace();
            if (place) {
                if (place.geometry.hasOwnProperty('viewport') && place.geometry.viewport) {
                    this.googleMap.fitBounds(place.geometry.viewport);
                } else {
                    this.googleMap.panTo(place.geometry.location);
                }
                this.markerPlacesSearch.setPosition(place.geometry.location);
                this.markerPlacesSearch.setVisible(true);

                const para = document.createElement('p');
                const node = document.createTextNode(place.formatted_address);
                para.appendChild(node);

                const divContent = document.createElement('div');
                divContent.appendChild(para);

                markerInfoWindow.setContent(divContent);
                markerInfoWindow.open(this.googleMap, this.markerPlacesSearch);

                markerInfoWindow.addListener('closeclick', () => {
                    this.markerPlacesSearch.setVisible(false);
                });
            }
        } catch (error) {
            // a catch when user hit enter without selecting any place
            console.error(error);
        }
    }

    handleSearchPlaceBounds() {
        if (this.placesAutocomplete) {
            this.placesAutocomplete.bindTo('bounds', this.googleMap);
        }
    }

    get isLoaderSuccess() {
        return this.state.loaderStatus === LOADER_STATUS.SUCCESS;
    }
}
