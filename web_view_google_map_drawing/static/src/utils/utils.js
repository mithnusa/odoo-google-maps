/**
 * @fileoverview Terra Draw Utility Functions
 *
 * Shared utility functions for Terra Draw integration across the application.
 * This module contains common functionality used by both the editable Terra Draw UI
 * and the readonly Terra Draw renderer.
 *
 * Key Features:
 * - Asset loading for Terra Draw, Deck.gl, and Turf.js
 * - GeoJSON validation
 * - Coordinate normalization
 * - Area calculation using Turf.js
 * - Measurement formatting
 *
 * @author Yopi Angi - https://github.com/gityopie
 * @version 1.0.0
 */

import { loadJS } from '@web/core/assets';
import { formatNumber } from '@web_view_google_map/views/google_map/utils';

export const TERRA_DRAW_CONFIG = {
    COORDINATE_PRECISION: 9,
    SAVE_DEBOUNCE_DELAY: 3000,
    // Delay after addFeatures during a full data reload. Must exceed the
    // onDrawChange debounce (500 ms) because loadRecordData does not cancel
    // it before calling addFeatures.
    RESTORE_DELAY: 500,
    // Delay after addFeatures during undo/redo. onDrawChange's debounce is
    // always cancelled before _restoreSnapshot is called (see _actionUndo /
    // _actionRedo), so this only needs to cover Terra Draw's adapter
    // microtask queue — 100 ms is sufficient for that.
    UNDO_RESTORE_DELAY: 100,
    FALLBACK_TIMEOUT: 2000,
};

export const COLOR_PALETTE = [
    '#E74C3C', // Red
    '#F39C12', // Yellow-Orange
    '#673AB7', // Deep Purple
    '#3F51B5', // Indigo
    '#3498DB', // Blue
    '#00BCD4', // Cyan
    '#009688', // Teal
    '#8BC34A', // Light Green
    '#F1C40F', // Yellow
    '#F39C12', // Orange
    '#FF5722', // Deep Orange
    '#795548', // Brown
];

/**
 * Configuration for measurement calculations and display
 * Supports both metric and imperial unit systems with appropriate precision
 */
export const MEASUREMENT_CONFIG = {
    EARTH_RADIUS_KM: 6371, // Earth radius in kilometers
    EARTH_RADIUS_MILES: 3959, // Earth radius in miles
    UNITS: {
        METRIC: 'metric', // Metric system (km, m, ha, sq km)
        IMPERIAL: 'imperial', // Imperial system (mi, ft, ac, sq mi)
    },
    DISTANCE_PRECISION: 2, // Decimal places for distance measurements
    AREA_PRECISION: 2, // Decimal places for area measurements
    COORDINATE_PRECISION: 6, // Decimal places for coordinate display
};

const TERRA_DRAW_VERSION = '1.32.3';
const TERRA_DRAW_GMAPS_ADAPTER_VERSION = '1.6.1';
const TURF_JS_VERSION = '7.4.0';
const DECK_GL_VERSION = '9.3.10';

/**
 * Load Terra Draw library assets
 */
export async function loadTerraDrawAssets() {
    if (window.terraDraw && window.terraDrawGoogleMapsAdapter) {
        return;
    }
    try {
        await loadJS('/web_view_google_map_drawing/static/lib/terra-draw/terra-draw.umd.js?v=' + TERRA_DRAW_VERSION);
        await loadJS(
            '/web_view_google_map_drawing/static/lib/terra-draw/terra-draw-google-maps-adapter.umd.js?v=' +
                TERRA_DRAW_GMAPS_ADAPTER_VERSION
        );
        if (!window.terraDraw || !window.terraDrawGoogleMapsAdapter) {
            throw new Error('Terra Draw or its Google Maps adapter failed to load correctly.');
        }
    } catch (error) {
        console.error('Error loading Terra Draw assets:', error);
        throw new Error('Failed to load Terra Draw assets: ' + error.message);
    }
}

export async function loadDeckGlAssets() {
    if (window.deck) {
        return;
    }
    try {
        await loadJS('/web_view_google_map_drawing/static/lib/deckgl/dist.min.js?v=' + DECK_GL_VERSION);
        if (!window.deck) {
            throw new Error('Deck.gl failed to load correctly.');
        }
    } catch (error) {
        console.error('Error loading Deck.gl assets:', error);
        throw new Error('Failed to load Deck.gl assets: ' + error.message);
    }
}

export async function loadTurfJSAssets() {
    if (window.turf) {
        return;
    }
    try {
        await loadJS('/web_view_google_map_drawing/static/lib/turf/turf.min.js?v=' + TURF_JS_VERSION);
        if (!window.turf) {
            throw new Error('Turf.js failed to load correctly.');
        }
    } catch (error) {
        console.error('Error loading Turf.js:', error);
        throw new Error('Failed to load Turf.js: ' + error.message);
    }
}

/**
 * Normalize coordinates to remove excessive precision
 * @param {Array} coordinates - Coordinate array to normalize
 * @param {number} precision - Number of decimal places (default: 9)
 * @returns {Array} - Normalized coordinates
 */
export function normalizeCoordinates(coordinates, precision = 9) {
    if (!Array.isArray(coordinates)) return coordinates;

    return coordinates.map((coord) => {
        if (Array.isArray(coord)) {
            return normalizeCoordinates(coord, precision);
        } else if (typeof coord === 'number') {
            return parseFloat(coord.toFixed(precision));
        }
        return coord;
    });
}

export function getRandomColor() {
    const randomIndex = Math.floor(Math.random() * COLOR_PALETTE.length);
    return COLOR_PALETTE[randomIndex];
}

/**
 * Format point count with appropriate singular/plural form
 * @param {number} count - The number of points
 * @returns {string} Formatted point count string
 */
export function formatPointCount(count) {
    return `${formatNumber(count, 0)} ${count === 1 ? 'point' : 'points'}`;
}

/**
 * Format area measurement with appropriate unit based on size and unit system
 * Supports both metric (m², ha, km²) and imperial (sq ft, ac, sq mi) units
 * @param {number} areaInSquareMeter - Area value in square meters
 * @param {string} locale - Locale for number formatting (default: 'en-US')
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {string} unitSystem - Unit system to use: 'metric' or 'imperial' (default: 'metric')
 * @returns {string} Formatted area string with appropriate unit
 */
export function formatAreaMeasurement(
    areaInSquareMeter,
    locale = 'en-US',
    decimals = 2,
    unitSystem = MEASUREMENT_CONFIG.UNITS.METRIC
) {
    if (!Number.isFinite(areaInSquareMeter)) {
        console.warn('Invalid area provided for formatting:', areaInSquareMeter);
        return areaInSquareMeter;
    }

    let area = areaInSquareMeter;
    let unit = 'm²';

    if (unitSystem === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
        // Imperial unit conversions
        // 1 acre = 4046.86 m², 1 sq mi = 2589988.11 m², 1 sq ft = 0.092903 m²
        const SQ_METER_TO_SQ_FEET = 10.7639;
        const SQ_METER_TO_ACRES = 0.000247105;
        const SQ_METER_TO_SQ_MILES = 0.000000386102;
        const ACRES_PER_SQ_MILE = 640;

        if (areaInSquareMeter >= ACRES_PER_SQ_MILE / SQ_METER_TO_ACRES) {
            // Use square miles for large areas (>= 640 acres)
            area = areaInSquareMeter * SQ_METER_TO_SQ_MILES;
            unit = 'mi²';
        } else if (areaInSquareMeter >= 1 / SQ_METER_TO_ACRES) {
            // Use acres for medium areas (>= 1 acre)
            area = areaInSquareMeter * SQ_METER_TO_ACRES;
            unit = 'ac';
        } else {
            // Use square feet for small areas
            area = areaInSquareMeter * SQ_METER_TO_SQ_FEET;
            unit = 'ft²';
        }
    } else {
        // Metric unit conversions
        if (areaInSquareMeter >= 1000000) {
            area = areaInSquareMeter / 1000000;
            unit = 'km²';
        } else if (areaInSquareMeter >= 10000) {
            area = areaInSquareMeter / 10000;
            unit = 'ha';
        }
    }

    const value = formatNumber(area, decimals, locale);

    return `${value} ${unit}`;
}

/**
 * Format length measurement with appropriate unit based on distance and unit system
 * Supports both metric (cm, m, km) and imperial (in, ft, yd, mi) units
 * @param {number} lengthInKilometers - Length value in kilometers
 * @param {string} locale - Locale for number formatting (default: 'en-US')
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {string} unitSystem - Unit system to use: 'metric' or 'imperial' (default: 'metric')
 * @returns {string} Formatted length string with appropriate unit
 */
export function formatLengthMeasurement(
    lengthInKilometers,
    locale = 'en-US',
    decimals = 2,
    unitSystem = MEASUREMENT_CONFIG.UNITS.METRIC
) {
    if (!Number.isFinite(lengthInKilometers)) {
        console.warn('Invalid length provided for formatting:', lengthInKilometers);
        return lengthInKilometers;
    }

    let length = lengthInKilometers;
    let unit = 'km';

    if (unitSystem === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
        // Imperial unit conversions from kilometers
        // 1 km = 0.621371 mi, 1 km = 1093.61 yd, 1 km = 3280.84 ft, 1 km = 39370.1 in
        const KM_TO_INCHES = 39370.1;
        const KM_TO_FEET = 3280.84;
        const KM_TO_YARDS = 1093.61;
        const KM_TO_MILES = 0.621371;

        if (lengthInKilometers >= 1.60934) {
            // Use miles for long distances (>= 1 mile, which is ~1.609 km)
            length = lengthInKilometers * KM_TO_MILES;
            unit = 'mi';
        } else if (lengthInKilometers >= 0.0009144) {
            // Use yards for medium distances (>= 1 yard, which is ~0.0009144 km)
            length = lengthInKilometers * KM_TO_YARDS;
            unit = 'yd';
        } else if (lengthInKilometers >= 0.0003048) {
            // Use feet for shorter distances (>= 1 foot, which is ~0.0003048 km)
            length = lengthInKilometers * KM_TO_FEET;
            unit = 'ft';
        } else {
            // Use inches for very short distances
            length = lengthInKilometers * KM_TO_INCHES;
            unit = 'in';
        }
    } else {
        // Metric unit conversions
        if (lengthInKilometers >= 1) {
            // Use kilometers for long distances
            length = lengthInKilometers;
            unit = 'km';
        } else if (lengthInKilometers >= 0.001) {
            // Use meters for medium distances (>= 1 meter, which is 0.001 km)
            length = lengthInKilometers * 1000;
            unit = 'm';
        } else {
            // Use centimeters for short distances (< 1 meter)
            length = lengthInKilometers * 100000;
            unit = 'cm';
        }
    }

    const value = formatNumber(length, decimals, locale);

    return `${value} ${unit}`;
}

/**
 * Validate geometry coordinates based on geometry type
 * @param {string} type - Geometry type
 * @param {Array} coordinates - Coordinate array
 * @returns {boolean} True if coordinates are valid for the geometry type
 * @private
 */
function validateGeometryCoordinates(type, coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return false;
    }

    switch (type) {
        case 'Point':
            // Point: [lon, lat] or [lon, lat, elevation]
            return (
                coordinates.length >= 2 &&
                coordinates.length <= 3 &&
                coordinates.every((n) => typeof n === 'number' && isFinite(n))
            );

        case 'LineString':
        case 'MultiPoint':
            // LineString/MultiPoint: array of positions (at least 2 for LineString)
            const minLength = type === 'LineString' ? 2 : 1;
            return (
                coordinates.length >= minLength &&
                coordinates.every(
                    (pos) =>
                        Array.isArray(pos) && pos.length >= 2 && pos.every((n) => typeof n === 'number' && isFinite(n))
                )
            );

        case 'Polygon':
        case 'MultiLineString':
            // Polygon/MultiLineString: array of LineString coordinates
            return coordinates.every((ring) => {
                const isValid =
                    Array.isArray(ring) &&
                    ring.length >= (type === 'Polygon' ? 4 : 2) &&
                    ring.every(
                        (pos) =>
                            Array.isArray(pos) &&
                            pos.length >= 2 &&
                            pos.every((n) => typeof n === 'number' && isFinite(n))
                    );

                // For Polygon, verify ring closure (first point === last point)
                if (type === 'Polygon' && isValid) {
                    const first = ring[0];
                    const last = ring[ring.length - 1];
                    return first[0] === last[0] && first[1] === last[1];
                }

                return isValid;
            });

        case 'MultiPolygon':
            // MultiPolygon: array of Polygon coordinates
            return coordinates.every(
                (polygon) =>
                    Array.isArray(polygon) &&
                    polygon.every(
                        (ring) =>
                            Array.isArray(ring) &&
                            ring.length >= 4 &&
                            ring.every(
                                (pos) =>
                                    Array.isArray(pos) &&
                                    pos.length >= 2 &&
                                    pos.every((n) => typeof n === 'number' && isFinite(n))
                            )
                    )
            );

        default:
            return false;
    }
}

/**
 * Validate GeoJSON object structure
 * Supports all GeoJSON types: FeatureCollection, Feature, and Geometry objects
 * @param {Object} geoJson - The GeoJSON object to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.requireFeatures - Whether to require at least one feature (default: false)
 * @param {boolean} options.validateGeometry - Whether to validate geometry structure (default: false)
 * @param {boolean} options.strict - Whether to enforce strict GeoJSON spec (default: false)
 * @returns {boolean} True if valid GeoJSON structure
 */
export function validateGeoJson(geoJson, options = {}) {
    const { requireFeatures = false, validateGeometry = false, strict = false } = options;

    // Null/undefined check
    if (!geoJson || typeof geoJson !== 'object') {
        return false;
    }

    // Valid GeoJSON types
    const validTypes = [
        'FeatureCollection',
        'Feature',
        'Point',
        'LineString',
        'Polygon',
        'MultiPoint',
        'MultiLineString',
        'MultiPolygon',
        'GeometryCollection',
    ];

    // Check if type is valid
    if (!validTypes.includes(geoJson.type)) {
        return false;
    }

    // Validate FeatureCollection
    if (geoJson.type === 'FeatureCollection') {
        if (!Array.isArray(geoJson.features)) {
            return false;
        }

        // Optional: require at least one feature
        if (requireFeatures && geoJson.features.length === 0) {
            return false;
        }

        // Optional: validate each feature
        if (validateGeometry && geoJson.features.length > 0) {
            return geoJson.features.every((feature) => validateGeoJson(feature, { validateGeometry: true, strict }));
        }

        return true;
    }

    // Validate Feature
    if (geoJson.type === 'Feature') {
        // Feature must have geometry (can be null per spec)
        if (!('geometry' in geoJson)) {
            return false;
        }

        // Geometry can be null (valid per GeoJSON spec)
        if (geoJson.geometry === null) {
            return !strict; // In strict mode, reject null geometries
        }

        // Validate geometry if present and validation enabled
        if (validateGeometry && geoJson.geometry) {
            return validateGeoJson(geoJson.geometry, { validateGeometry: true, strict });
        }

        return true;
    }

    // Validate Geometry objects (Point, LineString, Polygon, etc.)
    if (validTypes.slice(2).includes(geoJson.type)) {
        // All geometry objects must have coordinates (except GeometryCollection)
        if (geoJson.type === 'GeometryCollection') {
            if (!Array.isArray(geoJson.geometries)) {
                return false;
            }

            if (validateGeometry) {
                return geoJson.geometries.every((geom) => validateGeoJson(geom, { validateGeometry: true, strict }));
            }

            return true;
        }

        // Check coordinates exist
        if (!('coordinates' in geoJson)) {
            return false;
        }

        if (!Array.isArray(geoJson.coordinates)) {
            return false;
        }

        // Optional: validate coordinate structure
        if (validateGeometry) {
            return validateGeometryCoordinates(geoJson.type, geoJson.coordinates);
        }

        return true;
    }

    return false;
}

/**
 * Calculate area of a polygon or multipolygon feature using Turf.js
 * Supports both Polygon and MultiPolygon geometry types
 * @param {Object} feature - GeoJSON Feature with Polygon or MultiPolygon geometry
 * @returns {number} Area in square meters, or 0 if calculation fails
 */
export function calculateArea(feature) {
    if (!feature || !feature.geometry || !window.turf) {
        return 0;
    }

    const { type } = feature.geometry;

    // Only calculate area for polygon types
    if (!['Polygon', 'MultiPolygon'].includes(type)) {
        return 0;
    }

    try {
        // turf.area() accepts GeoJSON Feature directly
        return window.turf.area(feature);
    } catch (error) {
        console.error('turf.area calculation failed:', error);
        return 0;
    }
}

/**
 * Calculate total area of multiple polygon features using Turf.js
 * Filters and sums areas of all Polygon and MultiPolygon features
 * @param {Array<Object>} features - Array of GeoJSON Features
 * @returns {number} Total area in square meters
 */
export function calculateFeaturesTotalArea(features) {
    if (!features || !Array.isArray(features) || features.length === 0) {
        return 0;
    }

    return features.reduce((totalArea, feature) => {
        // Skip features without valid geometry
        if (!feature?.geometry?.type) {
            return totalArea;
        }

        const area = calculateArea(feature);
        if (Number.isFinite(area)) {
            return totalArea + area;
        }

        return totalArea;
    }, 0); // in square meters
}

/**
 * Generate a lightweight fingerprint for a features array
 * Captures geometry types, IDs, and coordinate counts without full serialization
 * @param {Array} features - Array of GeoJSON features
 * @returns {string} Fingerprint string
 */
function getGeoJsonFingerprint(features) {
    let fingerprint = '';
    for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        const id = feature.id || feature.properties?.id || i;
        const geomType = feature.geometry?.type || 'null';
        const coordCount = countCoordinates(feature.geometry?.coordinates);
        fingerprint += `${id}:${geomType}:${coordCount};`;
    }
    return fingerprint;
}

/**
 * Count total coordinates in a geometry
 * @param {Array} coordinates - GeoJSON coordinates array
 * @returns {number} Total coordinate count
 */
function countCoordinates(coordinates) {
    if (!coordinates) return 0;
    if (typeof coordinates[0] === 'number') {
        // Single coordinate [lng, lat] or [lng, lat, alt]
        return 1;
    }
    let count = 0;
    for (const coord of coordinates) {
        count += countCoordinates(coord);
    }
    return count;
}

/**
 * Check if GeoJSON data has changed using lightweight comparison
 * Avoids expensive JSON.stringify for large datasets
 * @param {Object} current - Current GeoJSON data
 * @param {Object} next - Next GeoJSON data
 * @returns {boolean} True if data has changed
 */
export function hasGeoJsonChanged(current, next) {
    // Reference equality - fastest check
    if (current === next) {
        return false;
    }

    // Handle null/undefined cases
    if (!current || !next) {
        return current !== next;
    }

    // Check features array reference
    if (current.features === next.features) {
        return false;
    }

    // Handle missing features
    if (!current.features || !next.features) {
        return true;
    }

    // Quick count check
    if (current.features.length !== next.features.length) {
        return true;
    }

    // Empty arrays are equal
    if (current.features.length === 0) {
        return false;
    }

    // Compare feature fingerprints (geometry type + coordinate structure)
    const currentFingerprint = getGeoJsonFingerprint(current.features);
    const nextFingerprint = getGeoJsonFingerprint(next.features);

    return currentFingerprint !== nextFingerprint;
}
