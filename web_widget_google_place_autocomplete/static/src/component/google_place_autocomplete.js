/**
 * @fileoverview Google Place Autocomplete Component for Odoo
 *
 * This module provides an OWL component that wraps Google's PlaceAutocompleteElement
 * for address input in Odoo forms. It handles international address formats,
 * street number extraction, field mapping, and integrates with Odoo's backend
 * for data transformation.
 *
 * @module web_widget_google_map/component/google_place_autocomplete
 * @requires @web/core/l10n/translation
 * @requires @web/core/utils/hooks
 * @requires @web/core/utils/strings
 * @requires @web/core/utils/timing
 * @requires @odoo/owl
 * @requires @base_google_map/utils/loader_google_map
 */

import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { sprintf } from '@web/core/utils/strings';
import { debounce } from "@web/core/utils/timing";
import {
    Component,
    useEffect,
    useState,
    useRef,
    onWillUnmount,
} from '@odoo/owl';
import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';

// Constants
const FOCUS_DEBOUNCE_DELAY = 800; // milliseconds

/**
 * Extracts street number, building number, unit number, and route from an address string.
 * Supports multiple international address formats including Indonesian, Singapore, European, US, and Australian.
 *
 * @param {string} address - The full address string to parse
 * @returns {Object} Parsed address components
 * @returns {string} returns.buildingNumber - The building number (e.g., "123")
 * @returns {string} returns.unitNumber - The unit/apartment number (e.g., "45" from "123/45")
 * @returns {string} returns.route - The street name without the number
 * @returns {string} returns.prefix - The number prefix if present (e.g., "No.", "#")
 * @returns {string} returns.street_number - The formatted full street number with prefix
 *
 * @example
 * // Indonesian format
 * extractStreetNumber("Jalan Sudirman No. 123, Jakarta")
 * // Returns: { buildingNumber: "123", unitNumber: "", route: "Jalan Sudirman", prefix: "No.", street_number: "No. 123" }
 *
 * @example
 * // Singapore format with unit
 * extractStreetNumber("Orchard Road #12-345, Singapore")
 * // Returns: { buildingNumber: "12", unitNumber: "345", route: "Orchard Road", prefix: "#", street_number: "#12-345" }
 *
 * @example
 * // US format
 * extractStreetNumber("123 Main Street, New York")
 * // Returns: { buildingNumber: "123", unitNumber: "", route: "Main Street", prefix: "", street_number: "123" }
 */
function extractStreetNumber(address) {
    const streetPart = address.split(',')[0]?.trim() || '';

    if (!streetPart) {
        return { buildingNumber: '', route: '', unitNumber: '', prefix: '', street_number: '' };
    }

    // Pattern with captured prefix groups
    const patterns = [
        // Indonesian: "Jalan ABC No.123" - captures "No." or "No"
        {
            regex: /^(.+?)\s+(No\.?)\s*([\d]+[A-Za-z]*(?:[\/\-][\d]+[A-Za-z]*)?)$/i,
            routeIdx: 1,
            prefixIdx: 2,
            numberIdx: 3,
        },

        // Singapore: "Street Name #12-345"
        {
            regex: /^(.+?)\s+(#)([\d]+[A-Za-z]*(?:[\/\-][\d]+[A-Za-z]*)?)$/i,
            routeIdx: 1,
            prefixIdx: 2,
            numberIdx: 3,
        },

        // European: "Street Name 123" (number last, no prefix)
        {
            regex: /^(.+?)\s+([\d]+[A-Za-z]*(?:[\/\-][\d]+[A-Za-z]*)?)$/,
            routeIdx: 1,
            prefixIdx: null,
            numberIdx: 2,
        },

        // US/AU: "123 Street Name" (number first, no prefix)
        {
            regex: /^([\d]+[A-Za-z]*(?:[\/\-][\d]+[A-Za-z]*)?)\s+(.+)$/,
            numberIdx: 1,
            prefixIdx: null,
            routeIdx: 2,
        },

        // Range patterns
        {
            regex: /^(.+?)\s+([\d]+[A-Za-z]*[-–][\d]+[A-Za-z]*)$/,
            routeIdx: 1,
            prefixIdx: null,
            numberIdx: 2,
        }, // Range last
        {
            regex: /^([\d]+[A-Za-z]*[-–][\d]+[A-Za-z]*)\s+(.+)$/,
            numberIdx: 1,
            prefixIdx: null,
            routeIdx: 2,
        }, // Range first

        // Complex patterns with slash
        {
            regex: /^(.+?)\s+([\d]+[A-Za-z]*\/[\d]+[A-Za-z]*)$/,
            routeIdx: 1,
            prefixIdx: null,
            numberIdx: 2,
        }, // Complex last
        {
            regex: /^([\d]+[A-Za-z]*)\/([\d]+[A-Za-z]*)\s+(.+)$/,
            numberIdx: 1,
            prefixIdx: null,
            routeIdx: 3,
        }, // Complex first

        // Simple patterns
        { regex: /^(.+?)\s+([\d]+[A-Za-z]*)$/, routeIdx: 1, prefixIdx: null, numberIdx: 2 }, // Simple last
        { regex: /^([\d]+[A-Za-z]*)\s+(.+)$/, numberIdx: 1, prefixIdx: null, routeIdx: 2 }, // Simple first
    ];

    for (const pattern of patterns) {
        const match = streetPart.match(pattern.regex);
        if (match) {
            const number = match[pattern.numberIdx];
            const route = match[pattern.routeIdx];
            const prefix = pattern.prefixIdx !== null ? match[pattern.prefixIdx] : '';

            let formattedStreetNumber = [];

            if (prefix) {
                formattedStreetNumber.push(prefix);
            }

            if (number) {
                formattedStreetNumber.push(number);
            }
            formattedStreetNumber = formattedStreetNumber.join(' ').trim();

            // Check for unit in number
            const unitMatch = number.match(/([\d]+[A-Za-z]*)[\/\-]([\d]+[A-Za-z]*)/);

            if (unitMatch) {
                return {
                    buildingNumber: unitMatch[1],
                    unitNumber: unitMatch[2],
                    route: route,
                    prefix: prefix,
                    street_number: formattedStreetNumber,
                };
            }

            return {
                buildingNumber: number,
                unitNumber: '',
                route: route,
                prefix: prefix,
                street_number: formattedStreetNumber,
            };
        }
    }

    return { buildingNumber: '', route: streetPart, unitNumber: '', prefix: '', street_number: '' };
}

/**
 * Google Place Autocomplete Element Component
 *
 * An Odoo OWL component that wraps Google's PlaceAutocompleteElement for address input.
 * Handles place selection, street number extraction, field mapping, and error handling.
 *
 * @extends Component
 *
 * @property {Object} props - Component properties
 * @property {number} [props.id] - Google Places mapping configuration ID (optional)
 * @property {string} props.code - Mapping code identifier (e.g., "partner_address")
 * @property {string} props.mode - Component mode
 * @property {Object} [props.options] - Google PlaceAutocompleteElement configuration options
 * @property {Array<string>} props.fields - Google Place fields to fetch (e.g., ["name", "formatted_address"])
 * @property {string} props.resModel - Target Odoo model name (e.g., "res.partner")
 * @property {string} props.elementId - Custom HTML element ID for the autocomplete widget
 * @property {Function} props.callback - Callback function invoked when a place is selected
 * @property {boolean} [props.isTest=false] - Test mode flag (optional)
 *
 * @example
 * <GooglePlaceAutocompleteElement
 *   id={mappingId}
 *   code="partner_address"
 *   mode="edit"
 *   fields={["name", "formatted_address", "address_components"]}
 *   resModel="res.partner"
 *   elementId="partner-autocomplete"
 *   callback={handlePlaceSelected}
 * />
 */
export class GooglePlaceAutocompleteElement extends Component {
    static template = 'web_widget_google_place_autocomplete.GooglePlaceAutocomplete';
    static props = {
        id: { type: Number, optional: true }, // Mapping ID
        code: String,
        mode: {
            type: String,
            validate: (value) => ['address', 'places'].includes(value),
            optional: false,
        },
        options: { type: Object, optional: true },
        fields: Array,
        resModel: String,
        elementId: String,
        callback: Function, // Callback function to handle selected place
        isTest: { type: Boolean, optional: true },
        isCollapseOpen: { type: Boolean, optional: true }
    };

    static defaultProps = {
        options: {},
        isTest: false,
        isCollapseOpen: false,
    };

    setup() {
        this.gAutocompleteRef = useRef('gAutocomplete');
        this.notificationService = useService('notification');
        this.actionService = useService('action');

        this.state = useState({ isGoogleLoaded: false });

        this.googleApiloader = useGoogleMapsAPILoader(
            () => {
                this.state.isGoogleLoaded = true;
            },
            (error) => {
                console.error(' Error loading Google Maps API: ', error);
                this.state.isGoogleLoaded = false;
                this.notificationService.add(
                    sprintf(_t('Failed to load Google Maps API.\n%s'), error.message || error),
                    { type: 'danger' }
                );
            }
        );

        this.gmpEvents = new Map(); // To manage gmp-select event listeners
        this.placeAutocompleteEl = null;
        this.debounceHandleGooglePlaceError = debounce(this.handleGooglePlaceError.bind(this), FOCUS_DEBOUNCE_DELAY);

        useEffect(
            (mappingId, isGoogleLoaded, gAutocompleteRef) => {
                if (mappingId && isGoogleLoaded && gAutocompleteRef.el) {
                    this.initGooglePlaceAutocompleteElement();
                }
            },
            () => [this.props.id, this.state.isGoogleLoaded, this.gAutocompleteRef]
        );

        useEffect(
            (isCollapseOpen) => {
                if (isCollapseOpen && this.placeAutocompleteEl) {
                    this.placeAutocompleteEl.focus();
                } else if (this.placeAutocompleteEl && !isCollapseOpen) {
                    this.placeAutocompleteEl.blur();
                }
            },
            () => [this.props.isCollapseOpen]
        );

        onWillUnmount(() => {
            this.cleanUp();
        });
    }

    /**
     * Initializes the Google Place Autocomplete Element.
     * - Imports Google Places library
     * - Creates PlaceAutocompleteElement instance
     * - Registers event listeners for place selection and errors
     * - Handles focus/blur behavior
     *
     * @async
     * @returns {Promise<void>}
     */
    async initGooglePlaceAutocompleteElement() {
        if (this.placeAutocompleteEl) {
            this._handleGoogleComponent();
            return; // Already initialized
        }
        try {
            await this.googleApiloader.importLibrary('places');
            if (this.props.options) {
                this.placeAutocompleteEl = new google.maps.places.PlaceAutocompleteElement(
                    this.props.options
                );
            } else {
                this.placeAutocompleteEl = new google.maps.places.PlaceAutocompleteElement();
            }
            this.placeAutocompleteEl.id =
                this.props.elementId || `gpa-${Math.random().toString(36).substr(2, 9)}`;
            this.gAutocompleteRef.el.appendChild(this.placeAutocompleteEl);
            this.setGmpEventListener('gmp-select', this.handlePlaceSelect.bind(this));
            this.setGmpEventListener('gmp-error', this.debounceHandleGooglePlaceError.bind(this));
            this._handleGoogleComponent();
        } catch (error) {
            console.error('Error initializing Google Place Autocomplete Element:', error);
            this.notificationService.add(
                sprintf(
                    _t('Something went wrong while initializing Google Autocomplete widget.\n%s'),
                    error.message || error
                ),
                { type: 'warning' }
            );
        }
    }

    /**
     * Handles focus/blur behavior of the Google Place Autocomplete Element.
     * Focuses the widget when container is expanded, blurs when collapsed.
     * Uses debouncing to prevent rapid state changes.
     *
     * @private
     */
    _handleGoogleComponent() {
        if (this.handleWidgetElTimeout) {
            clearTimeout(this.handleWidgetElTimeout);
        }
        this.handleWidgetElTimeout = setTimeout(() => {
            const isClosed = this.gAutocompleteRef.el.classList.contains('collapsed');
            if (!isClosed) {
                this.placeAutocompleteEl.focus();
            } else {
                this.placeAutocompleteEl.blur();
            }
        }, FOCUS_DEBOUNCE_DELAY);
    }

    /**
     * Handles place selection from the autocomplete dropdown.
     * - Extracts street number from selected text
     * - Fetches full place details from Google Places API
     * - Parses and maps place data to Odoo fields
     * - Invokes callback with mapped result
     *
     * @async
     * @param {Object} event - The gmp-select event object
     * @param {Object} event.placePrediction - The selected place prediction from Google
     * @returns {Promise<void>}
     */
    async handlePlaceSelect({ placePrediction }) {
        try {
            if (this.props.fields.length === 0) {
                console.warn('No place fields specified to retrieve.');
                return;
            }

            // selectedText is the option the user selected from the dropdown
            // we need it to extract the street number (if it's set) in case Google doesn't provide it
            const selectedText = placePrediction.text?.text || '';

            const place = placePrediction.toPlace();
            await place.fetchFields({ fields: this.props.fields });
            const placeJson = place.toJSON();

            const streetNumber = extractStreetNumber(selectedText);
            const mappingResult = await this.parsePlace(placeJson, this.props.code, streetNumber);
            if (this.props.isTest) {
                mappingResult['placeJson'] = placeJson;
            }
            if (this.props.callback && typeof this.props.callback === 'function') {
                this.props.callback(mappingResult);
            }
        } catch (error) {
            console.error('Error handling place select:', error);
            this.notificationService.add(
                sprintf(_t('Something went wrong with the Google Autocomplete widget.\n%s'), error),
                { type: 'warning' }
            );
        }
    }

    /**
     * Handles errors from Google Place Autocomplete Element.
     * Logs error to console and displays user-friendly notification.
     *
     * @param {Error|string|*} error - The error object, string, or value from Google API
     */
    handleGooglePlaceError(error) {
        console.error('Google Place Autocomplete Error:', error);
        let errorMessage = _t('Something went wrong with the Google Autocomplete widget.');
        if (error && typeof error === 'object' && error.message) {
            errorMessage = sprintf(_t('Something went wrong with the Google Autocomplete widget.\n%s'), error.message);
        } else if (error && typeof error === 'string') {
            errorMessage = sprintf(_t('Something went wrong with the Google Autocomplete widget.\n%s'), error);
        }
        this.notificationService.add(errorMessage, { type: 'warning' });
    }

    /**
     * Sets an event listener on the Google Place Autocomplete Element.
     * Automatically removes any previous listener for the same event before adding the new one.
     *
     * @param {string} eventName - The event name (e.g., 'gmp-select', 'gmp-error')
     * @param {Function} listener - The event listener function
     */
    setGmpEventListener(eventName, listener) {
        if (this.placeAutocompleteEl) {
            if (this.gmpEvents.has(eventName)) {
                // Remove previous listener
                const prevListener = this.gmpEvents.get(eventName);
                this.placeAutocompleteEl.removeEventListener(eventName, prevListener);
            }
            this.placeAutocompleteEl.addEventListener(eventName, listener);
            this.gmpEvents.set(eventName, listener);
        }
    }

    /**
     * Removes all registered event listeners from the Google Place Autocomplete Element.
     * Clears the internal event listener registry.
     */
    removeAllGmpEventListeners() {
        if (this.placeAutocompleteEl && this.gmpEvents) {
            this.gmpEvents.forEach((listener, eventName) => {
                this.placeAutocompleteEl.removeEventListener(eventName, listener);
            });
            this.gmpEvents.clear();
        }
    }

    /**
     * Opens the Google Places mapping configuration form in a dialog.
     * Allows users to configure how Google Place fields map to Odoo fields.
     *
     * @throws {Error} Displays warning if mapping ID is not set
     */
    openMappingConfig() {
        if (!this.props.id) {
            console.warn('Mapping ID is not set. Cannot open mapping configuration.');
            this.notificationService.add(
                _t('Mapping configuration is not available. Please set up the mapping first.'),
                { type: 'warning' }
            );
            return;
        }
        this.actionService.doAction({
            name: _t('Google Place Mapping Configuration'),
            type: 'ir.actions.act_window',
            res_model: 'google.places.mapping',
            res_id: this.props.id,
            views: [[false, 'form']],
            target: 'new',
        });
    }

    /**
     * Parses Google Place JSON and maps it to Odoo field values.
     * Calls the backend 'google.places.mapping' model to perform the mapping.
     *
     * @async
     * @param {Object} placeJson - The Google Place object as JSON
     * @param {string} mappingCode - The mapping configuration code
     * @param {Object} [streetNumber={}] - Extracted street number data (fallback if Google doesn't provide it)
     * @param {string} [streetNumber.buildingNumber] - The building number
     * @param {string} [streetNumber.unitNumber] - The unit/apartment number
     * @param {string} [streetNumber.route] - The street name
     * @param {string} [streetNumber.prefix] - The number prefix
     * @param {string} [streetNumber.street_number] - The formatted street number
     * @returns {Promise<Object>} Mapped Odoo field values (e.g., {street: "...", city: "...", ...})
     */
    async parsePlace(placeJson, mappingCode, streetNumber = {}) {
        if (!mappingCode) {
            this.notificationService.add(_t('Mapping code is required to parse the place.'), {
                type: 'warning',
            });
            return {};
        }

        if (!placeJson || typeof placeJson !== 'object' || Object.keys(placeJson).length === 0) {
            this.notificationService.add(_t('Invalid place data provided.'), { type: 'warning' });
            return {};
        }

        try {
            return await this.env.model.orm.call(
                'google.places.mapping',
                'parse_place',
                [placeJson, mappingCode, streetNumber],
                {
                    context: {
                        widget_res_model: this.props.resModel,
                        is_mapping_test: this.props.isTest,
                    },
                }
            );
        } catch (error) {
            console.error('Failed to parse place:', {
                error,
                mappingCode,
                resModel: this.props.resModel,
            });
            this.notificationService.add(_t('Failed to parse place data. Please try again.'), {
                type: 'danger',
            });
            return {};
        }
    }

    /**
     * Cleans up component resources before unmounting.
     * - Removes all event listeners
     * - Clears pending timeouts
     * - Removes DOM elements
     * - Nullifies references
     *
     * Called automatically by OWL's onWillUnmount lifecycle hook.
     */
    cleanUp() {
        this.removeAllGmpEventListeners();
        if (this.handleWidgetElTimeout) {
            clearTimeout(this.handleWidgetElTimeout);
            this.handleWidgetElTimeout = null;
        }
        if (
            this.placeAutocompleteEl &&
            this.gAutocompleteRef.el.contains(this.placeAutocompleteEl)
        ) {
            this.gAutocompleteRef.el.removeChild(this.placeAutocompleteEl);
            this.placeAutocompleteEl = null;
        }
    }
}
