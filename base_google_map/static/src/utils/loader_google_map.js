import { onMounted, onWillStart, onWillUnmount } from '@odoo/owl';
import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";

const DEFAULT_SOLUTION_CHANNEL = 'GMP_Odoo_Addons_v1';

export const LOADER_STATUS = {
    NOT_LOADED: 'NOT_LOADED',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    FAILED: 'FAILED',
    AUTH_FAILURE: 'AUTH_FAILURE',
};

export class GoogleMapsAPILoader {
    static loadingStatus = LOADER_STATUS.NOT_LOADED;
    static serializedApiParams = null;
    static listeners = [];
    static scriptLoaded = false;
    static loadPromise = null;

    static notifyLoadingStatusListeners() {
        // Debounce notifications to avoid too frequent updates
        if (this._notifyTimeout) {
            clearTimeout(this._notifyTimeout);
        }
        this._notifyTimeout = setTimeout(() => {
            this.listeners.forEach(listener => listener(this.loadingStatus));
        }, 16);
    }

    static serializedParams(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid parameters');
        }
        return Object.values(params).join('/');
    }

    static async load(params, onLoadingStatusChangeFn) {
        try {
            const serializedParams = this.serializedParams(params);
            this.listeners.push(onLoadingStatusChangeFn);
            if (window.google?.maps?.importLibrary === undefined) {
                if (!this.serializedApiParams) {
                    this.serializedApiParams = serializedParams;
                }
                this.loadingStatus = LOADER_STATUS.LOADING;
                this.notifyLoadingStatusListeners();
                await this._initImportLibrary(params);
                this.loadingStatus = LOADER_STATUS.LOADED;
                this.notifyLoadingStatusListeners();
            }

            if (this.serializedApiParams && this.serializedApiParams !== serializedParams) {
                console.warn(
                    '[google-maps-api-loader-internal]: The Google Maps API is already loaded with different parameters'
                );
            }
        } catch (error) {
            console.error(error);
            this.loadingStatus = LOADER_STATUS.ERROR;
            this.notifyLoadingStatusListeners();
            throw error;
        }
    }

    static loadGoogle(params) {
        const sanitizedParams = Object.fromEntries(
            Object.entries(params).map(([key, value]) => [
                key,
                typeof value === 'string' ? value.replace(/[<>|]/g, '') : value
            ])
        );
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

    static async _initImportLibrary(params) {
        if (!window.google) window.google = {};
        if (!window.google.maps) window.google.maps = {};

        if (window.google?.maps?.importLibrary === undefined) {
            const settings = {...params};
            delete settings.status;
            delete settings.theme;
            this.loadGoogle(settings);
        }
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

    async function importLibrary(name) {
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid parameter provided');
        }

        if (loadedLibraries.has(name)) {
            return loadedLibraries.get(name);
        }

        if (window.google?.maps?.importLibrary === undefined || !window.google?.maps?.importLibrary) {
            throw new Error('importLibrary was called before the Google Maps API was defined');
        }

        try {
            const res = await window.google.maps.importLibrary(name);
            loadedLibraries.set(name, res);
            return res;
        } catch (error) {
            console.error(`Failed to load library ${name}: ${error.message}`);
            throw error;
        }

    };

    const setLoadingStatus = (status) => {
        state.status = status;
    };

    const fetchSettings = async () => {
        if (settingsCache) return settingsCache;
        const data = await rpc('/web/base_google_map/settings', {});
        if (data) {
            settingsCache = prepareSettingValues(data);
        }
        return settingsCache;
    };

    onWillStart(async () => {
        const settings = await fetchSettings();
        if (settings) {
            Object.assign(state, settings);
        }
    });

    const removeListener = () => {
        const index = GoogleMapsAPILoader.listeners.indexOf(setLoadingStatus);
        if (index !== -1) {
            GoogleMapsAPILoader.listeners.splice(index, 1);
        }
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

    onMounted(async () => {
        try {
            await GoogleMapsAPILoader.load(state, setLoadingStatus);
            if (onLoad) {
                onLoad();
            }
        } catch (error) {
            if (onError) {
                onError(error);
            } else {
                console.error(' Failed to load the Google Maps JavaScript API: ', error);
            }
        }
    });

    const getSettings = () => {
        return state;
    };

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
            case LOADER_STATUS.ERROR:
                return _t('An error occurred while loading the Google Maps JavaScript API.');
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
        getStatusMessage,
        __settings: state,
    };
};
