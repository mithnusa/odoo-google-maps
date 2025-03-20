import { Component, onWillDestroy } from '@odoo/owl';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { LOADER_STATUS, useGoogleMapsAPILoader } from './loader_google_map';

export class BaseGoogleMapComponent extends Component {
    setup() {
        this.googleMap = null;
        this.notificationService = useService('notification');
        this.uiService = useService('ui');
        this.apiLoader = useGoogleMapsAPILoader(
            (...args) => this.onGoogleMapsApiLoad(...args),
            (...args) => this.onGoogleMapsApiError(...args)
        );
        // Clean up resources when component is destroyed
        onWillDestroy(this._onWillDestroy);
    }

    /**
     * Returns the DOM element where the map should be rendered
     * Must be implemented by child classes
     * @returns {HTMLElement|false} DOM element where the map should be rendered
     */
    mapDivElement() {
        console.warn('mapDivElement() must be implemented by child classes');
        return false;
    }

    /**
     * Update state for Google Maps Loader
     * Must be implemented by child classes
     * @param {string} status - The loader status from LOADER_STATUS enum
     */
    updateLoaderState(status) {
        console.warn('updateLoaderState() must be implemented by child classes');
    }

    /**
     * Handle Google Maps API load success
     */
    async onGoogleMapsApiLoad() {
        const mapEl = this.mapDivElement();
        if (!mapEl) {
            this.notificationService.add(_t('Please specify the element for Google Maps'), {
                title: _t('Google Maps Error'),
                type: 'danger',
            });
            return;
        }
        try {
            // Validate required settings
            const { map_id, color_scheme } = this.apiLoader.__settings;
            if (!map_id) {
                this.notificationService.add(
                    _t('Missing Map ID. Map ID is required to load Google Maps'),
                    {
                        title: _t('Google Maps Warning'),
                        type: 'danger',
                    }
                );
            }
            const { Map } = await this.apiLoader.importLibrary('maps');
            const { ColorScheme } = await this.apiLoader.importLibrary('core');

            // Map color scheme options
            const schemes = {
                dark: ColorScheme.DARK,
                light: ColorScheme.LIGHT,
                system: ColorScheme.FOLLOW_SYSTEM,
            };

            // Get map options from props or use defaults
            const mapOptions = this._prepareMapOptions({
                center: { lat: 0, lng: 0 },
                zoom: 2,
                mapId: map_id,
                colorScheme: schemes[color_scheme] || ColorScheme.LIGHT,
            });

            // Create map with proper options
            const googleMap = new Map(mapEl, mapOptions);
            this.googleMap = googleMap;
            // Set as loaded
            this.updateLoaderState(LOADER_STATUS.LOADED);
            // Trigger map ready callback
            this.onMapReady(googleMap);
        } catch (error) {
            this.onGoogleMapsApiError(error);
        }
    }

    /**
     * Handle Google Maps API load error
     * @private
     * @param {Error} error - The error that occurred
     */
    onGoogleMapsApiError(error) {
        this.updateLoaderState(LOADER_STATUS.FAILED);

        // Log detailed error for debugging
        console.error('Google Maps API loading failed:', error);

        // Display user-friendly notification based on error type
        let errorMessage = _t(
            'Failed to load Google Maps. Please check your internet connection or API key configuration. You might check the Javascript console for more details.'
        );

        if (error.code === 'INVALID_API_KEY') {
            errorMessage = _t('Invalid Google Maps API key. Please check your configuration.');
        } else if (error.code === 'NETWORK_ERROR') {
            errorMessage = _t(
                'Network error while loading Google Maps. Please check your connection.'
            );
        }

        this.notificationService.add(errorMessage, {
            title: _t('Google Maps Error'),
            type: 'danger',
            sticky: true,
        });
    }

    /**
     * Prepares map options by merging defaults with provided options
     * @private
     * @param {Object} options - Map options
     * @returns {Object} Final map options
     */
    _prepareMapOptions(options) {
        return options;
    }

    /**
     * Called when map is successfully initialized
     * Can be overridden by child classes
     * @private
     * @param {google.maps.Map} map - The initialized Google Map instance
     */
    onMapReady(map) {
        // To be implemented by child classes if needed
    }

    /**
     * Clean up resources when component is destroyed
     */
    _onWillDestroy() {
        if (this.googleMap) {
            // Clean up any listeners or resources
            this.googleMap = null;
        }
    }

    /**
     * Check if the Google Maps API is loaded and ready
     * @returns {boolean} True if the map is loaded
     */
    isMapLoaded() {
        console.warn('isMapLoaded() must be implemented by child classes');
        return false;
    }

    /**
     * Generate a unique ID
     * @private
     * @returns {string} Unique identifier
     */
    _generateUniqueId() {
        return `gmaps_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
}
