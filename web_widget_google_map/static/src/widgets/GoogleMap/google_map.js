import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { standardWidgetProps } from '@web/views/widgets/standard_widget_props';
import { Component, useRef, useEffect, useState, onWillUnmount, useSubEnv } from '@odoo/owl';

import { ConfirmationDialog } from '@web/core/confirmation_dialog/confirmation_dialog';
import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';
import { GoogleMapSearchPlaces } from '../../components/search_places/search_places';

/**
 * Dialog component for editing geolocation coordinates with an interactive Google Map.
 * Allows users to drag a marker to update latitude and longitude values.
 *
 * Lifecycle safety: `_isUnmounted` is set in `onWillUnmount` so that every async
 * continuation (importLibrary, tilesloaded promise, idle callback) becomes a no-op
 * if the dialog is closed before they fire.
 *
 * @extends ConfirmationDialog
 */
class GeolocationEditDialog extends ConfirmationDialog {
    static template = 'web_widget_google_map.GeolocationEditDialog';
    static components = {
        ...ConfirmationDialog.components,
        GoogleMapSearchPlaces,
    };
    static props = {
        ...ConfirmationDialog.props,
        confirm: Function,
        lat: Number,
        lng: Number,
        readonly: Boolean,
        mapType: String,
    };

    static defaultProps = {
        ...ConfirmationDialog.defaultProps,
        confirmLabel: _t('Save'),
    };

    /**
     * Initializes the dialog component, sets up services, state, and Google Maps API loader.
     * Configures an effect hook for map initialization and registers cleanup on unmount.
     *
     * `_tilesLoadedListener` stores the MapsEventListener handle returned by the
     * `tilesloaded` event so it can be cancelled in `_cleanupListeners` if the dialog
     * closes before tiles finish rendering.
     *
     * `_isUnmounted` acts as a guard flag — set to true in `_cleanupListeners` so
     * that any pending async step (importLibrary, tilesloaded, idle) returns early
     * instead of touching a detached component.
     */
    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.notificationService = useService('notification');
        this.uiService = useService('ui');
        this.googleMap = null;
        this._tilesLoadedListener = null;
        this._isUnmounted = false;
        this._resolveTilesLoaded = null;

        // Local variables to store the latitude and longitude while dragging the marker
        this.localLat = this.props.lat || 0.0;
        this.localLng = this.props.lng || 0.0;

        this.state = useState({ isGoogleLoaded: false, isMapReady: false });

        this.apiLoader = useGoogleMapsAPILoader(
            () => {
                this.state.isGoogleLoaded = true;
            },
            (error) => {
                this.state.isGoogleLoaded = false;
                this.notificationService.add(
                    _t('Failed to load Google Maps API.\n%(err)s', { err: error.message || error }),
                    { type: 'danger' }
                );
            }
        );
        useEffect(
            (isGoogleLoaded, mapRef) => {
                if (isGoogleLoaded && mapRef.el) {
                    this.initializeMap();
                }
            },
            () => [this.state.isGoogleLoaded, this.mapRef]
        );

        useSubEnv({
            mapState: this.state,
            apiLoader: this.apiLoader,
            googleMap: () => this.googleMap,
        });

        onWillUnmount(this._cleanupListeners.bind(this));
    }

    /**
     * Cleans up all Google Maps resources to prevent memory leaks and stale callbacks.
     * Called automatically by `onWillUnmount`.
     *
     * Steps in order:
     * 1. Set `_isUnmounted` so async continuations return early.
     * 2. Cancel any pending `tilesloaded` listener (can fire after dialog DOM is removed).
     * 3. Remove the `dragend` listener and detach the marker from the map.
     * 4. Call `clearInstanceListeners` on the map — removes all remaining Maps API
     *    event bindings (including those set by the Maps SDK internals) so no queued
     *    callback can touch the detached cross-origin iframes the SDK creates internally.
     */
    _cleanupListeners() {
        this._isUnmounted = true;
        if (this._tilesLoadedListener) {
            google.maps.event.removeListener(this._tilesLoadedListener);
            this._tilesLoadedListener = null;
        }
        if (this._resolveTilesLoaded) {
            this._resolveTilesLoaded(); // unblock any pending await on tilesloaded
            this._resolveTilesLoaded = null;
        }
        if (this.marker) {
            if (!this.props.readonly) {
                google.maps.event.clearListeners(this.marker, 'dragend');
            }
            this.marker.map = null;
            this.marker = null;
        }
        if (this.googleMap) {
            google.maps.event.clearInstanceListeners(this.googleMap);
        }
    }

    /**
     * Initializes the Google Map instance with the specified coordinates and settings.
     * Displays a loading indicator during initialization and handles errors gracefully.
     *
     * @async
     * @returns {Promise<void>}
     */
    async initializeMap() {
        try {
            this.uiService.block();
            if (this.googleMap) {
                await this.onMapReady(this.googleMap);
                return;
            }
            const { Map } = await this.apiLoader.importLibrary('maps');
            if (this._isUnmounted) return;
            const settings = this.apiLoader.getSettings();
            const mapElement = this.mapRef.el;
            const { lat = 0.0, lng = 0.0 } = this.props;
            const options = {
                center: { lat, lng },
                mapId: settings.map_id,
                zoom: lat && lng ? 17 : 3,
                mapTypeId: this.props.mapType || 'roadmap',
                gestureHandling: 'greedy',
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: true,
                fullscreenControl: true,
                mapTypeControl: true,
            };
            const googleMap = new Map(mapElement, options);
            this.googleMap = googleMap;
            await this.onMapReady(googleMap);
        } catch (error) {
            this.notificationService.add(
                _t('Failed to initialize Google Map.\n%(err)s', { err: error.message || error }),
                { type: 'danger' }
            );
        } finally {
            this.uiService.unblock();
        }
    }

    /**
     * Waits for the map tiles to finish loading before rendering the marker.
     *
     * The `tilesloaded` listener handle is stored on `this._tilesLoadedListener` so
     * `_cleanupListeners` can cancel it if the dialog closes before tiles finish.
     * After the await, `_isUnmounted` is checked before touching component state.
     *
     * @async
     * @param {google.maps.Map} map - The Google Maps instance
     * @returns {Promise<void>}
     */
    async onMapReady(map) {
        await new Promise((resolve) => {
            this._resolveTilesLoaded = resolve;
            this._tilesLoadedListener = map.addListener('tilesloaded', () => {
                google.maps.event.removeListener(this._tilesLoadedListener);
                this._tilesLoadedListener = null;
                this._resolveTilesLoaded = null;
                resolve();
            });
        });
        if (this._isUnmounted) return;
        this.state.isMapReady = true;
        await this.renderMarker();
    }

    /**
     * Renders a draggable marker on the map at the current coordinates.
     * The marker can be dragged to update the location (unless readonly is true).
     * Automatically zooms and centers the map if valid coordinates are provided.
     *
     * Guards `_isUnmounted` twice: after `importLibrary` (async) and inside the
     * `idle` callback so neither path writes to the component after it unmounts.
     *
     * @async
     * @returns {Promise<void>}
     */
    async renderMarker() {
        const { lat, lng } = this.props;

        const isZoomIn = lat !== 0.0 && lng !== 0.0;
        const markerOptions = {
            position: { lat, lng },
            map: this.googleMap,
            gmpDraggable: !this.props.readonly,
        };

        try {
            const { AdvancedMarkerElement } = await this.apiLoader.importLibrary('marker');
            if (this._isUnmounted) return;
            this.marker = new AdvancedMarkerElement(markerOptions);
            if (!this.props.readonly) {
                this.marker.addListener('dragend', this._handleMarkerDragend.bind(this));
            }
            if (isZoomIn) {
                google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                    if (!this._isUnmounted && this.googleMap.getZoom() < 16) {
                        this.googleMap.setZoom(16);
                    }
                });
            }
        } catch (error) {
            this.notificationService.add(
                _t('Failed to load Google Maps API.\n%(err)s', { err: error.message || error }),
                { type: 'danger' }
            );
            return;
        }
    }

    /**
     * Handles the confirm button click, passing the updated coordinates to the callback.
     *
     * @override
     * @async
     * @returns {Promise<void>}
     */
    async _confirm() {
        return this.execButton(this.props.confirm, this.localLat, this.localLng);
    }

    /**
     * Executes a button callback with optional coordinates and closes the dialog if successful.
     * Disables buttons during execution to prevent duplicate clicks.
     *
     * @override
     * @async
     * @param {Function} callback - The callback function to execute
     * @param {number} [lat] - The latitude value to pass to the callback
     * @param {number} [lng] - The longitude value to pass to the callback
     * @returns {Promise<void>}
     */
    async execButton(callback, lat, lng) {
        if (this.isProcess) {
            return;
        }
        this.setButtonsDisabled(true);
        if (callback) {
            let shouldClose;
            try {
                if (typeof lat === 'number' && typeof lng === 'number') {
                    shouldClose = await callback(lat, lng);
                } else {
                    shouldClose = await callback();
                }
            } catch (e) {
                this.props.close();
                throw e;
            }
            if (shouldClose === false) {
                this.setButtonsDisabled(false);
                return;
            }
        }
        this.props.close();
    }

    /**
     * Handles the marker dragend event, updating local coordinates and centering the map.
     *
     * `AdvancedMarkerElement.position` after a drag returns a `google.maps.LatLng`
     * object where `.lat` and `.lng` are methods, not plain numbers. The `typeof`
     * guard handles both the LatLng object form and a plain `{lat, lng}` literal
     * so the stored values are always numbers.
     *
     * @async
     * @returns {Promise<void>}
     */
    async _handleMarkerDragend() {
        const position = this.marker.position;
        this.googleMap.panTo(position);
        this.localLat = typeof position.lat === 'function' ? position.lat() : position.lat;
        this.localLng = typeof position.lng === 'function' ? position.lng() : position.lng;
    }

    get dialogTitle() {
        return this.props.readonly ? _t('Location on Map') : _t('Update Location');
    }

    openGoogleMaps() {
        const lat = this.localLat;
        const lng = this.localLng;
        if (lat && lng) {
            const aHrefEl = document.createElement('a');
            aHrefEl.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            aHrefEl.target = '_blank';
            aHrefEl.rel = 'noopener noreferrer';

            document.body.appendChild(aHrefEl);
            aHrefEl.click();

            document.body.removeChild(aHrefEl);
        }
    }
}

/**
 * Widget component that renders a single button on a form view.
 * Clicking the button opens `GeolocationEditDialog`, which shows an interactive
 * Google Map centred on the record's current coordinates. In edit mode the user
 * can drag the marker to update the lat/lng fields; in readonly mode the dialog
 * is read-only with only the "Open in Google Maps" link active.
 *
 * @extends Component
 */
export class GoogleMapWidget extends Component {
    static template = 'web_widget_google_map.GoogleMapWidget';
    static props = {
        ...standardWidgetProps,
        lat: String,
        lng: String,
        maptype: { type: String, optional: true },
    };

    /**
     * Initializes the widget, validates props, and wires up the dialog service.
     */
    setup() {
        this.validateProps();
        this.dialogService = useService('dialog');
    }

    /**
     * Gets the latitude value from the record data.
     *
     * @returns {number} The latitude value or 0.0 if not available
     */
    get latitude() {
        try {
            return this.props.record.data[this.props.lat] || 0.0;
        } catch (e) {
            return 0.0;
        }
    }

    /**
     * Gets the longitude value from the record data.
     *
     * @returns {number} The longitude value or 0.0 if not available
     */
    get longitude() {
        try {
            return this.props.record.data[this.props.lng] || 0.0;
        } catch (e) {
            return 0.0;
        }
    }

    /**
     * Validates and returns the map type, defaulting to 'roadmap' if invalid.
     *
     * @returns {string} A valid map type ('roadmap' or 'satellite')
     */
    getMapType() {
        const mapTypes = ['roadmap', 'satellite'];
        if (!mapTypes.includes(this.props.maptype)) {
            return 'roadmap';
        }
        return this.props.maptype;
    }

    /**
     * Updates the geolocation fields in the record with new coordinates.
     *
     * @param {number} lat - The new latitude value
     * @param {number} lng - The new longitude value
     */
    _updateGeolocation(lat, lng) {
        this.props.record.update({
            [this.props.lat]: lat,
            [this.props.lng]: lng,
        });
    }

    /**
     * Opens the geolocation edit dialog for interactive coordinate editing.
     *
     * @async
     * @returns {Promise<void>}
     */
    async handleOnEdit() {
        this.dialogService.add(GeolocationEditDialog, {
            lat: this.latitude,
            lng: this.longitude,
            readonly: this.props.readonly,
            mapType: this.getMapType(),
            confirm: (lat, lng) => {
                this._updateGeolocation(lat, lng);
            },
            cancel: () => {},
        });
    }

    /**
     * Validates that required props (lat and lng) are present and correspond to existing fields.
     *
     * @throws {Error} If required props are missing or fields don't exist in the record
     */
    validateProps() {
        if (!this.props.lat || !this.props.lng) {
            throw new Error("Widget google_map: 'lat' and 'lng' props are required.");
        }
        if (!this.props.record.fields[this.props.lat] || !this.props.record.fields[this.props.lng]) {
            throw new Error(
                `Widget google_map: fields '${this.props.lat}' and '${this.props.lng}' must be present in the view.`
            );
        }
    }
}

/**
 * Google Map widget registration object for the Odoo view widgets registry.
 * Maps XML attributes to component props.
 *
 * @type {Object}
 * @property {Component} component - The GoogleMapWidget component
 * @property {Function} extractProps - Function to extract props from XML attributes
 */
export const googleMapWidget = {
    component: GoogleMapWidget,
    extractProps: ({ attrs }) => ({
        lat: attrs.lat,
        lng: attrs.lng,
        maptype: attrs.maptype,
    }),
};

registry.category('view_widgets').add('google_map', googleMapWidget);
