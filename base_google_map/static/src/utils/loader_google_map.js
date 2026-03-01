/**
 * @fileoverview Google Maps API loader for Odoo with advanced features.
 *
 * This module provides a robust solution for loading and managing the Google Maps JavaScript API
 * in Odoo applications. It includes:
 * - Automatic settings fetch from Odoo backend
 * - Promise-based loading with retry logic
 * - Caching and deduplication to prevent redundant requests
 * - Status tracking and error handling
 * - OWL component integration hooks
 *
 * @module base_google_map/utils/loader_google_map
 */

import { onWillStart, onWillUnmount } from '@odoo/owl';
import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";

/**
 * Default solution channel identifier for Google Maps API usage analytics.
 * Used to track that the API is being used via Odoo addons.
 * @constant {string}
 */
const DEFAULT_SOLUTION_CHANNEL = 'GMP_Odoo_Addons_v1';

/**
 * Debounce delay in milliseconds for status change notifications.
 * Prevents excessive listener callbacks during rapid status changes.
 * @constant {number}
 */
const DEBOUNCE_DELAY = 16;

/**
 * Network request timeout in milliseconds.
 * Applied to RPC calls and Google Maps API script loading.
 * @constant {number}
 */
const NETWORK_TIMEOUT = 10000;

/**
 * Maximum number of retry attempts for failed requests.
 * Retry delays use exponential backoff: 1s, 2s, 4s, etc.
 * @constant {number}
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Regular expression for validating URL characters.
 * Used for security validation of URL-like parameters.
 * @constant {RegExp}
 */
const ALLOWED_URL_CHARS = /^[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]+$/;

/**
 * Regular expression for detecting dangerous characters in user input.
 * Used to sanitize parameters before passing to Google Maps API.
 * @constant {RegExp}
 */
const DANGEROUS_CHARS = /[<>"'&]/g;

/**
 * Enumeration of possible loader states.
 * Used to track the current status of the Google Maps API loading process.
 *
 * @enum {string}
 * @readonly
 * @property {string} NOT_LOADED - API has not been loaded yet
 * @property {string} LOADING - API is currently loading
 * @property {string} LOADED - API loaded successfully and ready to use
 * @property {string} FAILED - API loading failed due to an error
 * @property {string} AUTH_FAILURE - API loading failed due to authentication error
 * @property {string} NETWORK_ERROR - API loading failed due to network error
 * @property {string} TIMEOUT - API loading timed out
 */
export const LOADER_STATUS = {
    NOT_LOADED: 'NOT_LOADED',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    FAILED: 'FAILED',
    AUTH_FAILURE: 'AUTH_FAILURE',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
};

/**
 * Enumeration of error types that can occur during loading.
 * Used for error categorization and handling.
 *
 * @enum {string}
 * @readonly
 * @property {string} VALIDATION - Validation error (invalid parameters)
 * @property {string} NETWORK - Network-related error
 * @property {string} AUTH - Authentication/authorization error
 * @property {string} TIMEOUT - Request timeout error
 * @property {string} SCRIPT - Script loading error
 */
export const LOADER_ERROR_TYPES = {
    VALIDATION: 'VALIDATION_ERROR',
    NETWORK: 'NETWORK_ERROR',
    AUTH: 'AUTH_ERROR',
    TIMEOUT: 'TIMEOUT_ERROR',
    SCRIPT: 'SCRIPT_ERROR',
};

export class GoogleMapsAPILoader {
    static loadingStatus = LOADER_STATUS.NOT_LOADED;
    static serializedApiParams = null;
    static listeners = [];
    static scriptLoaded = false;
    static loadPromise = null;
    static retryCount = 0;
    static _notifyTimeout = null;
    static isDebugMode = false;

    /**
     * Debounced notification of loading status changes
     */
    static notifyLoadingStatusListeners() {
        if (this._notifyTimeout) {
            clearTimeout(this._notifyTimeout);
        }
        this._notifyTimeout = setTimeout(() => {
            this.listeners.forEach(listener => {
                try {
                    listener(this.loadingStatus);
                } catch (error) {
                    console.error('Error in status listener:', error);
                }
            });
        }, DEBOUNCE_DELAY);
    }

    /**
     * Validates and serializes API parameters
     * @param {Object} params - API parameters
     * @returns {string} Serialized parameters
     */
    static serializedParams(params) {
        this.validateParams(params);
        return JSON.stringify(params, Object.keys(params).sort());
    }

    /**
     * Validates required API parameters
     * @param {Object} params - Parameters to validate
     */
    static validateParams(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid parameters: must be an object');
        }
        
        const required = ['key'];
        const missing = required.filter(key => !params[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required parameters: ${missing.join(', ')}`);
        }
        
        // Validate API key format
        if (typeof params.key !== 'string' || params.key.length < 10) {
            throw new Error('Invalid API key format');
        }
    }

    /**
     * Loads the Google Maps API with proper error handling and retry logic
     * @param {Object} params - API parameters
     * @param {Function} onLoadingStatusChangeFn - Status change callback
     */
    static async load(params, onLoadingStatusChangeFn) {
        // Return existing promise if already loading
        if (this.loadPromise) {
            this.addListener(onLoadingStatusChangeFn);
            return this.loadPromise;
        }
        this.loadPromise = this._performLoad(params, onLoadingStatusChangeFn);
        return this.loadPromise;
    }

    static async _performLoad(params, onLoadingStatusChangeFn) {
        try {
            const serializedParams = this.serializedParams(params);
            this.addListener(onLoadingStatusChangeFn);
            
            if (window.google?.maps?.importLibrary === undefined) {
                if (!this.serializedApiParams) {
                    this.serializedApiParams = serializedParams;
                }
                this.loadingStatus = LOADER_STATUS.LOADING;
                this.notifyLoadingStatusListeners();
                
                await this._initImportLibraryWithRetry(params);
                
                this.loadingStatus = LOADER_STATUS.LOADED;
                this.notifyLoadingStatusListeners();
                this.retryCount = 0;
            } else {
                this.loadingStatus = LOADER_STATUS.LOADED;
                this.notifyLoadingStatusListeners();
            }

            if (this.serializedApiParams && this.serializedApiParams !== serializedParams) {
                console.warn(
                    '[google-maps-api-loader-internal]: The Google Maps API is already loaded with different parameters'
                );
            }
        } catch (error) {
            this._handleLoadError(error);
            throw error;
        } finally {
            this.loadPromise = null;
        }
    }

    /**
     * Handles loading errors with proper categorization
     * @param {Error} error - The error to handle
     */
    static _handleLoadError(error) {
        if (this.isDebugMode) {
            console.error('Google Maps API load error:', error);
        }
        
        if (error.type === LOADER_ERROR_TYPES.AUTH || error.name === 'AuthError') {
            this.loadingStatus = LOADER_STATUS.AUTH_FAILURE;
        } else if (error.message.includes('timeout') || error.message.includes('network')) {
            this.loadingStatus = LOADER_STATUS.NETWORK_ERROR;
        } else {
            this.loadingStatus = LOADER_STATUS.FAILED;
        }
        
        this.notifyLoadingStatusListeners();
    }

    /**
     * Enhanced parameter sanitization
     * @param {Object} params - Parameters to sanitize
     * @returns {Object} Sanitized parameters
     */
    static sanitizeParams(params) {
        return Object.fromEntries(
            Object.entries(params).map(([key, value]) => {
                if (typeof value === 'string') {
                    // Remove dangerous characters
                    let sanitized = value.replace(DANGEROUS_CHARS, '');
                    // Validate URL format for URL-like parameters
                    if (['callback', 'libraries'].includes(key)) {
                        if (!ALLOWED_URL_CHARS.test(sanitized)) {
                            console.warn(`Invalid characters in parameter ${key}:`, value);
                            sanitized = sanitized.replace(/[^a-zA-Z0-9.,_-]/g, '');
                        }
                    }
                    return [key, sanitized];
                }
                return [key, value];
            })
        );
    }

    static loadGoogle(params) {
        const sanitizedParams = this.sanitizeParams(params);
        (g => {
            var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
            b = b[c] || (b[c] = {});
            var d = (b.maps || (b.maps = {})), r = new Set(), e = new URLSearchParams(), u = () => h || (h = new Promise((f, n) => {
                a = m.createElement("script");
                e.set("libraries", [...r] + "");
                for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]);
                e.set("callback", c + ".maps." + q);
                a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
                d[q] = f;
                a.onerror = () => h = n(Error(p + " could not load."));
                a.nonce = m.querySelector("script[nonce]")?.nonce || "";
                m.head.append(a);
            }));
            d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n));
        })(sanitizedParams);
    }

    /**
     * Initialize import library with retry logic
     * @param {Object} params - API parameters
     */
    static async _initImportLibraryWithRetry(params) {
        for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                await this._initImportLibrary(params);
                return;
            } catch (error) {
                if (attempt === MAX_RETRY_ATTEMPTS) {
                    throw error;
                }
                
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.warn(`Google Maps API load attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Initialize the Google Maps import library
     * @param {Object} params - API parameters
     */
    static async _initImportLibrary(params) {
        if (!window.google) window.google = {};
        if (!window.google.maps) window.google.maps = {};

        if (window.google?.maps?.importLibrary === undefined) {
            const settings = {...params};
            delete settings.status;
            delete settings.theme;
            
            // Add timeout to script loading
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Script loading timeout')), NETWORK_TIMEOUT);
            });
            
            const loadPromise = new Promise((resolve) => {
                this.loadGoogle(settings);
                // Wait for the script to be ready
                const checkReady = () => {
                    if (window.google?.maps?.importLibrary) {
                        resolve();
                    } else {
                        setTimeout(checkReady, 100);
                    }
                };
                checkReady();
            });
            
            await Promise.race([loadPromise, timeoutPromise]);
        }
    }

    /**
     * Add listener with duplicate check
     * @param {Function} listener - Status change listener
     */
    static addListener(listener) {
        if (listener && !this.listeners.includes(listener)) {
            this.listeners.push(listener);
        }
    }

    /**
     * Remove specific listener
     * @param {Function} listener - Listener to remove
     */
    static removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Enable debug mode for detailed logging
     * @param {boolean} enabled - Whether to enable debug mode
     */
    static setDebugMode(enabled) {
        this.isDebugMode = enabled;
    }
}


/**
 * Prepares and transforms Google Maps API settings from Odoo backend format to Google Maps API format.
 *
 * Transforms the settings received from the Odoo backend into the format expected by the
 * Google Maps JavaScript API. Handles default values, validation, and field name mapping.
 *
 * @param {Object} params - Raw settings from the Odoo backend
 * @param {string} params.api_key - Google Maps API key (required)
 * @param {string} [params.map_id] - Google Maps Map ID for advanced features
 * @param {string} [params.version='beta'] - Google Maps API version (e.g., 'weekly', 'quarterly', 'beta')
 * @param {string} [params.region='US'] - Region localization code
 * @param {string} [params.language='en_US'] - Language code for map labels and controls
 * @param {number} [params.channel] - Optional channel number (0-999) for usage tracking
 * @param {string} [params.solution_channel] - Solution channel identifier for analytics
 * @param {string} [params.color_scheme='light'] - Color scheme ('light' or 'dark')
 * @param {boolean} [params.is_places_search_enable=false] - Enable in-map place search
 * @param {boolean} [params.restrict_language=false] - Restrict results to specified language
 * @param {boolean} [params.autocomplete_restrict_country=false] - Enable country restrictions for autocomplete
 * @param {Array<string>} [params.autocomplete_list_countries_restriction=[]] - List of country codes for autocomplete restrictions
 * @param {string} [params.auth_referrer_policy] - Referrer policy for API requests
 * @returns {Object} Settings object formatted for Google Maps API
 *
 * @example
 * const settings = prepareSettingValues({
 *   api_key: 'AIza...',
 *   version: 'weekly',
 * });
 * // Returns: { key: 'AIza...', v: 'weekly', ... }
 */
function prepareSettingValues(params) {
    const settings = {};
    // API Key - Required for Google Maps API authentication
    settings.key = params.api_key;
    // Map ID - Required for advanced map features (3D, Cloud styling, etc.)
    settings.map_id = params.map_id;
    // Version - API release channel
    settings.v = params.version || 'beta';
    // Region - Affects geocoding results and map behavior
    settings.region = params.region || 'US';
    // Language - UI and label translations
    settings.language = params.language || 'en_US';
    // Channel - Optional numeric identifier for usage analytics (0-999)
    if (params.channel === undefined || params.channel < 0 || params.channel > 999) {
        delete settings.channel;
    }
    // Solution Channel - Identifier for tracking specific implementations
    if (params.solution_channel === undefined) {
        settings.solutionChannel = DEFAULT_SOLUTION_CHANNEL;
    } else if (params.solution_channel === null || params.solution_channel === '') {
        delete settings.solutionChannel;
    }
    // Color scheme - Visual theme for map UI
    settings.color_scheme = params.color_scheme || 'light';
    // In Map Place Search - Enable/disable place search within map view
    settings.in_map_place_search = params.is_places_search_enable || false;
    // Restrict Language - Limit search results to specified language
    settings.restrict_language = params.restrict_language || false;
    // Restrict Country - Enable geographical restrictions for autocomplete
    settings.autocomplete_restrict_country = params.autocomplete_restrict_country || false;
    // List of country restrictions - ISO 3166-1 Alpha-2 country codes
    settings.autocomplete_list_countries_restriction = params.autocomplete_list_countries_restriction || [];
    // Auth Referrer Policy - Controls how much referrer information is sent with API requests
    // Possible values per Referrer Policy specification:
    // - 'no-referrer': No referrer information sent
    // - 'no-referrer-when-downgrade': Referrer sent for HTTPS→HTTPS, not for HTTPS→HTTP (default)
    // - 'origin': Only origin (scheme, host, port) sent as referrer
    // - 'origin-when-cross-origin': Full URL for same-origin, origin only for cross-origin
    // - 'same-origin': Referrer sent for same-origin requests only
    // - 'strict-origin': Origin sent only when protocol security level stays same
    // - 'strict-origin-when-cross-origin': Full URL for same-origin, origin for cross-origin when protocol matches
    // - 'unsafe-url': Full URL always sent regardless of security
    if (params.auth_referrer_policy) {
        settings.authReferrerPolicy = params.auth_referrer_policy;
    }
    return settings;
}

// Module-level cache for Google Maps settings to prevent duplicate fetches
const settingsCache = {};
// Module-level loader state tracking
const loaderState = { status: LOADER_STATUS.NOT_LOADED };
// Promise cache to prevent concurrent duplicate fetch requests
let fetchPromise = null;

/**
 * Internal function that fetches Google Maps settings from the Odoo backend with retry logic.
 *
 * Implements exponential backoff retry strategy for handling transient network failures.
 * Will retry up to MAX_RETRY_ATTEMPTS times with increasing delays between attempts:
 * - Attempt 1 failure: wait 1 second
 * - Attempt 2 failure: wait 2 seconds
 * - Attempt 3 failure: wait 4 seconds
 *
 * @private
 * @async
 * @returns {Promise<Object>} Validated settings object with API key
 * @throws {Error} If all retry attempts fail or if API key is missing
 * @throws {Error} If settings endpoint returns no data
 * @throws {Error} If request times out after NETWORK_TIMEOUT milliseconds
 *
 * @example
 * // Internal usage only - called by fetchSettings()
 * const settings = await fetchSettingsWithRetry();
 * // Returns: { key: 'AIza...', region: 'US', ... }
 */
async function fetchSettingsWithRetry() {
    for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Settings fetch timeout')), NETWORK_TIMEOUT);
            });

            const dataPromise = rpc('/web/base_google_map/settings', {});
            const data = await Promise.race([dataPromise, timeoutPromise]);

            if (data) {
                const values = prepareSettingValues(data);
                Object.assign(settingsCache, values);

                // Validate that we have the critical API key
                if (!settingsCache.key) {
                    throw new Error('Google Maps API key is missing from settings');
                }

                return settingsCache;
            }

            throw new Error('No data received from settings endpoint');
        } catch (error) {
            // If this is the last attempt, throw the error
            if (attempt === MAX_RETRY_ATTEMPTS) {
                console.error('Failed to fetch Google Maps settings after all retries:', error);
                loaderState.status = LOADER_STATUS.FAILED;
                throw error;
            }

            // Otherwise, log and retry with exponential backoff
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            console.warn(`Settings fetch attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Fetches Google Maps API settings from the Odoo backend with caching and deduplication.
 *
 * This function ensures settings are fetched only once, even when called by multiple
 * component instances simultaneously. It implements:
 * - Module-level caching: subsequent calls return cached settings
 * - Promise deduplication: concurrent calls share the same fetch promise
 * - Automatic retry with exponential backoff for network failures
 * - API key validation to ensure settings are usable
 *
 * The settings are fetched from the '/web/base_google_map/settings' RPC endpoint
 * and transformed into the format expected by the Google Maps JavaScript API.
 *
 * @public
 * @async
 * @returns {Promise<Object>} Google Maps API settings object
 * @returns {string} returns.key - Google Maps API key
 * @returns {string} returns.v - API version (e.g., 'beta', 'weekly', 'quarterly')
 * @returns {string} returns.region - Region code
 * @returns {string} returns.language - Language code
 * @returns {string} returns.color_scheme - Color scheme ('light' or 'dark')
 * @throws {Error} If settings fetch fails after all retry attempts
 * @throws {Error} If API key is missing from the fetched settings
 *
 * @example
 * // Fetch settings (first call makes RPC request)
 * const settings = await fetchSettings();
 * console.log(settings.key); // 'AIza...'
 *
 * @example
 * // Subsequent calls return cached settings immediately
 * const cachedSettings = await fetchSettings(); // No RPC call made
 *
 * @example
 * // Multiple concurrent calls share the same promise
 * const [settings1, settings2] = await Promise.all([
 *   fetchSettings(), // Makes RPC request
 *   fetchSettings()  // Reuses same promise, no duplicate request
 * ]);
 */
export async function fetchSettings() {
    // Reuse existing promise if already fetching (prevents duplicate concurrent requests)
    if (fetchPromise) {
        return fetchPromise;
    }

    // Return cached settings if available (prevents duplicate sequential requests)
    if (Object.keys(settingsCache).length > 0) {
        return settingsCache;
    }

    // Create new fetch promise and cache it
    fetchPromise = fetchSettingsWithRetry().finally(() => {
        // Clear promise cache after completion (success or failure)
        fetchPromise = null;
    });

    return fetchPromise;
}

/**
 * Hook for loading and managing Google Maps API in Odoo/OWL components.
 *
 * This composable provides a complete solution for loading the Google Maps JavaScript API
 * in OWL components with the following features:
 * - Automatic loading on component mount (onWillStart)
 * - Settings fetch with retry and caching
 * - Library import with timeout protection
 * - Status tracking and error handling
 * - Automatic cleanup on component unmount
 *
 * @param {Function} [onLoad] - Callback invoked when Google Maps API loads successfully
 * @param {Function} [onError] - Callback invoked if loading fails, receives error object
 * @returns {Object} API object with utility methods
 * @returns {Function} returns.importLibrary - Function to import Google Maps libraries
 * @returns {Function} returns.getSettings - Function to get current settings (returns a copy)
 * @returns {Function} returns.isLoadedSuccessfully - Function to check if API loaded successfully
 * @returns {Function} returns.getStatus - Function to get current loader status
 * @returns {Function} returns.getStatusMessage - Function to get human-readable status message
 * @returns {Function} returns.removeListener - Function to manually remove status listener
 *
 * @example
 * import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';
 *
 * class MyMapComponent extends Component {
 *   setup() {
 *     this.gmapsLoader = useGoogleMapsAPILoader(
 *       () => {
 *        console.log('Google Maps API loaded successfully');
 *       },
 *       (error) => console.error('Failed to load:', error)
 *     );
 *   }
 *
 * }
 */
export const useGoogleMapsAPILoader = (
    onLoad = () => {},
    onError = () => {}
) => {
    const loadedLibraries = new Map();

    /**
     * Imports a Google Maps JavaScript API library with caching and timeout protection.
     *
     * Dynamically imports Google Maps libraries (e.g., 'maps', 'places', 'marker', 'geometry')
     * using the google.maps.importLibrary() method. Implements caching to prevent redundant
     * loads and timeout protection to prevent hanging.
     *
     * Note: This method requires the Google Maps API to be loaded first (via onWillStart).
     *
     * @async
     * @param {string} name - Name of the library to import (e.g., 'maps', 'places', 'marker')
     * @returns {Promise<Object>} The imported library namespace
     * @throws {Error} If library name is invalid (not a non-empty string)
     * @throws {Error} If Google Maps API hasn't been loaded yet
     * @throws {Error} If library loading times out (after NETWORK_TIMEOUT ms)
     *
     * @example
     * // Import the core maps library
     * const { Map } = await importLibrary('maps');
     * const map = new Map(element, { center: { lat: 0, lng: 0 }, zoom: 8 });
     *
     * @example
     * // Import multiple libraries
     * const [{ Map }, { PlacesService }] = await Promise.all([
     *   importLibrary('maps'),
     *   importLibrary('places')
     * ]);
     *
     * @example
     * // Cached - second call returns immediately
     * const { Map } = await importLibrary('maps'); // Makes actual import
     * const { Map: MapCached } = await importLibrary('maps'); // Returns cached
     */
    async function importLibrary(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid library name: must be a non-empty string');
        }

        // Return cached library if available
        if (loadedLibraries.has(name)) {
            return loadedLibraries.get(name);
        }

        if (window.google?.maps?.importLibrary === undefined || !window.google?.maps?.importLibrary) {
            throw new Error('importLibrary was called before the Google Maps API was defined');
        }

        try {
            // Add timeout for library loading
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Library ${name} loading timeout`)), NETWORK_TIMEOUT);
            });
            
            const loadPromise = window.google.maps.importLibrary(name);
            const res = await Promise.race([loadPromise, timeoutPromise]);
            
            loadedLibraries.set(name, res);
            return res;
        } catch (error) {
            console.error(`Failed to load library ${name}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Internal callback to update the loader state status.
     * Called by GoogleMapsAPILoader when loading status changes.
     * @private
     */
    const setLoadingStatus = (status) => {
        loaderState.status = status;
    };

    // Automatically load Google Maps API when component mounts
    onWillStart(async () => {
        try {
            await fetchSettings();
            await GoogleMapsAPILoader.load(settingsCache, setLoadingStatus);
            if (typeof onLoad === 'function') {
                onLoad();
            }
        } catch (error) {
            loaderState.status = LOADER_STATUS.FAILED;
            if (typeof onError === 'function') {
                onError(error);
            } else {
                console.error(' Failed to load the Google Maps JavaScript API: ', error);
            }
        }
    });

    /**
     * Removes the status change listener from GoogleMapsAPILoader.
     * Useful for manual cleanup if needed before component unmount.
     */
    const removeListener = () => {
        GoogleMapsAPILoader.removeListener(setLoadingStatus);
    };

    // Automatically cleanup when component unmounts
    onWillUnmount(() => {
        removeListener();
    });

    /**
     * Returns a copy of the current Google Maps API settings.
     * Returns a defensive copy to prevent accidental mutation of the cache.
     *
     * @returns {Object} Copy of settings object
     *
     * @example
     * const settings = getSettings();
     * console.log(settings.key); // 'AIza...'
     * console.log(settings.region); // 'US'
     */
    const getSettings = () => ({ ...settingsCache });

    /**
     * Returns the current loading status.
     *
     * @returns {string} One of LOADER_STATUS values (NOT_LOADED, LOADING, LOADED, FAILED, etc.)
     *
     * @example
     * const status = getStatus();
     * if (status === LOADER_STATUS.LOADED) {
     *   // API is ready to use
     * }
     */
    const getStatus = () => loaderState.status;

    /**
     * Checks if the Google Maps API has been loaded successfully.
     *
     * @returns {boolean} True if API is loaded and ready to use
     *
     * @example
     * if (isLoadedSuccessfully()) {
     *   const { Map } = await importLibrary('maps');
     *   // Create map...
     * }
     */
    const isLoadedSuccessfully = () => {
        return loaderState.status === LOADER_STATUS.LOADED;
    };

    /**
     * Returns a human-readable, translated message for a given loader status.
     *
     * @param {string} status - Loader status from LOADER_STATUS enum
     * @returns {string} Translated status message
     *
     * @example
     * const message = getStatusMessage(LOADER_STATUS.LOADING);
     * console.log(message); // "The Google Maps JavaScript API is currently loading."
     *
     * @example
     * // Display current status to user
     * const currentStatus = getStatus();
     * const message = getStatusMessage(currentStatus);
     * showNotification(message);
     */
    const getStatusMessage = (status) => {
        switch (status) {
            case LOADER_STATUS.NOT_LOADED:
                return _t('The Google Maps JavaScript API has not been loaded.');
            case LOADER_STATUS.LOADING:
                return _t('The Google Maps JavaScript API is currently loading.');
            case LOADER_STATUS.LOADED:
                return _t('The Google Maps JavaScript API has been loaded successfully.');
            case LOADER_STATUS.FAILED:
                return _t('An error occurred while loading the Google Maps JavaScript API.');
            case LOADER_STATUS.NETWORK_ERROR:
                return _t('Network error while loading the Google Maps JavaScript API.');
            case LOADER_STATUS.TIMEOUT:
                return _t('Timeout while loading the Google Maps JavaScript API.');
            case LOADER_STATUS.AUTH_FAILURE:
                return _t('Google Maps API authentication failed.');
            default:
                return _t('Unknown status.');
        }
    }

    return {
        importLibrary,
        getSettings,
        isLoadedSuccessfully,
        getStatus,
        getStatusMessage,
        removeListener,
    };
};
