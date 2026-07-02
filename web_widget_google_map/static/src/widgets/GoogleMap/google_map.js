import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { standardWidgetProps } from '@web/views/widgets/standard_widget_props';
import { rpc } from '@web/core/network/rpc';
import { Component, onWillStart, useRef, useEffect, useState, onWillUnmount, useSubEnv } from '@odoo/owl';

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
    };

    static defaultProps = {
        ...ConfirmationDialog.defaultProps,
        title: _t('Edit Geolocation'),
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
                zoom: lat && lng ? 16 : 3,
                mapTypeId: 'roadmap',
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
            this._tilesLoadedListener = map.addListener('tilesloaded', () => {
                google.maps.event.removeListener(this._tilesLoadedListener);
                this._tilesLoadedListener = null;
                resolve();
            });
        });
        if (this._isUnmounted) return;
        this.state.isMapReady = true;
        this.renderMarker();
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
            if (isZoomIn) {
                this.googleMap.panTo({ lat, lng });
            }
            if (!this.props.readonly) {
                this.marker.addListener('dragend', this._handleMarkerDragend.bind(this));
            }
            google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                if (!this._isUnmounted && this.googleMap.getZoom() < 16) {
                    this.googleMap.setZoom(16);
                }
            });
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
}

/**
 * Widget component that displays a Google Maps Static API image for a given location.
 * Renders a collapsible map preview with a toggle button and an edit button that opens
 * `GeolocationEditDialog` for interactive coordinate updates.
 *
 * The static image avoids embedding a cross-origin iframe in the form view, which would
 * cause `SecurityError` in Odoo's `useClickAway` hook whenever a tooltip or popover
 * appears on the same page.
 *
 * @extends Component
 */
export class GoogleMapWidget extends Component {
    static template = 'web_widget_google_map.GoogleMapWidget';
    static props = {
        ...standardWidgetProps,
        lat: String,
        lng: String,
        width: { type: String, optional: true },
        height: { type: String, optional: true },
        zoom: { type: Number, optional: true },
        maptype: { type: String, optional: true },
    };
    static defaultProps = {
        zoom: 14,
        maptype: 'roadmap',
        width: 400,
        height: 200,
    };

    /**
     * Initializes the widget, validates props, and loads Google Maps settings.
     *
     * `state.isMapVisible` drives the collapsible map toggle — the static image is only
     * rendered (and fetched) when the user explicitly shows the map.
     */
    setup() {
        this.validateProps();
        this.settings = {};
        this.state = useState({ isMapVisible: false });
        this.dialogService = useService('dialog');
        onWillStart(this.loadGoogleSetting.bind(this));
    }

    /**
     * Loads Google Maps API settings from the server.
     *
     * @async
     * @returns {Promise<void>}
     */
    async loadGoogleSetting() {
        if (!Object.keys(this.settings).length && !this.props.invisible) {
            const { context } = this.props.record;
            const settings = await rpc('/web/base_google_map/settings', { context });
            if (settings) {
                this.settings = { ...settings };
            }
        }
    }

    /**
     * Computes the Maps Static API image source URL from the current record coordinates.
     * Returns `false` when the API key is not yet loaded so the template can hide the
     * toggle button entirely.
     *
     * Because `props.record` is reactive, OWL re-evaluates this getter whenever the
     * latitude or longitude field changes, automatically updating the displayed image.
     *
     * @returns {string|false} The static map image URL, or false if the key is unavailable
     */
    get staticMapSrc() {
        if (this.settings?.api_key) {
            return this.generateSrc(this.settings.api_key);
        }
        return false;
    }

    /**
     * Base URL for the Google Maps Static API.
     * Requires the "Maps Static API" to be enabled in Google Cloud Console
     * (separate product from Maps Embed API and Maps JavaScript API).
     *
     * @returns {string}
     */
    get baseUrl() {
        return 'https://maps.googleapis.com/maps/api/staticmap';
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
     * Builds the query-parameter object for the Maps Static API request.
     *
     * - `center` + `zoom`: always required; zoom is reduced to 3 when coordinates are 0,0.
     * - `size`: must be integer pixel dimensions (`WxH`). `toPixels` rejects non-integer
     *   strings (e.g. "100%") by comparing the parsed integer back to the original string,
     *   and caps values at 640 (the Static API maximum). Falls back to safe defaults.
     * - `markers`: added only when valid coordinates exist; omitted for 0,0 to avoid a
     *   red pin appearing in the middle of the ocean.
     *
     * @returns {Object} Query parameters for the Static Maps API
     */
    get params() {
        const lat = this.latitude;
        const lng = this.longitude;
        const maptype = this.getMapType();
        const hasLocation = lat !== 0.0 || lng !== 0.0;
        const zoom = hasLocation ? this.props.zoom : 3;
        // Static Maps API requires integer pixel dimensions — reject percentages and other non-integer values.
        const toPixels = (val, fallback) => {
            const n = parseInt(val, 10);
            return Number.isFinite(n) && n > 0 && String(n) === String(val).trim() ? Math.min(n, 640) : fallback;
        };
        const width = toPixels(this.props.width, 400);
        const height = toPixels(this.props.height, 200);
        const p = {
            center: `${lat},${lng}`,
            zoom,
            size: `${width}x${height}`,
            maptype,
        };
        if (hasLocation) {
            p.markers = `color:red|${lat},${lng}`;
        }
        return p;
    }

    /**
     * Assembles the complete Maps Static API image URL from the current params and API key.
     *
     * @param {string} api_key - The Google Maps API key
     * @returns {string} The complete static map image URL
     */
    generateSrc(api_key) {
        const params = { ...this.params, key: api_key };
        const url = new URL(this.baseUrl);
        const searchParams = new URLSearchParams(params);
        url.search = searchParams.toString();
        return url.toString();
    }

    /**
     * Validates and returns the map type, defaulting to 'roadmap' if invalid.
     *
     * @returns {string} A valid map type ('roadmap' or 'satellite')
     */
    getMapType() {
        const mapTypes = ['roadmap', 'satellite'];
        if (!mapTypes.includes(this.props.maptype)) {
            console.warn(
                `Widget google_map: invalid map type: ${
                    this.props.maptype
                }. Defaulting to 'roadmap'. Valid options are: ${mapTypes.join(', ')}.`
            );
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
     * Toggles the static map image visibility.
     * The image is only rendered (and fetched from Google) while the map is visible,
     * so toggling to hidden avoids unnecessary API requests on subsequent renders.
     */
    toggleMap() {
        this.state.isMapVisible = !this.state.isMapVisible;
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
        zoom: attrs.zoom,
        maptype: attrs.maptype,
        width: attrs.width,
        height: attrs.height,
    }),
};

registry.category('view_widgets').add('google_map', googleMapWidget);
