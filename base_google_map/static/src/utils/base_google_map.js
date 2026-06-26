import { Component, onWillDestroy, onMounted, useState, useEffect } from '@odoo/owl';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { LOADER_STATUS, LOADER_ERROR_TYPES, useGoogleMapsAPILoader } from './loader_google_map';

// Constants for validation and configuration
export const MAX_ZOOM_LEVEL = 23;
export const MIN_ZOOM_LEVEL = 1;
export const VALID_LAT_RANGE = [-90, 90];
export const VALID_LNG_RANGE = [-180, 180];
export const RESIZE_DEBOUNCE_DELAY = 250;
export const MAP_LOAD_TIMEOUT = 30000;

// Accessibility constants
export const A11Y_LABELS = {
    MAP_CONTAINER: 'Interactive map',
    LOADING: 'Map is loading',
    ERROR: 'Map failed to load',
    READY: 'Map is ready for interaction',
};

export class BaseGoogleMapComponent extends Component {
    setup() {
        this.errorMessage = '';

        // Core properties
        this.googleMap = null;
        this.resizeObserver = null;
        this.loadTimeout = null;
        this._isComponentDestroyed = false;

        this._destroyResolve = null;
        this._destroyPromise = new Promise((resolve) => {
            this._destroyResolve = resolve;
        });

        // Map State — declared first so all hooks below can safely reference this.state
        this.state = useState({
            isMapReady: null,
            loaderStatus: LOADER_STATUS.NOT_LOADED,
            isLoading: null,
            isOffline: false,
            isError: false,
        });

        // Services
        this.notificationService = useService('notification');
        this.uiService = useService('ui');

        // Google Maps API Loader
        this.apiLoader = useGoogleMapsAPILoader(
            (...args) => this.handleOnApiLoaderSuccess(...args),
            (...args) => this.handleOnApiLoaderError(...args)
        );

        // Lifecycle hooks
        onMounted(() => this._onMounted());
        onWillDestroy(() => this._cleanUp());

        useEffect(
            (mapEl, loaderStatus) => {
                this.handleApiLoaderUseEffect(mapEl, loaderStatus);
            },
            () => [this.mapDivElement(), this.state.loaderStatus]
        );

        // Network status detection
        this._setupNetworkDetection();
    }

    handleOnApiLoaderSuccess() {
        this.state.loaderStatus = LOADER_STATUS.LOADED;
    }

    handleOnApiLoaderError(error) {
        this.state.loaderStatus = LOADER_STATUS.FAILED;
        this.onGoogleMapsApiError(error);
    }

    handleApiLoaderUseEffect(mapEl, loaderStatus) {
        if (mapEl && loaderStatus === LOADER_STATUS.LOADED) {
            this.onGoogleMapsApiLoad();
        }
    }

    /**
     * Returns the DOM element where the map should be rendered
     * Must be implemented by child classes
     * @abstract
     * @returns {HTMLElement} DOM element where the map should be rendered
     * @throws {Error} If not implemented by child class
     */
    mapDivElement() {
        throw new Error('mapDivElement() must be implemented by child classes');
    }

    /**
     * Update state for Google Maps Loader
     * Can be overridden by child classes for custom behavior
     * @param {string} status - The loader status from LOADER_STATUS enum
     */
    updateLoaderState(status) {
        const isMapReady = this.isMapLoaded();
        const values = { isMapReady };
        if (status) {
            values.loaderStatus = status;
            values.isError = [LOADER_STATUS.FAILED, LOADER_STATUS.AUTH_FAILURE, LOADER_STATUS.NETWORK_ERROR].includes(
                status
            );
        }

        // Update ARIA attributes for accessibility
        this._updateA11yAttributes(status);
        // Notify child classes of state change
        this.handleOnStateChange(values);
    }

    handleOnStateChange(state) {
        // Override in child classes if needed
        // This is an optional hook for child classes
        if (state.hasOwnProperty('loaderStatus')) {
            this.state.loaderStatus = state.loaderStatus;
        }
        if (state.hasOwnProperty('isMapReady')) {
            this.state.isMapReady = state.isMapReady;
        }
        if (state.hasOwnProperty('isLoading')) {
            this.state.isLoading = state.isLoading;
        }
        if (state.hasOwnProperty('isError')) {
            this.state.isError = state.isError;
        }
        if (state.hasOwnProperty('isOffline')) {
            this.state.isOffline = state.isOffline;
        }
    }

    /**
     * Handle Google Maps API load success
     */
    async onGoogleMapsApiLoad() {
        // Clear any existing timeout
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        try {
            const mapEl = this.mapDivElement();
            if (!mapEl) {
                throw new Error('Map container element not found');
            }

            // Validate and prepare settings
            const settings = this._validateAndPrepareSettings();

            // Load required libraries — overall timeout is handled by _onMounted's loadTimeout
            const [, { ColorScheme }] = await Promise.all([
                this.apiLoader.importLibrary('maps'),
                this.apiLoader.importLibrary('core'),
            ]);

            // Prepare map options with validation
            const mapOptions = this._prepareMapOptions({
                center: settings.center,
                zoom: settings.zoom,
                mapId: settings.map_id,
                colorScheme: this._getColorScheme(ColorScheme, settings.color_scheme),
                // Accessibility improvements
                gestureHandling: 'auto',
                keyboardShortcuts: true,
                // Performance optimizations
                disableDefaultUI: false,
            });

            // Create and initialize map
            const googleMap = await this.initializeGoogleMap(mapEl, mapOptions);

            // Setup resize observer for responsive behavior
            this._setupResizeObserver(mapEl);
            // Setup accessibility features
            this._setupAccessibility(mapEl);

            // Trigger map ready callback
            await this.onMapReady(googleMap);
            // Update loader state
            this.updateLoaderState(this.state.loaderStatus);
        } catch (error) {
            this.onGoogleMapsApiError(error);
        }
    }

    /**
     * Initialize Google Map instance
     * Can be overridden by child classes for custom initialization
     * @protected
     * @param {*} mapEl
     * @param {*} options
     * @returns Google Maps instance
     */
    async initializeGoogleMap(mapEl, options) {
        const { Map } = await this.apiLoader.importLibrary('maps');
        const googleMap = new Map(mapEl, options);
        this.googleMap = googleMap;
        return googleMap;
    }

    /**
     * Handle Google Maps API load error with enhanced categorization
     * @private
     * @param {Error} error - The error that occurred
     */
    onGoogleMapsApiError(error) {
        // Clear timeout if active
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        // Determine error type and appropriate status
        const errorType = this._categorizeError(error);
        const status = this._getStatusFromErrorType(errorType);

        this.updateLoaderState(status);

        // Log detailed error for debugging
        console.error('Google Maps API loading failed:', {
            error,
            type: errorType,
            message: error.message,
            stack: error.stack,
        });

        // Update state with error information
        this.errorMessage = this._getUserFriendlyErrorMessage(errorType, error);

        // Display notification with retry option for certain errors
        const shouldShowRetry = this._shouldShowRetryOption(errorType);

        this.notificationService.add(this.errorMessage, {
            type: 'danger',
            sticky: true,
            buttons: shouldShowRetry
                ? [
                      {
                          name: _t('Retry'),
                          primary: true,
                          onClick: () => this._retryMapLoad(),
                      },
                  ]
                : undefined,
        });

        // Setup accessibility for error state
        this._updateA11yForError();
    }

    /**
     * Prepares and validates map options by merging defaults with provided options
     * @private
     * @param {Object} options - Map options
     * @returns {Object} Final validated map options
     */
    _prepareMapOptions(options = {}) {
        // Validate and sanitize coordinates
        const center = this._validateCoordinates(options.center);
        const zoom = this._validateZoom(options.zoom);

        // Merge with defaults and custom options
        const defaultOptions = {
            center,
            zoom,
            gestureHandling: 'auto',
            keyboardShortcuts: true,
            // Accessibility
            clickableIcons: true,
            // Scale control
            scaleControl: true,
        };

        const values = {
            ...defaultOptions,
            ...options,
            // Ensure validated values are not overridden
            center,
            zoom,
        };

        // Gesture handling
        const gestureHandling = this.props.archInfo?.gestureHandling || 'auto';
        values.gestureHandling = gestureHandling;

        // Map type
        const mapType = (this.props.archInfo?.mapType || 'roadmap').toUpperCase();
        if (mapType && google.maps.MapTypeId[mapType]) {
            values.mapTypeId = google.maps.MapTypeId[mapType];
        } else {
            console.warn('Unrecognized map type ' + mapType + ', defaulting to ROADMAP');
            values.mapTypeId = google.maps.MapTypeId.ROADMAP;
        }

        // Map Id
        // Prioritize mapId from props.archInfo if available, otherwise use from options
        // Only override if props has a mapId, otherwise keep the one from options
        const mapId = this.props.archInfo?.mapId || null;
        if (mapId) {
            values.mapId = mapId;
        }

        // Security
        const restriction = this._getMapRestrictions();
        if (restriction) {
            values.restriction = restriction;
        }

        // Allow child classes to override via getMapOptions method
        const childOptions = typeof this.getMapOptions === 'function' ? this.getMapOptions() : {};
        if (childOptions && typeof childOptions === 'object') {
            Object.assign(values, childOptions);
        }

        return values;
    }

    /**
     * Called when map is successfully initialized
     * Can be overridden by child classes
     * @param {google.maps.Map} map - The initialized Google Map instance
     * @returns {Promise<void>} Promise that resolves when ready setup is complete
     */
    async onMapReady(map) {
        // Race tilesloaded against component destruction. _cleanUp() calls
        // clearInstanceListeners() which removes the tilesloaded listener,
        // so without the race the promise would hang indefinitely after teardown.
        const tilesLoaded = new Promise((resolve) => {
            google.maps.event.addListenerOnce(map, 'tilesloaded', resolve);
        });
        await Promise.race([tilesLoaded, this._destroyPromise]);

        if (!this._isComponentDestroyed) {
            // Map is ready for interaction
            this.state.isMapReady = true;
        }
    }

    /**
     * Component mounted lifecycle
     * @private
     */
    _onMounted() {
        // Set up loading timeout
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        this.loadTimeout = setTimeout(() => {
            if (!this.isMapLoaded()) {
                this.onGoogleMapsApiError(new Error('Map loading timeout'));
            }
        }, MAP_LOAD_TIMEOUT);
    }

    _cleanUp() {
        this._isComponentDestroyed = true;
        if (this._destroyResolve) {
            this._destroyResolve();
            this._destroyResolve = null;
        }
        this._destroyPromise = null;

        // Clear timeouts
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }

        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Clean up network listeners
        this._cleanupNetworkDetection();

        // Clean up API loader listener
        if (this.apiLoader && typeof this.apiLoader.removeListener === 'function') {
            this.apiLoader.removeListener();
        }

        // Clean up map instance
        if (this.googleMap) {
            // Remove all map listeners
            google.maps.event.clearInstanceListeners(this.googleMap);
            this.googleMap = null;
        }
    }

    /**
     * Check if the Google Maps API is loaded and ready
     * @returns {boolean} True if the map is loaded and ready
     */
    isMapLoaded() {
        return this.googleMap !== null && this.state.isMapReady && this.state.loaderStatus === LOADER_STATUS.LOADED;
    }

    /**
     * Check if the component is currently loading
     * @returns {boolean} True if loading
     */
    isCurrentlyLoading() {
        return this.state.isLoading;
    }

    /**
     * Check if there's an error state
     * @returns {boolean} True if there's an error
     */
    hasError() {
        return this.state.isError;
    }

    /**
     * Get the current error message
     * @returns {string} Current error message
     */
    getErrorMessage() {
        return this.errorMessage;
    }

    // === VALIDATION METHODS ===

    /**
     * Validate and sanitize coordinates
     * @private
     * @param {Object} coords - Coordinates object with lat/lng
     * @returns {Object} Validated coordinates
     */
    _validateCoordinates(coords) {
        const lat = parseFloat(coords?.lat || 0);
        const lng = parseFloat(coords?.lng || 0);

        return {
            lat: Math.max(VALID_LAT_RANGE[0], Math.min(VALID_LAT_RANGE[1], lat)),
            lng: Math.max(VALID_LNG_RANGE[0], Math.min(VALID_LNG_RANGE[1], lng)),
        };
    }

    /**
     * Validate zoom level
     * @private
     * @param {number} zoom - Zoom level
     * @returns {number} Validated zoom level
     */
    _validateZoom(zoom) {
        const z = parseInt(zoom) || 2;
        return Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, z));
    }

    /**
     * Validate and prepare settings
     * @private
     * @returns {Object} Validated settings
     */
    _validateAndPrepareSettings() {
        const settings = this.apiLoader.getSettings();

        if (!settings.key) {
            throw new Error('Google Maps API key is required');
        }

        if (!settings.map_id) {
            this.notificationService.add(_t('Missing Map ID. Some features may not work properly.'), {
                type: 'warning',
            });
        }

        return settings;
    }

    // === ERROR HANDLING METHODS ===

    /**
     * Categorize error type
     * @private
     * @param {Error} error - Error to categorize
     * @returns {string} Error type
     */
    _categorizeError(error) {
        const message = error.message.toLowerCase();

        if (message.includes('auth') || message.includes('api key')) {
            return LOADER_ERROR_TYPES.AUTH;
        }
        if (message.includes('network') || message.includes('connection')) {
            return LOADER_ERROR_TYPES.NETWORK;
        }
        if (message.includes('timeout')) {
            return LOADER_ERROR_TYPES.TIMEOUT;
        }
        return LOADER_ERROR_TYPES.SCRIPT;
    }

    /**
     * Get status from error type
     * @private
     * @param {string} errorType - Error type
     * @returns {string} Loader status
     */
    _getStatusFromErrorType(errorType) {
        switch (errorType) {
            case LOADER_ERROR_TYPES.AUTH:
                return LOADER_STATUS.AUTH_FAILURE;
            case LOADER_ERROR_TYPES.NETWORK:
                return LOADER_STATUS.NETWORK_ERROR;
            case LOADER_ERROR_TYPES.TIMEOUT:
                return LOADER_STATUS.TIMEOUT;
            default:
                return LOADER_STATUS.FAILED;
        }
    }

    /**
     * Get user-friendly error message
     * @private
     * @param {string} errorType - Error type
     * @param {Error} error - Original error
     * @returns {string} User-friendly message
     */
    _getUserFriendlyErrorMessage(errorType, error) {
        switch (errorType) {
            case LOADER_ERROR_TYPES.AUTH:
                return _t('Invalid Google Maps API key. Please check your configuration.');
            case LOADER_ERROR_TYPES.NETWORK:
                return _t('Network error while loading Google Maps. Please check your connection.');
            case LOADER_ERROR_TYPES.TIMEOUT:
                return _t('Google Maps loading timed out. Please try again.');
            default:
                return _t('Failed to load Google Maps. Please refresh the page or contact support.');
        }
    }

    /**
     * Check if retry option should be shown
     * @private
     * @param {string} errorType - Error type
     * @returns {boolean} Whether to show retry
     */
    _shouldShowRetryOption(errorType) {
        return [LOADER_ERROR_TYPES.NETWORK, LOADER_ERROR_TYPES.TIMEOUT].includes(errorType);
    }

    // === ACCESSIBILITY METHODS ===

    /**
     * Update accessibility attributes based on status
     * @private
     * @param {string} status - Current loader status
     */
    _updateA11yAttributes(status) {
        try {
            const mapEl = this.mapDivElement();
            if (!mapEl) return;

            mapEl.setAttribute('role', 'application');
            mapEl.setAttribute('aria-label', A11Y_LABELS.MAP_CONTAINER);

            switch (status) {
                case LOADER_STATUS.LOADING:
                    mapEl.setAttribute('aria-busy', 'true');
                    mapEl.setAttribute('aria-live', 'polite');
                    mapEl.setAttribute('aria-describedby', A11Y_LABELS.LOADING);
                    break;
                case LOADER_STATUS.LOADED:
                    mapEl.setAttribute('aria-busy', 'false');
                    mapEl.setAttribute('aria-describedby', A11Y_LABELS.READY);
                    mapEl.removeAttribute('aria-live');
                    break;
                default:
                    mapEl.setAttribute('aria-busy', 'false');
                    mapEl.setAttribute('aria-describedby', A11Y_LABELS.ERROR);
                    mapEl.setAttribute('aria-live', 'assertive');
            }
        } catch (e) {
            // Ignore errors if mapDivElement throws (component may be destroyed)
        }
    }

    /**
     * Setup comprehensive accessibility features
     * @private
     * @param {HTMLElement} mapEl - Map container element
     */
    _setupAccessibility(mapEl) {
        mapEl.setAttribute('tabindex', '0');
        mapEl.setAttribute('role', 'application');
        mapEl.setAttribute('aria-label', A11Y_LABELS.MAP_CONTAINER);

        // Guard: only append once — _setupAccessibility can be called again on retry
        if (!mapEl.querySelector('[data-role="gmap-hint"]')) {
            const helpText = document.createElement('div');
            helpText.setAttribute('data-role', 'gmap-hint');
            helpText.className = 'sr-only';
            helpText.textContent = _t('Use arrow keys to pan, plus/minus to zoom');
            mapEl.appendChild(helpText);
        }
    }

    /**
     * Update accessibility for error state
     * @private
     */
    _updateA11yForError() {
        try {
            const mapEl = this.mapDivElement();
            if (!mapEl) return;

            mapEl.setAttribute('aria-live', 'assertive');

            // aria-describedby must reference an element ID, not raw text
            let errorEl = mapEl.querySelector('[data-role="gmap-error-msg"]');
            if (!errorEl) {
                errorEl = document.createElement('div');
                errorEl.id = 'gmap-error-msg';
                errorEl.setAttribute('data-role', 'gmap-error-msg');
                errorEl.className = 'sr-only';
                mapEl.appendChild(errorEl);
            }
            errorEl.textContent = this.errorMessage;
            mapEl.setAttribute('aria-describedby', errorEl.id);
        } catch (e) {
            // Ignore if mapDivElement throws (component may be destroyed)
        }
    }

    // === PERFORMANCE AND RESPONSIVE METHODS ===

    /**
     * Setup resize observer for responsive behavior
     * @private
     * @param {HTMLElement} mapEl - Map container element
     */
    _setupResizeObserver(mapEl) {
        if (!ResizeObserver || !this.googleMap) return;

        let resizeTimeout;
        this.resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.googleMap) {
                    google.maps.event.trigger(this.googleMap, 'resize');
                }
            }, RESIZE_DEBOUNCE_DELAY);
        });

        this.resizeObserver.observe(mapEl);
    }

    // === NETWORK AND OFFLINE METHODS ===

    /**
     * Setup network detection
     * @private
     */
    _setupNetworkDetection() {
        this._onOnline = () => {
            this.state.isOffline = false;
            if (this.state.isError && !this.isMapLoaded()) {
                this._retryMapLoad();
            }
            this._notifyStateChange({ isOffline: false });
        };

        this._onOffline = () => {
            this.state.isOffline = true;
            this._notifyStateChange({ isOffline: true });
        };

        window.addEventListener('online', this._onOnline);
        window.addEventListener('offline', this._onOffline);

        // Initial state
        this.state.isOffline = !navigator.onLine;
    }

    /**
     * Cleanup network detection
     * @private
     */
    _cleanupNetworkDetection() {
        if (this._onOnline) {
            window.removeEventListener('online', this._onOnline);
            this._onOnline = null;
        }
        if (this._onOffline) {
            window.removeEventListener('offline', this._onOffline);
            this._onOffline = null;
        }
    }

    // === UTILITY METHODS ===

    /**
     * Get color scheme based on settings
     * @private
     * @param {Object} ColorScheme - Google Maps ColorScheme enum
     * @param {string} scheme - Color scheme setting
     * @returns {*} ColorScheme value
     */
    _getColorScheme(ColorScheme, scheme) {
        const schemes = {
            dark: ColorScheme.DARK,
            light: ColorScheme.LIGHT,
            system: ColorScheme.FOLLOW_SYSTEM,
        };
        return schemes[scheme] || ColorScheme.LIGHT;
    }

    /**
     * Notify network state change. Override in child classes to react.
     * @protected
     * @param {Object} changes - The properties that changed
     * @param {boolean} changes.isOffline - Whether the device is currently offline
     */
    _notifyStateChange(changes = {}) {}

    /**
     * Get map restrictions for security
     * @private
     * @returns {Object|null} Map restrictions
     */
    _getMapRestrictions() {
        // Override in child classes if needed
        return null;
    }

    /**
     * Retry map loading
     * @private
     */
    async _retryMapLoad() {
        this.errorMessage = '';
        // reset state
        this.handleOnStateChange({
            isLoading: true,
            isError: false,
            isOffline: !navigator.onLine,
            isMapReady: false,
        });

        try {
            await this.onGoogleMapsApiLoad();
        } catch (error) {
            this.onGoogleMapsApiError(error);
        }
    }
}
