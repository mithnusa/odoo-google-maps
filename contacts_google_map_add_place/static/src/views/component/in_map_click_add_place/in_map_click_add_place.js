import { _t } from '@web/core/l10n/translation';
import { Component, onWillUnmount, onRendered } from '@odoo/owl';
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
 * OWL component that enables users to add new Odoo contacts directly from
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
    static template = 'contacts_google_map_add_place.ClickAddPlace';
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
        this._boundMapClickableAddPlaceIndicatorListener =
            this._handleMapClickableAddPlaceIndicator.bind(this);
        // Store click listener reference for proper cleanup
        this._placeClickListener = null;
        // Store reference to the map click listener for proper cleanup
        this._mapIdleAddPlaceIndicatorListener = null;
        onRendered(this._onRendered);
        onWillUnmount(this._cleanup);
    }

    /**
     * Called by OWL after every render. Registers the map click listener and
     * injects the add-place indicator control into the map's RIGHT_TOP corner
     * exactly once — subsequent renders are no-ops thanks to the null-checks.
     *
     * @returns {void}
     * @private
     */
    _onRendered() {
        if (!this.props.googleMap) return;

        if (!this._placeClickListener) {
            this._placeClickListener = this.props.googleMap.addListener(
                'click',
                this._boundClickListener
            );
        }

        if (!this._mapIdleAddPlaceIndicatorListener) {
            const content = renderToString(
                'contacts_google_map_add_place.PlaceCreationIndicator',
                {}
            );
            const indicator = new DOMParser()
                .parseFromString(content, 'text/html')
                .querySelector('div');
            this.props.googleMap.controls[google.maps.ControlPosition.RIGHT_TOP].push(indicator);
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
            'res.partner',
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
                'res.partner',
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
     *    navigates to the newly created or updated contact.
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
                this.notificationService.add(_t('New contact is created successfully'), {
                    type: 'info',
                    autocloseDelay: 5000,
                    sticky: false,
                    buttons: [
                        {
                            name: _t('Open'),
                            onClick: async () => {
                                this.env.openRecord(record);
                            },
                        },
                    ],
                });
            } else if (mode === 'write') {
                this.notificationService.add(_t('Contact is updated successfully'), {
                    type: 'info',
                    autocloseDelay: 5000,
                    sticky: false,
                    buttons: [
                        {
                            name: _t('Open'),
                            onClick: async () => {
                                this.env.openRecord(record);
                            },
                        },
                    ],
                });
            }
        }
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
