/** @odoo-module **/

import {
    Component,
    useRef,
    onRendered,
    useState,
    onWillUnmount,
    useEffect,
} from '@odoo/owl';
import { renderToString } from '@web/core/utils/render';
import { sprintf } from '@web/core/utils/strings';
import { useService } from '@web/core/utils/hooks';
import { GooglePlacesResult } from './google_places_result';
import { preparePlaces } from '../utils';

export class GooglePlacesAutocompleteSidebar extends Component {
    setup() {
        this.searchBoxRef = useRef('searchBox');
        this.searchResultRef = useRef('searchResultBox');
        this.notification = useService('notification');
        this.ui = useService('ui');

        this.state = useState({ places: [], hasNextPage: false });
        this.placesResult = [];
        this.markerInfoWindow = null;
        this.placesAutocomplete = null;

        useEffect(
            () => {
                if (!this.props.isComponentFolded) {
                    this.searchBoxRef.el.querySelector('input#searchinputbox').focus();
                }
            },
            () => [this.props.isComponentFolded]
        );
        onRendered(() => {
            this.onRendered();
            this.handleOnClickAddPlace();
        });
        onWillUnmount(() => {
            this.searchBoxRef.el.querySelector('input#searchinputbox').value = '';
            this._actionCleanMapListener();
            this._cleanPlacesResult();
        });
    }

    handleOnClickAddPlace() {
        if (!this.props.googleMap) return;

        if (!this.listenerMapClick) {
            this.listenerMapClick = this.props.googleMap.addListener(
                'click',
                this._handleMapOnClick.bind(this)
            );
        }

        if (!this.mapClickAddIndicatorContent) {
            const content = renderToString(
                'base_google_places.PlaceCreationIndicator',
                {}
            );
            this.mapClickAddIndicatorContent = new DOMParser()
                .parseFromString(content, 'text/html')
                .querySelector('div');

            this.props.googleMap.controls[
                google.maps.ControlPosition.RIGHT_BOTTOM
            ].push(this.mapClickAddIndicatorContent);

            this.listenerClickAddIndicator = this.props.googleMap.addListener(
                'idle',
                this.handleInMapAddIndicator.bind(this)
            );
        }
    }

    /**
     * Google Place creation indicator
     * At the zoom level configured, user can click any location on map to convert Google Place to Odoo record
     */
    handleInMapAddIndicator() {
        const zoomLevel = this.props.googleMap.getZoom();
        this.props.googleMap.controls[google.maps.ControlPosition.RIGHT_BOTTOM].forEach(
            (element) => {
                if (element.id === 'custom-control-add-places-indicator') {
                    let button = element.querySelector('button');
                    if (zoomLevel >= 17) {
                        if (button.classList.contains('btn-light')) {
                            button.classList.remove('btn-light');
                            button.classList.add('btn-warning', 'animate');
                        }
                    } else {
                        button.classList.remove('animate');
                        if (!button.classList.contains('btn-light')) {
                            button.classList.toggle('btn-light');
                        }
                    }
                }
            }
        );
    }

    onRendered() {
        if (!this.props.googleMap) return;

        if (!this.props.isComponentFolded) {
            if (!this.placesAutocomplete) {
                this.placesAutocomplete = new google.maps.places.SearchBox(
                    this.searchBoxRef.el.querySelector('input#searchinputbox'),
                    {
                        fields: [
                            'formatted_address',
                            'geometry',
                            'name',
                            'photos',
                            'place_id',
                            'scope',
                            'type',
                            'user_rating_total',
                            'rating',
                            'business_status',
                        ],
                    }
                );
            }

            if (!this.markerInfoWindow) {
                this.markerInfoWindow = new google.maps.InfoWindow({ content: '' });
            }

            this.placesAutocomplete.bindTo('bounds', this.props.googleMap);

            this.addHandleMapEventListener();
        }
    }

    addHandleMapEventListener() {
        if (!this.listenerPlaceChanged) {
            this.listenerPlaceChanged = this.placesAutocomplete.addListener(
                'places_changed',
                this.handleOnPlacesChanged.bind(this)
            );
        }

        if (!this.listenerMapCenterChanged) {
            this.listenerMapCenterChanged = this.props.googleMap.addListener(
                'center_changed',
                this._handleActionUpdateSearch.bind(this)
            );
        }
    }

    _handleMapOnClick(ev) {
        ev.stop();
        ev.cancelBubble = true;
        const zoomLevel = this.props.googleMap.getZoom();
        if (zoomLevel >= 17) {
            if (ev.placeId) {
                this.ui.block();
                this._handleGetPlaceDetails(ev);
            } else {
                this.ui.block();
                this._handlePlaceReverseGeocoding(ev);
            }
        }
    }

    _handleGetPlaceDetails(event) {
        this.props.placeService.getDetails(
            { placeId: event.placeId },
            (place, status) => {
                this.ui.unblock();
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    this.addPlace(place);
                } else {
                    console.warn(status);
                    this.notification.add(
                        this.env._t('Failed to fetch place detail.'),
                        {
                            type: 'warning',
                        }
                    );
                }
            }
        );
    }

    _handlePlaceReverseGeocoding(event) {
        if (!this.geocoder) {
            this.geocoder = new google.maps.Geocoder();
        }
        const latLng = event.latLng;
        this.geocoder
            .geocode({ location: latLng }, (results, status) => {
                this.ui.unblock();
                if (status === google.maps.GeocoderStatus.OK && results.length > 0) {
                    const result = results[0];
                    if (result.place_id) {
                        this.handleClickItemAdd(result);
                    } else {
                        this.notification.add(
                            this.env._t('Failed to fetch place detail'),
                            { type: 'warning' }
                        );
                    }
                } else {
                    console.warn(status);
                    this.notification.add(this.env._t('Failed to fetch place detail'), {
                        type: 'warning',
                    });
                }
            })
            .catch((err) => {
                this.ui.unblock();
                console.error(err);
                this.notification.add(this.env._t('Failed to fetch place detail'), {
                    type: 'danger',
                });
            });
    }

    /**
     * Custom control on the top center of the map
     */
    _handleActionUpdateSearch() {
        if (
            !this.updateSearchContent &&
            !this.props.isComponentFolded &&
            this.state.places.length
        ) {
            const content = renderToString(
                'base_google_places.PlacesSearchUpdateBounds',
                {}
            );
            this.updateSearchContent = new DOMParser()
                .parseFromString(content, 'text/html')
                .querySelector('div');

            // Added click listener to the button search
            this.updateSearchContent
                .querySelector('#search')
                .addEventListener('click', this.actionUpdateSearch.bind(this), false);

            // Added click listener to the button clean
            this.updateSearchContent
                .querySelector('#clear')
                .addEventListener('click', this.actionRemoveSearch.bind(this), false);

            this.props.googleMap.controls[google.maps.ControlPosition.TOP_CENTER].push(
                this.updateSearchContent
            );
        }
    }

    /**
     * Nearby search, search within 3km radius of the current map center
     */
    actionUpdateSearch() {
        const search_terms =
            this.searchBoxRef.el.querySelector('input#searchinputbox').value;
        if (search_terms) {
            const request = {
                keyword: search_terms.trim(),
                bounds: this.props.googleMap.getBounds(),
                radius: 3000, // within radius 3 km
            };
            this.props.placeService.nearbySearch(
                request,
                (places, status, pagination) => {
                    if (status !== 'OK' || !places) {
                        this.notification.add(
                            this.env._t(
                                'Search failed. No places found in the current search area'
                            ),
                            { type: 'warning' }
                        );
                        return;
                    }
                    this.placesAutocomplete.set('places', places);
                    this.state.hasNextPage = pagination.hasNextPage;
                    if (pagination && pagination.hasNextPage) {
                        this.funcGetNextPage = () => {
                            pagination.nextPage();
                        };
                    } else {
                        this.funcGetNextPage = null;
                    }
                }
            );
        }
    }

    actionResetState() {
        this.state.places = [];
        this.state.hasNextPage = false;
    }

    actionRemoveSearch() {
        // reset current places result
        this._cleanPlacesResult();
        // reset the input value
        this.searchBoxRef.el.querySelector('input#searchinputbox').value = '';
        // reset the state
        this.actionResetState();
        // reset the updateSearchContent
        this.updateSearchContent = null;
        // remove the custom control
        this._removeMapCustomControl();
        // remove event listener 'center_changed' added to the map
        if (this.listenerMapCenterChanged) {
            google.maps.event.removeListener(this.listenerMapCenterChanged);
            this.listenerMapCenterChanged = null;
        }
    }

    _actionCleanMapListener() {
        if (this.listenerMapCenterChanged) {
            google.maps.event.removeListener(this.listenerMapCenterChanged);
            this.listenerMapCenterChanged = null;
        }
        if (this.listenerMapClick) {
            google.maps.event.removeListener(this.listenerMapClick);
            this.listenerMapClick = null;
        }
        if (this.placesAutocomplete) {
            this.placesAutocomplete.set('place', null);
        }
        if (this.listenerPlaceChanged) {
            google.maps.event.removeListener(this.listenerPlaceChanged);
        }
        if (this.listenerClickAddIndicator) {
            google.maps.event.removeListener(this.listenerClickAddIndicator);
        }
    }

    _removeMapCustomControl() {
        if (
            this.props.googleMap.controls &&
            this.props.googleMap.controls.forEach &&
            this.props.googleMap.controls.forEach instanceof Function
        ) {
            let indexSearchAction = -1;
            this.props.googleMap.controls[
                google.maps.ControlPosition.TOP_CENTER
            ].forEach((element, index) => {
                if (element.id === 'custom-control-search-places') {
                    indexSearchAction = index;
                }
            });
            if (indexSearchAction > -1) {
                this.props.googleMap.controls[
                    google.maps.ControlPosition.TOP_CENTER
                ].removeAt(indexSearchAction);
            }
        }
    }

    /**
     * Fetch the next page of current search result
     */
    actionPageNext() {
        if (this.funcGetNextPage && this.state.hasNextPage) {
            this.funcGetNextPage();
        }
    }

    handleOnPlacesChanged() {
        const places = this.placesAutocomplete.getPlaces();
        // reset the previous current search result
        this._cleanPlacesResult();
        if (places) {
            // update the current bounds of placesAutocomplete
            this.placesAutocomplete.bindTo('bounds', this.props.googleMap);
            // center the map
            const bounds = new google.maps.LatLngBounds();
            places.forEach((place) => {
                this.handlePlace(place);
                if (place.geometry || place.geometry.location) {
                    if (place.geometry.viewport) {
                        bounds.union(place.geometry.viewport);
                    } else {
                        bounds.union(place.geometry.location);
                    }
                }
            });
            this.props.googleMap.fitBounds(bounds);
            // update places state
            this.state.places = [...this.placesResult];
        } else {
            this.notification.add(this.env._t('No places is found'), {
                type: 'warning',
            });
        }
    }

    handlePlace(place) {
        if (place.geometry || place.geometry.location) {
            const markerOption = {
                map: this.props.googleMap,
                draggable: false,
                animation: google.maps.Animation.DROP,
                position: place.geometry.location,
            };
            if (place.icon) {
                markerOption.icon = {
                    url: place.icon,
                    size: new google.maps.Size(71, 71),
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point(17, 34),
                    scaledSize: new google.maps.Size(25, 25),
                };
            }
            const marker = new google.maps.Marker(markerOption);
            place._marker = marker;
            this.placesResult.push(place);
        }
    }

    _cleanPlacesResult() {
        if (this.placesResult.length) {
            this.placesResult.forEach((place) => {
                place._marker.setMap(null);
            });
            this.placesResult.splice(0);
        }
    }

    /**
     * Show existing record of a place
     * @param {Object} record
     */
    actionShowPlace(record) {
        this.notification.add(
            sprintf(
                this.env._t('The place "%s" was already created'),
                record.display_name
            ),
            { type: 'info' }
        );
        this.env.model.action.doAction(
            {
                name: sprintf(this.env._t('Update Place: %s'), record.display_name),
                type: 'ir.actions.act_window',
                res_model: this.env.model.env.searchModel.resModel,
                res_id: record.id,
                views: [[false, 'form']],
                view_mode: 'form',
                target: 'new',
                flags: { mode: 'edit' },
                context: { active_id: record.id },
            },
            {
                props: {
                    onSave: async (record, params) =>
                        await this.handleAfterAction(record, 'write', params),
                },
            }
        );
    }

    /**
     * Launch an action dialog and popule place selected into Odoo fields
     * @param {Object} values
     */
    actionAddPlace(values) {
        const display_name = values.default_name || values.name;
        this.env.model.action.doAction(
            {
                name: sprintf(this.env._t('New Place: %s'), display_name),
                type: 'ir.actions.act_window',
                res_model: this.env.model.env.searchModel.resModel,
                views: [[false, 'form']],
                view_mode: 'form',
                target: 'new',
                context: values,
            },
            {
                props: {
                    onSave: async (record, params) =>
                        await this.handleAfterAction(record, 'create', params),
                },
            }
        );
    }

    /**
     * Reload the model and show notification
     * @param {Object} record
     * @param {String} mode
     * @param {Object} _params
     */
    async handleAfterAction(record, mode, _params) {
        if (record.resId) {
            this.env.model.action.doAction({
                type: 'ir.actions.act_window_close',
            });

            await this.env.model.root.load();
            this.env.model.notify();

            setTimeout(() => {
                this.centerMapToCurrentSearchResult();
                if (mode === 'create') {
                    this.notification.add(
                        this.env._t('New place is created successfully'),
                        { type: 'success' }
                    );
                } else if (mode === 'write') {
                    this.notification.add(
                        this.env._t('Place is updated successfully'),
                        { type: 'success' }
                    );
                }
            }, 500);
        }
    }

    /**
     * Check if a place was already created
     * if does not, populate place data into Odoo fields values
     * @param {Object} place
     */
    async addPlace(place) {
        const isExists = await this.env.model.orm.searchRead(
            this.env.model.env.searchModel.resModel,
            [['gplace_id', '=', place.place_id]],
            ['display_name'],
            { limit: 1 }
        );
        if (isExists.length > 0) {
            const record = isExists[0];
            this.actionShowPlace(record);
        } else {
            const values = await preparePlaces(
                this.env.model.orm,
                this.env.fields,
                place
            );

            if (values) {
                const data = await this.env.model.orm.call(
                    this.env.model.env.searchModel.resModel,
                    'action_google_place_quick_create',
                    [{ place, values }]
                );
                this.actionAddPlace(data);
            }
        }
    }

    /**
     * onClick event handler
     * @param {Object} place
     */
    handleClickItemAdd(place) {
        if (place) {
            this.props.placeService.getDetails(
                { placeId: place.place_id },
                async (place, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK) {
                        await this.addPlace(place);
                    } else {
                        console.warn(status);
                        this.notification.add(
                            this.env._t('Failed to fetch place detail'),
                            {
                                type: 'warning',
                            }
                        );
                    }
                }
            );
        }
    }

    centerMapToCurrentSearchResult() {
        if (this.placesAutocomplete) {
            const places = this.placesAutocomplete.getPlaces();
            if (places) {
                const bounds = new google.maps.LatLngBounds();
                places.forEach((place) => {
                    if (place.geometry || place.geometry.location) {
                        if (place.geometry.viewport) {
                            bounds.union(place.geometry.viewport);
                        } else {
                            bounds.union(place.geometry.location);
                        }
                    }
                });
                this.props.googleMap.fitBounds(bounds);
            }
        }
    }
}

GooglePlacesAutocompleteSidebar.template =
    'base_google_places.SidebarPlacesAutocomplete';
GooglePlacesAutocompleteSidebar.components = { GooglePlacesResult };
GooglePlacesAutocompleteSidebar.props = [
    'settings',
    'isComponentFolded',
    'googleMap',
    'placeService',
];
