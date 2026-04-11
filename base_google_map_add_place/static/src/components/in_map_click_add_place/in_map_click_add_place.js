import { _t } from '@web/core/l10n/translation';
import { Component, onWillUnmount, onMounted } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { renderToString } from '@web/core/utils/render';

/**
 * Minimum zoom level required to enable map-click-to-add-place functionality.
 * Below this threshold, clicking the map does nothing; at or above it,
 * clicks trigger place creation or reverse-geocoding workflows.
 * @constant {number}
 */
const ZOOM_THRESHOLD = 15;

/**
 * OWL component that enables users to add new Odoo record directly from
 * the Google Maps view by clicking on the map.
 *
 * When the map zoom level is at or above {@link ZOOM_THRESHOLD}:
 * - Clicking a known Google Place (with a placeId) fetches its details via
 *   the Places API and opens a pre-populated Odoo quick-create/edit form.
 * - Clicking empty map space reverse-geocodes the coordinate via the
 *   Geocoding API and opens a pre-populated form with the first result.
 *
 * A visual indicator control is injected into the map's RIGHT_TOP corner to
 * signal whether map-click-to-add is currently active (green/animated when
 * zoom >= threshold, neutral otherwise).
 *
 * @class InMapClickAddPlace
 * @extends {Component}
 */
export class InMapClickAddPlace extends Component {
    static template = 'base_google_map_add_place.ClickAddPlace';
    static props = ['googleMap'];

    /**
     * Initialises OWL services, pre-binds event handler references so they
     * can be properly removed on cleanup, and registers lifecycle hooks.
     *
     * @returns {void}
     */
    setup() {
        this.ormService = useService('orm');
        this.notificationService = useService('notification');
        this.actionService = useService('action');
        // Store bound reference for proper cleanup
        this._boundClickListener = this._onMapClick.bind(this);
        // Store bound reference for map idle listener to properly clean it up
        this._boundMapClickableAddPlaceIndicatorListener = this._handleMapClickableAddPlaceIndicator.bind(this);
        // Store click listener reference for proper cleanup
        this._placeClickListener = null;
        // Store reference to the map click listener for proper cleanup
        this._mapIdleAddPlaceIndicatorListener = null;
        // Store reference to the injected indicator element for cleanup
        this._indicatorElement = null;
        // Store bound reference for button click listener to properly clean it up
        this._boundButtonClickListener = this.actionZoomInMap.bind(this);

        onMounted(() => {
            this._onMounted();
        });

        onWillUnmount(() => {
            this._cleanup();
        });
    }

    /**
     * Called by OWL after component is mounted. Registers the map click listener and
     * injects the add-place indicator control into the map's RIGHT_TOP corner
     * exactly once — subsequent renders are no-ops thanks to the null-checks.
     *
     * @returns {void}
     * @private
     */
    _onMounted() {
        if (!this.props.googleMap) return;

        if (!this._placeClickListener) {
            this._placeClickListener = this.props.googleMap.addListener(
                'click',
                this._boundClickListener
            );
        }

        if (!this._mapIdleAddPlaceIndicatorListener) {
            const content = renderToString(
                'base_google_map_add_place.PlaceCreationIndicator',
                {}
            );
            this._indicatorElement = new DOMParser().parseFromString(content, 'text/html').querySelector('div');
            this._indicatorElement.querySelector('button').addEventListener('click', this._boundButtonClickListener);
            this.props.googleMap.controls[google.maps.ControlPosition.RIGHT_TOP].push(this._indicatorElement);
            this._mapIdleAddPlaceIndicatorListener = this.props.googleMap.addListener(
                'idle',
                this._boundMapClickableAddPlaceIndicatorListener
            );
        }
    }

    /**
     * Updates the add-place indicator button style based on the current map
     * zoom level. Triggered on every Google Maps `idle` event.
     *
     * - Zoom >= {@link ZOOM_THRESHOLD}: switches the button to `btn-success`
     *   with an `animate` class, signalling that map clicks will create a place.
     * - Zoom < {@link ZOOM_THRESHOLD}: reverts to `btn-light` without animation,
     *   signalling that map clicks are inactive.
     *
     * @returns {void}
     * @private
     */
    _handleMapClickableAddPlaceIndicator() {
        if (!this.props.googleMap) return;

        const zoomLevel = this.props.googleMap.getZoom();
        this.props.googleMap.controls[google.maps.ControlPosition.RIGHT_TOP].forEach((element) => {
            if (element.id === 'custom-control-add-places-indicator') {
                let button = element.querySelector('button');
                if (zoomLevel >= ZOOM_THRESHOLD) {
                    if (button.classList.contains('btn-light')) {
                        button.classList.remove('btn-light');
                        button.classList.add('btn-success', 'animate');
                    }
                } else {
                    button.classList.remove('animate', 'btn-success');
                    if (!button.classList.contains('btn-light')) {
                        button.classList.add('btn-light');
                    }
                }
            }
        });
    }

    /**
     * Handles Google Maps `click` events. Ignores clicks when the current
     * zoom level is below {@link ZOOM_THRESHOLD}.
     *
     * Delegates to:
     * - {@link _getPlaceDetails} when the click targets a known Google Place
     *   (i.e. `event.placeId` is set).
     * - {@link _getPlaceReverseGeocode} when the click targets empty map space.
     *
     * Errors in either delegate are caught here and surfaced as warning
     * notifications so the map remains usable.
     *
     * @param {google.maps.MapMouseEvent} event - The map click event.
     * @param {google.maps.LatLng} event.latLng - The geographic coordinate that was clicked.
     * @param {string} [event.placeId] - The Place ID of the clicked feature, if any.
     * @returns {Promise<void>}
     * @private
     */
    async _onMapClick(event) {
        if (!this.props.googleMap) return;

        const zoomLevel = this.props.googleMap.getZoom();
        if (zoomLevel >= ZOOM_THRESHOLD) {
            if (event.placeId) {
                try {
                    await this._getPlaceDetails(event);
                } catch (error) {
                    console.error('Error fetching place details:', error);
                    this.notificationService.add(_t('Failed to retrieve place details.'), {
                        type: 'warning',
                    });
                }
            } else {
                try {
                    await this._getPlaceReverseGeocode(event);
                } catch (error) {
                    console.error('Error performing reverse geocoding:', error);
                    this.notificationService.add(_t('Failed to retrieve place information.'), {
                        type: 'warning',
                    });
                }
            }
        }
    }

    /**
     * Fetches full place details from the Google Places API (New) for the
     * place identified by `event.placeId`, then calls the Python method
     * `res.partner.action_in_map_google_place_create` to obtain an Odoo
     * action that opens a pre-populated quick-create or edit form.
     *
     * Fields fetched from the Places API:
     * `addressComponents`, `displayName`, `location`, `websiteURI`,
     * `internationalPhoneNumber`, `adrFormatAddress`.
     *
     * On success, the returned `ir.actions.act_window` is executed via
     * {@link actionService.doAction} with an `onSave` callback that
     * delegates to {@link _handleOnSave}.
     *
     * @param {google.maps.MapMouseEvent} event - The map click event.
     * @param {string} event.placeId - The Google Place ID of the clicked feature.
     * @returns {Promise<void>}
     * @throws {Error} Re-throws any error from the Places API or ORM call so
     *   the caller ({@link _onMapClick}) can catch and display it.
     * @private
     */
    async _getPlaceDetails(event) {
        const placeId = event.placeId;
        const { Place } = await this.env.apiLoader.importLibrary('places');
        const place = new Place({ id: placeId });
        // Fetch place details to get the name and other information
        await place.fetchFields({
            fields: [
                'addressComponents',
                'displayName',
                'location',
                'websiteURI',
                'internationalPhoneNumber',
                'adrFormatAddress',
            ],
        });

        const placeData = place.toJSON();
        const {
            addressComponents,
            displayName,
            location,
            websiteURI,
            internationalPhoneNumber,
            adrFormatAddress,
        } = placeData; // Destructure to ensure place details are fetched

        const action = await this.ormService.call(
            this.env.model.config.resModel,
            'action_in_map_google_place_create',
            [
                {
                    placeId,
                    addressComponents,
                    displayName,
                    location,
                    websiteURI,
                    internationalPhoneNumber,
                    adrFormatAddress,
                },
            ]
        );
        if (action && action.type === 'ir.actions.act_window') {
            // reload the view to reflect the newly created partner after the quick create form is closed
            const mode = !action.res_id ? 'create' : 'write';
            this.actionService.doAction(action, {
                props: {
                    onSave: (record, _params) => {
                        this._handleOnSave(record, mode);
                    },
                },
            });
        } else {
            this.notificationService.add(_t('Failed to open the quick create form.'), {
                type: 'warning',
            });
        }
    }

    /**
     * Reverse-geocodes the clicked map coordinate using `google.maps.Geocoder`
     * and passes the first result to the Python method
     * `res.partner.action_in_map_google_place_from_reverse_geocode` to obtain
     * an Odoo action that opens a pre-populated quick-create or edit form.
     *
     * Used when the click event has no `placeId` (i.e. the user clicked on
     * empty map space rather than a named Google Place).
     *
     * On success, the returned `ir.actions.act_window` is executed via
     * {@link actionService.doAction} with an `onSave` callback that
     * delegates to {@link _handleOnSave}.
     *
     * Displays a warning notification when geocoding returns no results.
     *
     * @param {google.maps.MapMouseEvent} event - The map click event.
     * @param {google.maps.LatLng} event.latLng - The coordinate to reverse-geocode.
     * @returns {Promise<void>}
     * @throws {Error} Re-throws any error from the Geocoder or ORM call so
     *   the caller ({@link _onMapClick}) can catch and display it.
     * @private
     */
    async _getPlaceReverseGeocode(event) {
        const geocoder = new google.maps.Geocoder();
        const { results } = await geocoder.geocode({ location: event.latLng });
        if (results && results.length > 0) {
            const action = await this.ormService.call(
                this.env.model.config.resModel,
                'action_in_map_google_place_from_reverse_geocode',
                [results[0]]
            );
            if (action && action.type === 'ir.actions.act_window') {
                const mode = !action.res_id ? 'create' : 'write';
                this.actionService.doAction(action, {
                    props: {
                        onSave: (record, _params) => {
                            this._handleOnSave(record, mode);
                        },
                    },
                });
            } else {
                this.notificationService.add(_t('Failed to open the quick create form.'), {
                    type: 'warning',
                });
            }
        } else {
            this.notificationService.add(_t('Failed to retrieve place information.'), {
                type: 'warning',
            });
        }
    }

    /**
     * Callback invoked by the Odoo action framework after the user saves the
     * quick-create or edit form opened by {@link _getPlaceDetails} or
     * {@link _getPlaceReverseGeocode}.
     *
     * On a successful save (`record.resId` is truthy):
     * 1. Closes the dialog/action window.
     * 2. Reloads the parent map view's root record set.
     * 3. Shows a sticky-free info notification with an "Open" button that
     *    navigates to the newly created or updated record.
     *
     * @param {import('@web/model/record').Record} record - The saved record object.
     * @param {'create'|'write'} mode - Whether the form performed a creation
     *   or an update, used to tailor the notification message.
     * @returns {Promise<void>}
     * @private
     */
    async _handleOnSave(record, mode) {
        if (record.resId) {
            this.actionService.doAction({ type: 'ir.actions.act_window_close' });

            await this.env.model.root.load();
            this.env.model.notify();

            if (mode === 'create') {
                this.notificationService.add(_t('Record created successfully'), {
                    type: 'info',
                    autocloseDelay: 5000,
                    sticky: false,
                    buttons: [
                        {
                            name: _t('Open'),
                            onClick: () => {
                                this.env.openRecord(record);
                            },
                        },
                    ],
                });
            } else if (mode === 'write') {
                this.notificationService.add(_t('Record updated successfully'), {
                    type: 'info',
                    autocloseDelay: 5000,
                    sticky: false,
                    buttons: [
                        {
                            name: _t('Open'),
                            onClick: () => {
                                this.env.openRecord(record);
                            },
                        },
                    ],
                });
            }
        }
    }

    /**
     * Handles a click on the add-place indicator button.
     *
     * When the map is below {@link ZOOM_THRESHOLD}, zooms in to the threshold
     * level and pans to the nearest marker visible in the current viewport
     * (see {@link _computeSmartZoomTarget}). If no markers are visible the map
     * simply zooms in on the current centre, preserving the user's intended
     * location.
     *
     * Does nothing when the map is already at or above the threshold.
     *
     * @param {MouseEvent} ev - The button click event.
     * @returns {void}
     */
    actionZoomInMap(ev) {
        ev.stopPropagation();
        if (!this.props.googleMap) return;

        const currentZoom = this.props.googleMap.getZoom();
        if (currentZoom >= ZOOM_THRESHOLD) return;

        const target = this._computeSmartZoomTarget();
        this.props.googleMap.setZoom(ZOOM_THRESHOLD);
        this.props.googleMap.panTo(target);
    }

    /**
     * Computes the best pan target for the zoom-in action.
     *
     * Finds the marker closest to the current map centre among those already
     * visible inside the current viewport bounds. This keeps the result
     * within the user's current view and anchors it to an actual data point
     * rather than a computed average.
     *
     * Falls back to `map.getCenter()` when no markers are visible in the
     * viewport (e.g. the user has panned to an empty area), preserving the
     * existing zoom-to-centre behaviour.
     *
     * Uses `marker._originalPosition` in preference to `marker.position` to
     * avoid bias introduced by overlap-offset shifts.
     *
     * @returns {google.maps.LatLng|{lat: number, lng: number}}
     * @private
     */
    _computeSmartZoomTarget() {
        const cache = this.env.cache;
        const center = this.props.googleMap.getCenter();
        if (!cache?.size) return center;

        const bounds = this.props.googleMap.getBounds();
        const centerLat = center.lat();
        const centerLng = center.lng();

        // Euclidean distance on lat/lng — sufficient at this scale
        const dist = (pos) =>
            (pos.lat - centerLat) ** 2 + (pos.lng - centerLng) ** 2;

        let nearest = null;
        let nearestDist = Infinity;

        for (const marker of cache.values()) {
            const pos = marker._originalPosition || marker.position;
            if (!pos) continue;
            if (!bounds?.contains({ lat: pos.lat, lng: pos.lng })) continue;
            const d = dist(pos);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = pos;
            }
        }

        return nearest ?? center;
    }

    /**
     * OWL `onWillUnmount` hook. Removes all Google Maps event listeners
     * registered by this component and strips the add-place indicator control
     * from the map's RIGHT_TOP corner to prevent memory leaks and stale UI.
     *
     * Listeners cleaned up:
     * - `click` listener on the map (`_placeClickListener`)
     * - `idle` listener for the indicator button (`_mapIdleAddPlaceIndicatorListener`)
     * - The injected indicator DOM element from `googleMap.controls[RIGHT_TOP]`
     *
     * @returns {void}
     * @private
     */
    _cleanup() {
        if (this._indicatorElement) {
            this._indicatorElement.querySelector('button').removeEventListener('click', this._boundButtonClickListener);
            this._indicatorElement = null;
        }
        if (this._placeClickListener) {
            this._placeClickListener.remove();
            this._placeClickListener = null;
        }
        if (this._mapIdleAddPlaceIndicatorListener) {
            this._mapIdleAddPlaceIndicatorListener.remove();
            this._mapIdleAddPlaceIndicatorListener = null;
        }
        if (this.props.googleMap) {
            const controls = this.props.googleMap.controls[google.maps.ControlPosition.RIGHT_TOP];
            for (let i = controls.getLength() - 1; i >= 0; i--) {
                if (controls.getAt(i).id === 'custom-control-add-places-indicator') {
                    controls.removeAt(i);
                }
            }
        }
    }
}
