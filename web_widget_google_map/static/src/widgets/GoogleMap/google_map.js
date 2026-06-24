import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { standardWidgetProps } from '@web/views/widgets/standard_widget_props';
import { rpc } from '@web/core/network/rpc';
import { Component, onWillStart, useRef, useEffect, useState, onWillUnmount, useSubEnv } from '@odoo/owl';

import { ConfirmationDialog } from '@web/core/confirmation_dialog/confirmation_dialog';
import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';

/**
 * Dialog component for editing geolocation coordinates with an interactive Google Map.
 * Allows users to drag a marker to update latitude and longitude values.
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
     * Configures effect hooks for map initialization and cleanup on unmount.
     */
    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.notificationService = useService('notification');
        this.uiService = useService('ui');
        this.googleMap = null;

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
     * Cleans up Google Maps event listeners and marker references to prevent memory leaks.
     * Called automatically when the component is unmounted.
     */
    _cleanupListeners() {
        if (this.marker) {
            if (!this.props.readonly) {
                google.maps.event.clearListeners(this.marker, 'dragend');
            }
            this.marker.map = null;
            this.marker = null;
        }
        if (this.googleMap) {
            google.maps.event.clearListeners(this.googleMap, 'idle');
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
            console.error('Error initializing Google Map:', error);
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
     * @async
     * @param {google.maps.Map} map - The Google Maps instance
     * @returns {Promise<void>}
     */
    async onMapReady(map) {
        await new Promise((resolve) => {
            const listener = map.addListener('tilesloaded', () => {
                google.maps.event.removeListener(listener);
                resolve();
            });
        });
        this.state.isMapReady = true;
        this.renderMarker();
    }

    /**
     * Renders a draggable marker on the map at the current coordinates.
     * The marker can be dragged to update the location (unless readonly is true).
     * Automatically zooms and centers the map if valid coordinates are provided.
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
            this.marker = new AdvancedMarkerElement(markerOptions);
            if (isZoomIn) {
                this.googleMap.panTo({ lat, lng });
            }
            if (!this.props.readonly) {
                this.marker.addListener('dragend', this._handleMarkerDragend.bind(this));
            }
            google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                if (this.googleMap.getZoom() < 16) this.googleMap.setZoom(16);
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
     * @async
     * @returns {Promise<void>}
     */
    async _handleMarkerDragend() {
        const position = this.marker.position;
        this.googleMap.panTo(position);
        this.localLat = position.lat;
        this.localLng = position.lng;
    }
}

/**
 * Widget component that displays a Google Maps embed iframe showing a specific location.
 * Provides an edit button to open an interactive dialog for updating coordinates.
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
     */
    setup() {
        this.validateProps();
        this.settings = {};
        this.dialogService = useService('dialog');
        onWillStart(this.loadGoogleSetting);
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
     * Generates the Google Maps Embed API iframe source URL.
     *
     * @returns {string|boolean} The iframe source URL or false if settings are not available
     */
    get iframeSrc() {
        if (this.settings) {
            return this.generateSrc(this.settings.api_key);
        }
        return false;
    }

    /**
     * Returns the base URL for Google Maps Embed API.
     *
     * @returns {string} The base URL for the embed API
     */
    get baseUrl() {
        return 'https://www.google.com/maps/embed/v1/place';
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
            console.error(e);
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
            console.error(e);
            return 0.0;
        }
    }

    /**
     * Generates the parameters for the Google Maps Embed API URL.
     * Adjusts zoom level based on whether valid coordinates are provided.
     *
     * @returns {Object} An object containing query parameters (q, zoom, maptype)
     */
    get params() {
        const lat = this.latitude;
        const lng = this.longitude;
        const maptype = this.getMapType();
        let zoom = this.props.zoom;
        if (lat === 0.0 && lng === 0.0) {
            zoom = 3;
        }
        return {
            q: `${lat},${lng}`,
            zoom,
            maptype,
        };
    }

    /**
     * Generates the complete Google Maps Embed API iframe source URL.
     *
     * @param {string} api_key - The Google Maps API key
     * @returns {string} The complete iframe source URL with all parameters
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
        if (
            !this.props.record.fields[this.props.lat] ||
            !this.props.record.fields[this.props.lng]
        ) {
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
