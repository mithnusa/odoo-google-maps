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
     * Initialises OWL services, pre-binds event handler references, and
     * registers lifecycle hooks.
     *
     * All listener callbacks are bound once here and stored as instance fields
     * (`_bound*`) so the exact same function reference can be passed to both
     * `addEventListener` and `removeEventListener` — arrow-function callbacks
     * defined inline at call-site cannot be removed later.
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
        // Store reference to the geocoder singleton for reuse
        this._geocoder = null;

        onMounted(() => {
            this._onMounted();
        });

        onWillUnmount(() => {
            this._cleanup();
        });
    }

    /**
     * Called by OWL after the component is mounted. Registers the map `click`
     * listener and injects the add-place indicator control into the map's
     * {@link controlPosition} corner. Guards prevent double-registration if the
     * method is somehow called more than once.
     *
     * @returns {void}
     * @private
     */
    _onMounted() {
        if (!this.props.googleMap) return;

        if (!this._placeClickListener) {
            this._placeClickListener = this.props.googleMap.addListener('click', this._boundClickListener);
        }

        if (!this._mapIdleAddPlaceIndicatorListener) {
            const content = renderToString('base_google_map_add_place.PlaceCreationIndicator', {});
            this._indicatorElement = new DOMParser().parseFromString(content, 'text/html').querySelector('div');
            this._indicatorElement.querySelector('button').addEventListener('click', this._boundButtonClickListener);
            this.props.googleMap.controls[this.controlPosition].push(this._indicatorElement);
            this._mapIdleAddPlaceIndicatorListener = this.props.googleMap.addListener(
                'idle',
                this._boundMapClickableAddPlaceIndicatorListener
            );
        }
    }

    /**
     * Updates the add-place indicator button style based on the current map
     * zoom level. Bound to the Google Maps `idle` event so it runs after every
     * pan or zoom settles.
     *
     * Active state (zoom >= {@link ZOOM_THRESHOLD}): `btn-success` + `animate`.
     * Inactive state (zoom < {@link ZOOM_THRESHOLD}): `btn-light`, no animation.
     *
     * Uses {@link _indicatorElement} directly instead of scanning the controls
     * array — the reference is captured at mount time, so no DOM search is needed.
     * `classList.toggle(cls, bool)` handles add/remove idempotently, avoiding
     * redundant `contains()` guards.
     *
     * @returns {void}
     * @private
     */
    _handleMapClickableAddPlaceIndicator() {
        if (!this.props.googleMap || !this._indicatorElement) return;

        const isActive = this.props.googleMap.getZoom() >= ZOOM_THRESHOLD;
        const button = this._indicatorElement.querySelector('button');
        button.classList.toggle('btn-light', !isActive);
        button.classList.toggle('btn-success', isActive);
        button.classList.toggle('animate', isActive);
    }

    /**
     * Handles Google Maps `click` events.
     *
     * Silently ignores clicks when zoom < {@link ZOOM_THRESHOLD}. When zoomed
     * in, the Shift key must be held to confirm intent — without it an info
     * notification prompts the user and the click is discarded. This two-step
     * guard prevents accidental record creation during normal map navigation.
     *
     * Delegates to:
     * - {@link _getPlaceDetails} when the click targets a named Google Place
     *   (`event.placeId` is set).
     * - {@link _getPlaceReverseGeocode} when the click targets empty map space.
     *
     * Errors from either delegate are caught here and surfaced as error
     * notifications so the map remains usable.
     *
     * @param {google.maps.MapMouseEvent} event - The map click event.
     * @param {google.maps.LatLng} event.latLng - The geographic coordinate clicked.
     * @param {string} [event.placeId] - The Place ID of the clicked feature, if any.
     * @returns {Promise<void>}
     * @private
     */
    async _onMapClick(event) {
        if (!this.props.googleMap) return;

        const zoomLevel = this.props.googleMap.getZoom();
        if (zoomLevel < ZOOM_THRESHOLD) return;

        // Shift key must be held to add a place when zoomed out, to avoid accidental clicks
        if (!event.domEvent.shiftKey) {
            this.notificationService.add(_t('Hold Shift key and click to add a place.'), {
                type: 'info',
                autocloseDelay: 3000,
                sticky: false,
            });
            return;
        }

        if (event.placeId) {
            try {
                await this._getPlaceDetails(event);
            } catch (error) {
                console.error('Error fetching place details:', error);
                this.notificationService.add(_t('Failed to retrieve place details.'), {
                    type: 'error',
                });
            }
        } else {
            try {
                await this._getPlaceReverseGeocode(event);
            } catch (error) {
                console.error('Error performing reverse geocoding:', error);
                this.notificationService.add(_t('Failed to retrieve location information.'), {
                    type: 'error',
                });
            }
        }
    }

    /**
     * Fetches place details from the Google Places API (New) for the place
     * identified by `event.placeId`, then calls `action_in_map_google_place_create`
     * on `this.env.model.config.resModel` to obtain an Odoo action that opens
     * a pre-populated quick-create or edit form.
     *
     * Fields fetched: `addressComponents`, `displayName`, `location`,
     * `websiteURI`, `internationalPhoneNumber`, `adrFormatAddress`.
     * `location` is a `LatLng` object and is serialised to a plain `{lat, lng}`
     * via `.toJSON()` before being passed to the ORM call.
     *
     * On success, the returned `ir.actions.act_window` is executed via
     * `actionService.doAction` with an `onSave` callback that delegates to
     * {@link _handleOnSave}.
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

        const action = await this.ormService.call(this.env.model.config.resModel, 'action_in_map_google_place_create', [
            {
                placeId,
                addressComponents: place.addressComponents,
                displayName: place.displayName,
                location: place.location?.toJSON(),
                websiteURI: place.websiteURI,
                internationalPhoneNumber: place.internationalPhoneNumber,
                adrFormatAddress: place.adrFormatAddress,
            },
        ]);
        if (action && action.type === 'ir.actions.act_window') {
            // reload the view to reflect the newly created partner after the quick create form is closed
            const mode = !action.res_id ? 'create' : 'write';
            const modelName = action.context?.model_description;
            this.actionService.doAction(action, {
                props: {
                    onSave: (record, _params) => {
                        this._handleOnSave(record, mode, modelName);
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
     * Reverse-geocodes the clicked map coordinate via the shared
     * {@link _getGeocoder} singleton and passes the first result to
     * `action_in_map_google_place_from_reverse_geocode` on
     * `this.env.model.config.resModel` to obtain an Odoo action that opens a
     * pre-populated quick-create or edit form.
     *
     * Used when the click event has no `placeId` (i.e. the user clicked on
     * empty map space rather than a named Google Place).
     *
     * Displays a warning notification when geocoding returns no results.
     * On success, the returned `ir.actions.act_window` is executed via
     * `actionService.doAction` with an `onSave` callback that delegates to
     * {@link _handleOnSave}.
     *
     * @param {google.maps.MapMouseEvent} event - The map click event.
     * @param {google.maps.LatLng} event.latLng - The coordinate to reverse-geocode.
     * @returns {Promise<void>}
     * @throws {Error} Re-throws any error from the Geocoder or ORM call so
     *   the caller ({@link _onMapClick}) can catch and display it.
     * @private
     */
    async _getPlaceReverseGeocode(event) {
        const { results } = await this._getGeocoder().geocode({ location: event.latLng });
        if (results && results.length > 0) {
            const action = await this.ormService.call(
                this.env.model.config.resModel,
                'action_in_map_google_place_from_reverse_geocode',
                [results[0]]
            );
            if (action && action.type === 'ir.actions.act_window') {
                const mode = !action.res_id ? 'create' : 'write';
                const modelName = action.context?.model_description;
                this.actionService.doAction(action, {
                    props: {
                        onSave: (record, _params) => {
                            this._handleOnSave(record, mode, modelName);
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
     * 3. Shows a transient info notification with an "Open" button that
     *    navigates to the newly created or updated record.
     *
     * Does nothing when `record.resId` is falsy (user discarded the form).
     *
     * @param {import('@web/model/record').Record} record - The saved record object.
     * @param {'create'|'write'} mode - Whether the form performed a creation or
     *   an update, used to tailor the notification message.
     * @param {string} [modelName] - Human-readable model name from
     *   `action.context.model_description`. Falls back to `'record'` when absent.
     * @returns {Promise<void>}
     * @private
     */
    async _handleOnSave(record, mode, modelName) {
        if (record.resId) {
            const model_name = modelName || _t('record');
            this.actionService.doAction({ type: 'ir.actions.act_window_close' });

            await this.env.model.root.load();
            this.env.model.notify();

            if (mode === 'create') {
                this.notificationService.add(_t('%(model_name)s has been created successfully', { model_name }), {
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
                this.notificationService.add(_t('%(model_name)s has been updated successfully', { model_name }), {
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
     * (see {@link _computeSmartZoomTarget}). Falls back to the current map
     * centre when no markers are visible. Does nothing when the map is already
     * at or above the threshold.
     *
     * @param {MouseEvent} ev - The button click event.
     * @returns {void}
     * @private
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
     * The Google Maps control position used for the add-place indicator.
     * Defined as a getter so subclasses can override it without patching
     * `_onMounted` or `_cleanup`.
     *
     * @returns {google.maps.ControlPosition}
     */
    get controlPosition() {
        return google.maps.ControlPosition.RIGHT_TOP;
    }

    /**
     * Returns a shared `google.maps.Geocoder` instance, creating it on first
     * call. Reusing one instance avoids constructing a new object on every
     * reverse-geocode request.
     *
     * @returns {google.maps.Geocoder}
     * @private
     */
    _getGeocoder() {
        if (!this._geocoder) {
            this._geocoder = new google.maps.Geocoder();
        }
        return this._geocoder;
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
        const dist = (pos) => (pos.lat - centerLat) ** 2 + (pos.lng - centerLng) ** 2;

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
     * from `googleMap.controls[{@link controlPosition}]` to prevent memory
     * leaks and stale UI.
     *
     * Resources released:
     * - DOM `click` listener on the indicator button
     * - Maps `click` listener on the map (`_placeClickListener`)
     * - Maps `idle` listener for the indicator (`_mapIdleAddPlaceIndicatorListener`)
     * - The indicator `div` element from the map controls array
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
            const controls = this.props.googleMap.controls[this.controlPosition];
            for (let i = controls.getLength() - 1; i >= 0; i--) {
                if (controls.getAt(i).id === 'custom-control-add-places-indicator') {
                    controls.removeAt(i);
                }
            }
        }
    }
}
