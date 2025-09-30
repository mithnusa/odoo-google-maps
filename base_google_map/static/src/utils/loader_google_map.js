import { onMounted, onWillStart, onWillUnmount } from '@odoo/owl';
import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";

const DEFAULT_SOLUTION_CHANNEL = 'GMP_Odoo_Addons_v1';
const DEBOUNCE_DELAY = 16;
const NETWORK_TIMEOUT = 10000;
const MAX_RETRY_ATTEMPTS = 3;

// Security constants
const ALLOWED_URL_CHARS = /^[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]+$/;
const DANGEROUS_CHARS = /[<>"'&]/g;

export const LOADER_STATUS = {
    NOT_LOADED: 'NOT_LOADED',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    FAILED: 'FAILED',
    AUTH_FAILURE: 'AUTH_FAILURE',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
};

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
        return Object.values(params).join('/');
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
        
        if (error.message.includes('auth')) {
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

export const useGoogleMapsAPILoader = (
    onLoad = () => {},
    onError = () => {}
) => {
    const state = {
        region: 'US',
        v: 'quarterly',
        color_scheme: 'light',
        status: LOADER_STATUS.NOT_LOADED,
    };
    const loadedLibraries = new Map();
    let settingsCache = null;

    /**
     * Import Google Maps library with caching and error handling
     * @param {string} name - Library name to import
     * @returns {Promise<Object>} Imported library
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

    const setLoadingStatus = (status) => {
        state.status = status;
    };

    /**
     * Fetch settings with timeout and error handling
     * @returns {Promise<Object>} Settings object
     */
    const fetchSettings = async () => {
        if (settingsCache) return settingsCache;
        
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Settings fetch timeout')), NETWORK_TIMEOUT);
            });
            
            const dataPromise = rpc('/web/base_google_map/settings', {});
            const data = await Promise.race([dataPromise, timeoutPromise]);
            
            if (data) {
                settingsCache = prepareSettingValues(data);
            }
            return settingsCache;
        } catch (error) {
            console.error('Failed to fetch Google Maps settings:', error);
            // Return default settings on failure
            return {
                region: 'US',
                v: 'quarterly',
                color_scheme: 'light',
                libraries: 'geometry',
                language: 'en_US',
            };
        }
    };

    onWillStart(async () => {
        try {
            const settings = await fetchSettings();
            if (settings) {
                Object.assign(state, settings);
            }
            await GoogleMapsAPILoader.load(state, setLoadingStatus);
            if (typeof onLoad === 'function') {
                onLoad();
            }
        } catch (error) {
            if (typeof onError === 'function') {
                onError(error);
            } else {
                console.error(' Failed to load the Google Maps JavaScript API: ', error);
            }
        }
    });

    const removeListener = () => {
        GoogleMapsAPILoader.removeListener(setLoadingStatus);
    };

    onWillUnmount(() => {
        removeListener();
    });

    const prepareSettingValues = (params) => {
        const settings = {};
        // API Key
        settings.key = params.api_key;
        // Map ID
        settings.map_id = params.map_id;
        // Libraries
        let libraries = params.libraries;
        const defaultLibraries = ['geometry'];
        if (!Array.isArray(libraries) || libraries.length === 0) {
            libraries = defaultLibraries;
        }
        settings.libraries = libraries.join(',');
        // Version
        settings.v = params.version || 'beta';
        // Region
        settings.region = params.region || 'US';
        // Language
        settings.language = params.language || 'en_US';
        // Channel
        if (params.channel === undefined || params.channel < 0 || params.channel > 999) {
            delete settings.channel;
        }
        // Solution Channel
        if (params.solution_channel === undefined) {
            settings.solutionChannel = DEFAULT_SOLUTION_CHANNEL;
        } else if (params.solution_channel === null || params.solution_channel === '') {
            delete settings.solutionChannel;
        }
        // Color scheme
        settings.color_scheme = params.color_scheme || 'light';
        // In Map Place Search
        settings.in_map_place_search = params.is_places_search_enable || false;
        // Restrict Language
        settings.restrict_language = params.restrict_language || false;
        // Restrict Country
        settings.autocomplete_restrict_country = params.autocomplete_restrict_country || false;
        // List of country restrictions
        settings.autocomplete_list_countries_restriction = params.autocomplete_list_countries_restriction || [];
        // Auth Referrer Policy
        // The auth_referrer_policy can take several possible values, which are defined by the Referrer Policy specification.
        // These values control how much referrer information should be included with requests made from your site. Here are the possible values:
        // 1. `no-referrer`: No referrer information is sent along with requests.
        // 2. `no-referrer-when-downgrade`: Default policy. Referrer is sent to the same protocol security level (HTTPS to HTTPS) but not when downgrading (HTTPS to HTTP).
        // 3. `origin`: Only the origin (scheme, host, and port) of the document is sent as the referrer.
        // 4. `origin-when-cross-origin`: Sends the full URL as the referrer when making same-origin requests, but only sends the origin when making cross-origin requests.
        // 5. `same-origin`: Referrer is sent for same-origin requests, but not for cross-origin requests.
        // 6. `strict-origin`: Only the origin is sent as the referrer, but only when the protocol security level remains the same.
        // 7. `strict-origin-when-cross-origin`: Sends the full URL for same-origin requests, but only the origin for cross-origin requests, and only when the protocol security level remains the same.
        // 8. `unsafe-url`: The full URL is always sent as the referrer, regardless of the security of the protocol.
        if (params.auth_referrer_policy) {
            settings.authReferrerPolicy = params.auth_referrer_policy;
        }
        return settings;
    }

    const getSettings = () => {
        return state;
    };

    const getStatus = () => state.status;

    const isLoadedSuccessfully = () => {
        return state.status === LOADER_STATUS.LOADED;
    };

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
        fetchSettings,
        removeListener,
        __settings: state,
    };
};
