import { _t } from '@web/core/l10n/translation';

/**
 * Parse config markerColor given in google_map view
 * @param {string} colors
 */

const DEFAULT_COLOR = '#F06050';
const DEFAULT_COLOR_RGBA = [240, 96, 80, 1];

export const WIDGET_COLOR_PICKER_COLOR = [
    null,
    '#ee2d2d', // Red
    '#dc8534', // Orange
    '#e8bc1d', // Yellow
    '#5793dd', // Light blue
    '#9f628f', // Dark purple
    '#db8865', // Salmon pink
    '#41a9a2', // Medium blue
    '#304ae0', // Dark blue
    '#ee2f8b', // Fuchsia
    '#61c36e', // Green
    '#9972e6', // Purple
];

export function getHexColorPicker(index) {
    return WIDGET_COLOR_PICKER_COLOR[index] || DEFAULT_COLOR;
}

/**
 * Format a number with thousand separators for better readability
 * @param {number} num - The number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number with commas, or empty string if num is not finite
 */
export function formatNumber(num, decimals = 2, locale = 'en-US') {
    if (!Number.isFinite(num)) {
        return '';
    }

    const toLocale = locale ? locale.replace('_', '-') : (navigator.language || 'en-US');
    try {
        const value = num.toLocaleString(toLocale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
        return value;
    } catch (e) {
        console.error('Error formatting number:', e);
        const value = num.toFixed(decimals);
        return value;
    }
}

/**
 * Extract the current action ID from the browser URL hash.
 * Browser-only: relies on window.location — not safe to call in SSR or tests.
 * @returns {number|null} The action ID, or null if not present or not a number
 */
export function getCurrentActionId() {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.slice(1));
    const actionId = parseInt(hashParams.get('action'));
    return isNaN(actionId) ? null : actionId;
}

/**
 * Process marker color value and return normalized color
 * @param {*} color - The color value from the record data or field configuration
 * @returns {string|null} - Normalized color value or null
 */
export function processColor(color) {
    let markerColor = null;
    if (color !== undefined && color !== null) {
        if (typeof color === 'number') {
            markerColor = getHexColorPicker(color);
        } else if (typeof color === 'string' && /(?:#|0x)(?:[a-f0-9]{3}|[a-f0-9]{6})\b|(?:rgb|hsl)a?\([^\)]*\)/gi.test(color)) {
            markerColor = color;
        }
        if (!markerColor) {
            markerColor = normalizeColor(color);
        }
    }
    if (!markerColor) {
        markerColor = DEFAULT_COLOR;
    }
    return markerColor;
}

/**
 * Convert a 6-digit hex color string to an RGBA array with components in the 0–255 range.
 *
 * The alpha channel follows the 0–255 convention used by deck.gl / WebGL, NOT the 0–1
 * CSS convention. Pass `alpha` in 0–1 and the function multiplies it by 255 internally:
 *   hexToRgba('#FF0000', 0.5) → [255, 0, 0, 128]
 *
 * Returns `defaultColor` when:
 *   - `hex` is falsy or not a string
 *   - `hex` is not a valid 6-digit hex color (3-digit shorthand is NOT supported)
 *
 * `alpha` is silently clamped to [0, 1] if out of range.
 *
 * @param {string} hex - 6-digit hex color, with or without leading '#' (e.g. '#FF0000' or 'FF0000')
 * @param {number} [alpha=1.0] - Opacity in the 0–1 range
 * @param {number[]} [defaultColor=DEFAULT_COLOR_RGBA] - Fallback [r, g, b, a] array (a in 0–255)
 * @returns {number[]} [r, g, b, a] array where every component is an integer in 0–255
 */
export function hexToRgba(hex, alpha = 1.0, defaultColor = DEFAULT_COLOR_RGBA) {
    const fallback = defaultColor || DEFAULT_COLOR_RGBA;
    if (!hex || typeof hex !== 'string') {
        console.warn('Invalid color format, defaulting to fill color');
        return fallback; // Default fill color RGBA
    }

    if (alpha < 0 || alpha > 1) {
        console.warn('Alpha value out of range (0-1), defaulting to 1.0');
        alpha = Math.max(0, Math.min(1, alpha));
    }
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
        Math.round(alpha * 255)
    ] : fallback; // Default fill color RGBA
}

export function parseRecord(record, viewConfig = {}, isGrouped = false) {
    function getFieldValue(fieldName) {
        let value = '';
        if (!fieldName || !record.fields[fieldName]) {
            return value;
        }
        switch (record.fields[fieldName].type) {
            case 'many2one':
                value = (record.data[fieldName] || {}).display_name || '';
                break;
            case 'selection': {
                const selection = record.fields[fieldName].selection.find(
                    (s) => s[0] === record.data[fieldName]
                );
                value = selection ? selection[1] : '';
                break;
            }
            case 'char':
            case 'text':
            case 'datetime':
            case 'date':
                value = record.data[fieldName] || '';
                break;
            case 'float':
            case 'integer':
            case 'monetary':
                value = record.data[fieldName] || 0;
                break;
            case 'binary': // expected binary of an image
                value = `/web/image/${record.resModel}/${record.resId}/${fieldName}`;
                break;
            case 'json':
                value = record.data[fieldName] ? record.data[fieldName] : {};
                break;
            default:
                value = null;
        }
        return value;
    }

    const other = {};
    let geolocation = false;

    const { lat, lng, ...otherFields } = viewConfig;

    if (!otherFields.title) {
        otherFields.title = 'display_name';
    }

    if (record.data) {
        if (lat && lng) {
            const latitude = getFieldValue(lat);
            const longitude = getFieldValue(lng);
            if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                geolocation = { lat: latitude, lng: longitude };
            }
        }

        Object.keys(otherFields).forEach((config) => {
            const fieldName = otherFields[config];
            const val = getFieldValue(fieldName);
            other[config] = val;
        });

        if (otherFields.__geoColor) {
            const color = record.data[otherFields.__geoColor];
            if (color !== undefined && color !== null) {
                if (typeof color === 'string' || (!color && typeof color !== 'number')) {
                    try {
                        other['__geoColor'] = normalizeColor(color);
                    } catch (error) {
                        console.warn('Failed to normalize color, using default color.', error);
                        other['__geoColor'] = DEFAULT_COLOR;
                    }
                } else if (typeof color === 'number') {
                    other['__geoColor'] = processColor(color);
                }
            } else {
                other['__geoColor'] = processColor(otherFields.__geoColor);
            }
        }
        if (!other['__geoColor']) {
            other['__geoColor'] = DEFAULT_COLOR;
        }
    }
    return { geolocation, other };
}


export function getRecordDataView(record, viewAttrs) {
    let dataView = record.dataView || {};
    if (Object.values(dataView?.other || {}).filter(val => val !== null && val !== undefined && val !== '').length <= 0) {
        dataView = parseRecord(record, viewAttrs);
    }
    return dataView;
}

// Module-level cache — avoids repeated DOM reflows for the same color value
const _normalizeColorCache = new Map();

export function normalizeColor(color) {
    // Return cached result if available
    if (_normalizeColorCache.has(color)) {
        return _normalizeColorCache.get(color);
    }

    // Expand 3-digit hex → 6-digit before returning
    if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
        const expanded = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toUpperCase();
        _normalizeColorCache.set(color, expanded);
        return expanded;
    }

    // 6-digit hex: return immediately without DOM manipulation
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
        const upper = color.toUpperCase();
        _normalizeColorCache.set(color, upper);
        return upper;
    }

    // Use the browser's color parser via a temporary element (requires a live DOM)
    if (!document?.body) {
        _normalizeColorCache.set(color, DEFAULT_COLOR);
        return DEFAULT_COLOR;
    }

    const tempElement = document.createElement('div');
    tempElement.style.color = color;
    document.body.appendChild(tempElement);

    let computedColor;
    try {
        computedColor = window.getComputedStyle(tempElement).color;
    } finally {
        document.body.removeChild(tempElement);
    }

    // Match both rgb(...) and rgba(...) — handles transparent and alpha colors
    const rgbMatch = computedColor.match(
        /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/
    );
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        const b = parseInt(rgbMatch[3]);
        const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        _normalizeColorCache.set(color, hex);
        return hex;
    }

    // Fallback: browser could not parse the color — return safe default
    _normalizeColorCache.set(color, DEFAULT_COLOR);
    return DEFAULT_COLOR;
}

export function generateColor(seed = null) {
    const colors = [
        '#CC0000', // – Red
        '#007A00', // – Lime (darkened)
        '#0000CC', // – Blue
        '#B8860B', // – Yellow (darkened to Dark Goldenrod)
        '#CC00CC', // – Magenta
        '#008B8B', // – Cyan (darkened to Dark Cyan)
        '#CC7A00', // – Orange (darkened)
        '#800080', // – Purple
        '#006400', // – Dark Green
        '#000080', // – Navy
        '#C2185B', // – Pink (darkened to Dark Pink)
        '#A52A2A', // – Brown
        '#808000', // – Olive
        '#007070', // – Teal (darkened)
        '#C2006A', // – Deep Pink (darkened)
        '#5A8F00', // – Chartreuse (darkened)
        '#DC143C', // – Crimson
        '#2E8B8B', // – Turquoise (darkened)
        '#2F4F4F', // – Dark Slate Gray
        '#556B2F', // – Dark Olive Green
    ];
    if (seed !== null && seed !== undefined) {
        const str = String(seed);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0; // convert to 32-bit integer
        }
        return colors[Math.abs(hash) % colors.length];
    }
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Parse color to RGB components
 * @param {string} color - Color in hex, rgb, or named format
 * @returns {{r: number, g: number, b: number}} RGB components (0-255)
 * @private
 */
function parseColorToRgb(color) {
    const hexColor = normalizeColor(color).replace(/^#/, '');
    return {
        r: parseInt(hexColor.substring(0, 2), 16),
        g: parseInt(hexColor.substring(2, 4), 16),
        b: parseInt(hexColor.substring(4, 6), 16),
    };
}

/**
 * Calculate adjustment value for a color component
 * @param {number} currentValue - Current RGB value (0-255)
 * @param {number} amount - Adjustment amount
 * @param {string} direction - 'darken' or 'lighten'
 * @returns {number} Adjusted value to apply
 * @private
 */
function calculateAdjustmentValue(currentValue, amount, direction) {
    if (amount >= 0 && amount <= 1) {
        // Factor-based adjustment
        if (direction === 'darken') {
            // amount = 0 means no change, amount = 1 means fully black
            return currentValue * amount;
        } else {
            // amount = 0 means no change, amount = 1 means fully white
            return (255 - currentValue) * amount;
        }
    } else {
        // Absolute value adjustment
        return amount;
    }
}

/**
 * Format RGB values to color string
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @param {number|null} opacity - Optional opacity (0-1)
 * @returns {string} Formatted color string (hex or rgba)
 * @private
 */
function formatColorOutput(r, g, b, opacity) {
    if (opacity !== null && opacity !== undefined) {
        const alpha = Math.max(0, Math.min(1, opacity));
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b)
        .toString(16)
        .slice(1)
        .toUpperCase();
}

/**
 * Adjust color brightness
 * @param {string} color - Color to adjust (hex, rgb, or named)
 * @param {number} amount - Adjustment amount
 * @param {number|null} opacity - Optional opacity (0-1)
 * @param {string} direction - 'darken' or 'lighten'
 * @returns {string} Adjusted color string
 * @private
 */
function adjustColorBrightness(color, amount, opacity, direction) {
    const { r, g, b } = parseColorToRgb(color);

    const adjustR = calculateAdjustmentValue(r, amount, direction);
    const adjustG = calculateAdjustmentValue(g, amount, direction);
    const adjustB = calculateAdjustmentValue(b, amount, direction);

    const newR = direction === 'darken'
        ? Math.max(0, Math.round(r - adjustR))
        : Math.min(255, Math.round(r + adjustR));

    const newG = direction === 'darken'
        ? Math.max(0, Math.round(g - adjustG))
        : Math.min(255, Math.round(g + adjustG));

    const newB = direction === 'darken'
        ? Math.max(0, Math.round(b - adjustB))
        : Math.min(255, Math.round(b + adjustB));

    return formatColorOutput(newR, newG, newB, opacity);
}

/**
 * Darkens a color by a specified amount with optional opacity
 * @param {string} color - The color to darken (hex, rgb, or named color)
 * @param {number} [amount=50] - The darkening amount. Can be:
 *   - Value > 1: absolute RGB value to subtract from each component (default: 50)
 *   - Value between 0-1: darkening factor where result = color * (1 - amount)
 *     (0 = no change, 1 = fully black, 0.5 = 50% of original brightness)
 * @param {number} [opacity] - Optional opacity value between 0-1. If provided, returns rgba() format, otherwise returns hex
 * @returns {string} The darkened color in hex format (if opacity not specified) or rgba() format
 */
export function darkenColor(color, amount = 50, opacity = null) {
    return adjustColorBrightness(color, amount, opacity, 'darken');
}

/**
 * Lightens a color by a specified amount with optional opacity
 * @param {string} color - The color to lighten (hex, rgb, or named color)
 * @param {number} [amount=50] - The lightening amount. Can be:
 *   - Value > 1: absolute RGB value to add to each component (default: 50)
 *   - Value between 0-1: lightening factor where result = color + (255 - color) * amount
 *     (0 = no change, 1 = fully white, 0.5 = halfway to white)
 * @param {number} [opacity] - Optional opacity value between 0-1. If provided, returns rgba() format, otherwise returns hex
 * @returns {string} The lightened color in hex format (if opacity not specified) or rgba() format
 */
export function lightenColor(color, amount = 50, opacity = null) {
    return adjustColorBrightness(color, amount, opacity, 'lighten');
}


export function generateUUID() {
    return crypto.randomUUID();
}

// Constants for AdvancedMarkerBoxSelector
const SELECTOR_CONSTANTS = {
    SELECTION_BOX_COLOR: '#4285F4',
    SELECTION_BOX_OPACITY: 0.15,
    SELECTION_BOX_BORDER_WIDTH: 2,
    SELECTED_MARKER_Z_INDEX: 1000,
    DEFAULT_MARKER_Z_INDEX: 1,
    INSTRUCTION_BACKGROUND: 'rgba(0, 0, 0, 0.8)',
    INSTRUCTION_PADDING: '12px 24px',
    INSTRUCTION_BORDER_RADIUS: '20px',
    INSTRUCTION_FONT_SIZE: '14px',
    OVERLAY_Z_INDEX: 999,
    INSTRUCTION_Z_INDEX: 10000,
};

/**
 * Advanced marker box selector for Google Maps
 * Allows users to select multiple markers by drawing a selection box while holding modifier keys
 *
 * @class AdvancedMarkerBoxSelector
 * @example
 * const selector = new AdvancedMarkerBoxSelector(map);
 * selector.onSelectionChange = (selectedMarkers) => {
 *   console.log('Selected markers:', selectedMarkers);
 * };
 * selector.addMarker(marker);
 */
export class AdvancedMarkerBoxSelector {
    /**
     * Creates an instance of AdvancedMarkerBoxSelector
     * @param {google.maps.Map} map - The Google Maps instance
     * @throws {Error} If map is not provided
     */
    constructor(map) {
        if (!map) {
            throw new Error('Map instance is required for AdvancedMarkerBoxSelector');
        }

        this.map = map;
        this.isDrawing = false;
        this.startX = null;
        this.startY = null;
        this.startLatLng = null;
        this.selectionDiv = null;
        this.selectedMarkers = new Set();
        this.allMarkers = new Set();
        this.onSelectionChange = null;
        this.selectionEnabled = false;

        // Track event listeners for cleanup
        this.eventListeners = [];

        this.init();
    }

    /**
     * Initializes the box selector with DOM elements and event listeners
     * @private
     */
    init() {
        // Get map container
        const mapDiv = this.map.getDiv();

        // Create selection box div
        this.selectionDiv = document.createElement('div');
        this.selectionDiv.className = 'google-map-box-selector';
        this.selectionDiv.style.cssText = `
      position: absolute;
      border: ${SELECTOR_CONSTANTS.SELECTION_BOX_BORDER_WIDTH}px dashed ${SELECTOR_CONSTANTS.SELECTION_BOX_COLOR};
      background: rgba(66, 133, 244, ${SELECTOR_CONSTANTS.SELECTION_BOX_OPACITY});
      display: none;
      pointer-events: none;
      z-index: ${SELECTOR_CONSTANTS.OVERLAY_Z_INDEX};
      top: 0;
      left: 0;
    `;

        // Create instruction overlay
        this.instructionDiv = document.createElement('div');
        this.instructionDiv.className = 'google-map-box-selector-instructions';
        this.instructionDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${SELECTOR_CONSTANTS.INSTRUCTION_BACKGROUND};
      color: white;
      padding: ${SELECTOR_CONSTANTS.INSTRUCTION_PADDING};
      border-radius: ${SELECTOR_CONSTANTS.INSTRUCTION_BORDER_RADIUS};
      font-size: ${SELECTOR_CONSTANTS.INSTRUCTION_FONT_SIZE};
      display: none;
      z-index: ${SELECTOR_CONSTANTS.INSTRUCTION_Z_INDEX};
      pointer-events: none;
    `;
        this.instructionDiv.textContent = _t('Selection Mode Active - Click and drag to select markers');

        // Append selection box to map div directly for proper positioning
        mapDiv.appendChild(this.selectionDiv);

        // Append instruction to body or map container
        const mapContainer = mapDiv.parentElement || document.body;
        mapContainer.appendChild(this.instructionDiv);

        // Create bound event handlers for proper cleanup
        this.handleKeyDown = (e) => {
            if ((e.altKey || e.metaKey) && !this.selectionEnabled) {
                this.enableSelectionMode();
            }

            // Cancel selection with Escape
            if (e.key === 'Escape' && this.isDrawing) {
                this.cancelSelection();
            }
        };

        this.handleKeyUp = (e) => {
            if (!e.altKey && !e.metaKey && this.selectionEnabled && !this.isDrawing) {
                this.disableSelectionMode();
            }
        };

        this.handleMouseDown = (e) => this.onMouseDown(e);
        this.handleMouseMove = (e) => this.onMouseMove(e);
        this.handleMouseUp = (e) => this.onMouseUp(e);
        this.handleTouchStart = (e) => this.onTouchStart(e);
        this.handleTouchMove = (e) => this.onTouchMove(e);
        this.handleTouchEnd = (e) => this.onTouchEnd(e);

        // Only add keyboard listeners initially
        // Mouse/touch listeners will be added dynamically when selection mode is enabled
        this.addEventListener(document, 'keydown', this.handleKeyDown);
        this.addEventListener(document, 'keyup', this.handleKeyUp);
    }

    /**
     * Enables selection mode and attaches mouse/touch event listeners
     * @private
     */
    enableSelectionMode() {
        if (this.selectionEnabled) return;

        this.selectionEnabled = true;
        const mapDiv = this.map.getDiv();

        // Tilt map to 0 to ensure accurate pixel-to-lat/lng conversion during selection
        if (this.map.getTilt() !== 0) {
            this.map.setTilt(0);
        }

        // Show instruction and change cursor
        this.instructionDiv.style.display = 'block';
        mapDiv.style.cursor = 'crosshair';

        // Add mouse/touch event listeners only when selection mode is active
        this.addEventListener(mapDiv, 'mousedown', this.handleMouseDown);
        this.addEventListener(document, 'mousemove', this.handleMouseMove);
        this.addEventListener(document, 'mouseup', this.handleMouseUp);

        // Touch events for mobile support
        this.addEventListener(mapDiv, 'touchstart', this.handleTouchStart, { passive: false });
        this.addEventListener(document, 'touchmove', this.handleTouchMove, { passive: false });
        this.addEventListener(document, 'touchend', this.handleTouchEnd);
    }

    /**
     * Disables selection mode and removes mouse/touch event listeners
     * @private
     */
    disableSelectionMode() {
        if (!this.selectionEnabled) return;

        this.selectionEnabled = false;
        const mapDiv = this.map.getDiv();

        // Hide instruction and restore cursor
        this.instructionDiv.style.display = 'none';
        mapDiv.style.cursor = '';

        // Remove mouse/touch event listeners to avoid interfering with normal interactions
        this.removeEventListener(mapDiv, 'mousedown', this.handleMouseDown);
        this.removeEventListener(document, 'mousemove', this.handleMouseMove);
        this.removeEventListener(document, 'mouseup', this.handleMouseUp);

        // Remove touch event listeners
        this.removeEventListener(mapDiv, 'touchstart', this.handleTouchStart);
        this.removeEventListener(document, 'touchmove', this.handleTouchMove);
        this.removeEventListener(document, 'touchend', this.handleTouchEnd);
    }

    /**
     * Adds event listener and tracks it for cleanup
     * @private
     * @param {EventTarget} target - The event target
     * @param {string} event - The event name
     * @param {Function} handler - The event handler
     * @param {Object} options - Event listener options
     */
    addEventListener(target, event, handler, options) {
        target.addEventListener(event, handler, options);
        this.eventListeners.push({ target, event, handler, options });
    }

    /**
     * Removes event listener and removes it from tracking
     * @private
     * @param {EventTarget} target - The event target
     * @param {string} event - The event name
     * @param {Function} handler - The event handler
     */
    removeEventListener(target, event, handler) {
        target.removeEventListener(event, handler);

        // Remove from tracking array
        this.eventListeners = this.eventListeners.filter(
            listener => !(listener.target === target &&
                         listener.event === event &&
                         listener.handler === handler)
        );
    }

    /**
     * Handles mouse down event to start box selection
     * @private
     * @param {MouseEvent} e - The mouse event
     */
    onMouseDown(e) {
        // Only left click
        if (e.button !== 0) return;

        // Don't start if clicking on Google Maps controls or markers
        const target = e.target;
        if (target.closest('.gm-control-active') ||
            target.closest('.marker-pin') ||
            target.closest('.gm-style-mtc')) return;

        this.startSelection(e.clientX, e.clientY, e);
    }

    /**
     * Handles touch start event for mobile devices
     * @private
     * @param {TouchEvent} e - The touch event
     */
    onTouchStart(e) {
        // Only process single touch
        if (e.touches.length !== 1) return;

        // Don't start if touching on controls or marker
        const target = e.target;
        if (target.closest('.gm-control-active') ||
            target.closest('.marker-pin') ||
            target.closest('.gm-style-mtc')) return;

        const touch = e.touches[0];
        this.startSelection(touch.clientX, touch.clientY, e);
    }

    /**
     * Starts the box selection
     * @private
     * @param {number} clientX - X coordinate
     * @param {number} clientY - Y coordinate
     * @param {Event} e - Original event
     */
    startSelection(clientX, clientY, e) {
        // Get map div reference
        const mapDiv = this.map.getDiv();

        // Prevent default to avoid map panning during selection
        e.preventDefault();
        e.stopPropagation();

        this.isDrawing = true;

        // Get map bounding rect for coordinate conversion
        const rect = mapDiv.getBoundingClientRect();

        // Store both client coordinates and map-relative coordinates
        this.startX = clientX;
        this.startY = clientY;
        this.startMapX = clientX - rect.left;
        this.startMapY = clientY - rect.top;

        // Convert pixel to lat/lng
        const bounds = this.map.getBounds();
        if (!bounds) {
            this.isDrawing = false;
            return;
        }

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const x = this.startMapX / rect.width;
        const y = this.startMapY / rect.height;

        this.startLatLng = {
            lat: sw.lat() + (ne.lat() - sw.lat()) * (1 - y),
            lng: sw.lng() + (ne.lng() - sw.lng()) * x,
        };

        // Show selection box at map-relative coordinates
        this.selectionDiv.style.left = this.startMapX + 'px';
        this.selectionDiv.style.top = this.startMapY + 'px';
        this.selectionDiv.style.width = '0px';
        this.selectionDiv.style.height = '0px';
        this.selectionDiv.style.display = 'block';

        // Disable map dragging only during selection
        this.map.setOptions({
            gestureHandling: 'none',
        });
    }

    /**
     * Handles mouse move event to update selection box
     * @private
     * @param {MouseEvent} e - The mouse event
     */
    onMouseMove(e) {
        if (!this.isDrawing) return;
        this.updateSelectionBox(e.clientX, e.clientY);
    }

    /**
     * Handles touch move event for mobile devices
     * @private
     * @param {TouchEvent} e - The touch event
     */
    onTouchMove(e) {
        if (!this.isDrawing || e.touches.length !== 1) return;
        const touch = e.touches[0];
        this.updateSelectionBox(touch.clientX, touch.clientY);
        // Only prevent default during active drawing
        if (this.isDrawing) {
            e.preventDefault();
        }
    }

    /**
     * Updates the selection box dimensions
     * @private
     * @param {number} clientX - Current X coordinate
     * @param {number} clientY - Current Y coordinate
     */
    updateSelectionBox(clientX, clientY) {
        // Convert client coordinates to map-relative coordinates
        const mapDiv = this.map.getDiv();
        const rect = mapDiv.getBoundingClientRect();
        const currentMapX = clientX - rect.left;
        const currentMapY = clientY - rect.top;

        // Calculate box dimensions using map-relative coordinates
        const left = Math.min(this.startMapX, currentMapX);
        const top = Math.min(this.startMapY, currentMapY);
        const width = Math.abs(currentMapX - this.startMapX);
        const height = Math.abs(currentMapY - this.startMapY);

        this.selectionDiv.style.left = left + 'px';
        this.selectionDiv.style.top = top + 'px';
        this.selectionDiv.style.width = width + 'px';
        this.selectionDiv.style.height = height + 'px';
    }

    /**
     * Handles mouse up event to complete selection
     * @private
     * @param {MouseEvent} e - The mouse event
     */
    onMouseUp(e) {
        if (!this.isDrawing) return;
        this.endSelection(e.clientX, e.clientY, e.shiftKey);
    }

    /**
     * Handles touch end event for mobile devices
     * @private
     * @param {TouchEvent} e - The touch event
     */
    onTouchEnd(e) {
        if (!this.isDrawing) return;
        // Use the last known position from touchmove
        const touch = e.changedTouches[0];
        this.endSelection(touch.clientX, touch.clientY, false);
    }

    /**
     * Completes the selection process
     * @private
     * @param {number} clientX - End X coordinate
     * @param {number} clientY - End Y coordinate
     * @param {boolean} addToSelection - Whether to add to existing selection
     */
    endSelection(clientX, clientY, addToSelection) {
        this.isDrawing = false;
        this.selectionDiv.style.display = 'none';

        // Re-enable map
        this.map.setOptions({
            gestureHandling: 'auto',
        });

        // Calculate end lat/lng
        const bounds = this.map.getBounds();
        if (!bounds) return;

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const mapDiv = this.map.getDiv();
        const rect = mapDiv.getBoundingClientRect();

        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;

        const endLatLng = {
            lat: sw.lat() + (ne.lat() - sw.lat()) * (1 - y),
            lng: sw.lng() + (ne.lng() - sw.lng()) * x,
        };

        // Create selection bounds
        const selectionBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(
                Math.min(this.startLatLng.lat, endLatLng.lat),
                Math.min(this.startLatLng.lng, endLatLng.lng)
            ),
            new google.maps.LatLng(
                Math.max(this.startLatLng.lat, endLatLng.lat),
                Math.max(this.startLatLng.lng, endLatLng.lng)
            )
        );

        // Select markers (Shift key adds to selection)
        this.selectMarkersInBounds(selectionBounds, addToSelection);
    }

    /**
     * Selects markers within the given bounds
     * @private
     * @param {google.maps.LatLngBounds} bounds - The selection bounds
     * @param {boolean} addToSelection - Whether to add to existing selection or replace it
     */
    selectMarkersInBounds(bounds, addToSelection) {
        // Clear previous selection unless Shift is held
        if (!addToSelection) {
            this.clearSelection(true); // Don't trigger callback yet
        }

        let newSelections = 0;

        this.allMarkers.forEach((marker) => {
            try {
                // Advanced Marker uses .position property
                const position = marker.position;
                if (!position) return;

                const latLng = new google.maps.LatLng(position.lat, position.lng);

                if (bounds.contains(latLng)) {
                    if (!this.selectedMarkers.has(marker)) {
                        this.selectedMarkers.add(marker);
                        this.highlightMarker(marker, true);
                        newSelections++;
                    }
                }
            } catch (error) {
                console.warn('Error selecting marker:', error);
            }
        });

        // Trigger callback after all selections are complete
        if (this.onSelectionChange && typeof this.onSelectionChange === 'function') {
            this.onSelectionChange(Array.from(this.selectedMarkers));
        }
    }

    /**
     * Highlights or unhighlights a marker
     * @private
     * @param {google.maps.marker.AdvancedMarkerElement} marker - The marker to highlight
     * @param {boolean} selected - Whether to highlight or unhighlight
     */
    highlightMarker(marker, selected) {
        try {
            const content = marker.content;
            if (!content || !content.classList) return;

            if (selected) {
                content.classList.add('selected');
                marker.zIndex = SELECTOR_CONSTANTS.SELECTED_MARKER_Z_INDEX;
            } else {
                content.classList.remove('selected');
                marker.zIndex = SELECTOR_CONSTANTS.DEFAULT_MARKER_Z_INDEX;
            }
        } catch (error) {
            console.warn('Error highlighting marker:', error);
        }
    }

    /**
     * Clears the current selection
     * @param {boolean} noTrigger - Whether to skip triggering the callback
     */
    clearSelection(noTrigger = false) {
        this.selectedMarkers.forEach((marker) => {
            this.highlightMarker(marker, false);
        });
        this.selectedMarkers.clear();

        if (this.onSelectionChange && !noTrigger && typeof this.onSelectionChange === 'function') {
            this.onSelectionChange([]);
        }
    }

    /**
     * Cancels an ongoing selection
     */
    cancelSelection() {
        this.isDrawing = false;
        this.selectionDiv.style.display = 'none';
        this.map.setOptions({
            gestureHandling: 'auto',
        });
    }

    /**
     * Adds a marker to the tracking set
     * @param {google.maps.marker.AdvancedMarkerElement} marker - The marker to track
     */
    addMarker(marker) {
        if (marker) {
            this.allMarkers.add(marker);
        }
    }

    /**
     * Removes a marker from the tracking set
     * @param {google.maps.marker.AdvancedMarkerElement} marker - The marker to remove
     */
    removeMarker(marker) {
        this.allMarkers.delete(marker);

        // Also remove from selected markers if present
        if (this.selectedMarkers.has(marker)) {
            this.selectedMarkers.delete(marker);
            if (this.onSelectionChange && typeof this.onSelectionChange === 'function') {
                this.onSelectionChange(Array.from(this.selectedMarkers));
            }
        }
    }

    /**
     * Removes all markers from the tracking set
     */
    clearMarkers() {
        this.allMarkers = new Set();
        this.clearSelection();
    }

    /**
     * Gets all selected markers
     * @returns {Array<google.maps.marker.AdvancedMarkerElement>} Array of selected markers
     */
    getSelectedMarkers() {
        return Array.from(this.selectedMarkers);
    }

    /**
     * Programmatically sets the selected markers
     * @param {Array<google.maps.marker.AdvancedMarkerElement>} markers - Markers to select
     */
    setSelectedMarkers(markers) {
        this.clearSelection(true);

        markers.forEach((marker) => {
            if (this.allMarkers.has(marker)) {
                this.selectedMarkers.add(marker);
                this.highlightMarker(marker, true);
            }
        });

        if (this.onSelectionChange && typeof this.onSelectionChange === 'function') {
            this.onSelectionChange(Array.from(this.selectedMarkers));
        }
    }

    /**
     * Toggles the selection state of a marker
     * @param {google.maps.marker.AdvancedMarkerElement} marker - Marker to toggle
     */
    toggleMarkerSelection(marker) {
        if (!this.allMarkers.has(marker)) return;

        if (this.selectedMarkers.has(marker)) {
            this.selectedMarkers.delete(marker);
            this.highlightMarker(marker, false);
        } else {
            this.selectedMarkers.add(marker);
            this.highlightMarker(marker, true);
        }

        if (this.onSelectionChange && typeof this.onSelectionChange === 'function') {
            this.onSelectionChange(Array.from(this.selectedMarkers));
        }
    }

    /**
     * Enables or disables selection mode
     * @param {boolean} enabled - Whether to enable selection mode
     */
    setSelectionEnabled(enabled) {
        if (enabled) {
            this.enableSelectionMode();
        } else {
            this.disableSelectionMode();
        }
    }

    /**
     * Cleans up the selector by removing event listeners and DOM elements
     */
    destroy() {
        // Remove all event listeners
        this.eventListeners.forEach(({ target, event, handler, options }) => {
            target.removeEventListener(event, handler, options);
        });
        this.eventListeners = [];

        // Remove DOM elements
        if (this.selectionDiv && this.selectionDiv.parentNode) {
            this.selectionDiv.parentNode.removeChild(this.selectionDiv);
        }
        if (this.instructionDiv && this.instructionDiv.parentNode) {
            this.instructionDiv.parentNode.removeChild(this.instructionDiv);
        }

        // Clear references
        this.selectedMarkers.clear();
        this.allMarkers = new Set();
        this.map = null;
    }
}
