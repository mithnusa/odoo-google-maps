/**
 * @fileoverview Terra Draw Utility Functions
 *
 * Shared utility functions for Terra Draw integration across the application.
 * This module contains common functionality used by both the editable Terra Draw UI
 * and the readonly Terra Draw renderer.
 *
 * Key Features:
 * - Feature validation and proces        default:
            return {
                fillColor: color,
                fillOpacity: TERRA_DRAW_DEFAULT_CONFIG.defaultFillOpacity,
                outlineColor: color,
                outlineWidth: TERRA_DRAW_DEFAULT_CONFIG.defaultOutlineWidth,
            }; - UUID generation compatible with Terra Draw
 * - Coordinate normalization
 * - MultiPolygon processing and splitting
 * - Feature structure creation and validation
 * - Terra Draw compatibility utilities
 *
 * @author Yan - https://github.com/yan
 * @version 1.0.0
 * @requires Terra Draw Library
 */

import { loadJS } from '@web/core/assets';
import { formatNumber, generateUUID } from '@web_view_google_map/views/google_map/utils';

/**
 * Terra Draw mode mapping
 */
export const TERRA_DRAW_MODE_MAP = {
    Point: 'point',
    LineString: 'linestring',
    Polygon: 'polygon',
    Circle: 'circle',
    Rectangle: 'rectangle',
    MultiPoint: 'point',
    MultiLineString: 'linestring',
    MultiPolygon: 'polygon',
};

/**
 * Default Terra Draw configuration
 */
export const TERRA_DRAW_DEFAULT_CONFIG = {
    coordinatePrecision: 10,
    defaultFillOpacity: 0.3,
    // Default outline width
    defaultOutlineWidth: 0.2,
    uuidVersion: 4,
};

export const TERRA_DRAW_CONFIG = {
    COORDINATE_PRECISION: 9,
    SAVE_DEBOUNCE_DELAY: 3000,
    RESTORE_DELAY: 500,
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

/**
 * Load Terra Draw library assets
 */
export async function loadTerraDrawAssets() {
    if (window.terraDraw && window.terraDrawGoogleMapsAdapter) {
        return;
    }
    try {
        await loadJS('https://unpkg.com/terra-draw@1.19.0/dist/terra-draw.umd.js');
        await loadJS('https://unpkg.com/terra-draw-google-maps-adapter@1.1.0/dist/terra-draw-google-maps-adapter.umd.js');
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
        await loadJS('https://unpkg.com/deck.gl@9.2.2/dist.min.js');
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
        await loadJS('https://unpkg.com/@turf/turf@7.3.0/turf.min.js');
        if (!window.turf) {
            throw new Error('Turf.js failed to load correctly.');
        }
    } catch (error) {
        console.error('Error loading Turf.js:', error);
        throw new Error('Failed to load Turf.js: ' + error.message);
    }
}

/**
 * Validate if a feature meets Terra Draw requirements
 * @param {Object} feature - Feature to validate
 * @returns {boolean} - True if valid
 */
export function validateTerraDrawFeature(feature) {
    if (!feature) return false;

    // Check required GeoJSON structure
    if (!feature.type || feature.type !== 'Feature') {
        console.error('Missing or invalid type:', feature.type);
        return false;
    }

    if (!feature.id || typeof feature.id !== 'string') {
        console.error('Missing or invalid id:', feature.id);
        return false;
    }

    if (!feature.geometry || !feature.geometry.type || !feature.geometry.coordinates) {
        console.error('Missing or invalid geometry:', feature.geometry);
        return false;
    }

    if (!feature.properties || typeof feature.properties !== 'object') {
        console.error('Missing or invalid properties:', feature.properties);
        return false;
    }

    // Check Terra Draw specific requirements
    if (!feature.properties.mode || typeof feature.properties.mode !== 'string') {
        console.error('Missing mode property:', feature.properties.mode);
        return false;
    }

    return true;
}

/**
 * Normalize coordinates to remove excessive precision
 * @param {Array} coordinates - Coordinate array to normalize
 * @param {number} precision - Number of decimal places (default: 10)
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

/**
 * Process complex MultiPolygon by splitting into individual polygons
 * @param {Object} multiPolygonFeature - Original MultiPolygon feature
 * @param {string} color - Color for the features
 * @param {boolean} isReadonly - Whether features should be readonly
 * @returns {Array} - Array of individual polygon features
 */
export function processComplexMultiPolygon(multiPolygonFeature, color, isReadonly = false) {
    const polygonFeatures = [];
    const coordinates = multiPolygonFeature.geometry.coordinates;

    coordinates.forEach((polygonCoords, index) => {
        // Create individual polygon feature
        const polygonFeature = {
            type: 'Feature',
            id: generateUUID(), // Generate Terra Draw compatible UUID
            geometry: {
                type: 'Polygon',
                coordinates: normalizeCoordinates(polygonCoords),
            },
            properties: {
                ...multiPolygonFeature.properties,
                mode: 'polygon',
                originalFeatureId: multiPolygonFeature.id,
                partIndex: index,
                totalParts: coordinates.length,
            },
        };

        polygonFeatures.push(polygonFeature);
    });

    return polygonFeatures;
}

/**
 * Create Terra Draw compatible feature from GeoJSON feature
 * @param {Object} feature - Original GeoJSON feature
 * @param {string} color - Color for the feature
 * @param {boolean} isReadonly - Whether feature should be readonly
 * @returns {Object} - Terra Draw compatible feature
 */
export function createTerraDrawFeature(feature, color, isReadonly = false) {
    const geometry = feature.geometry;

    // Normalize coordinates
    const normalizedGeometry = {
        ...geometry,
        coordinates: normalizeCoordinates(geometry.coordinates),
    };

    // Generate Terra Draw compatible UUID if no ID exists
    const featureId = feature.id || generateUUID();

    // Determine Terra Draw mode based on geometry type
    const modeMap = {
        Point: 'point',
        LineString: 'linestring',
        Polygon: 'polygon',
        Circle: 'circle',
        Rectangle: 'rectangle',
    };

    const mode = modeMap[geometry.type] || 'polygon';

    // Create Terra Draw feature
    const terraDrawFeature = {
        type: 'Feature',
        id: featureId,
        geometry: normalizedGeometry,
        properties: {
            ...feature.properties,
            mode: mode,
            // Permissions (readonly or editable)
            // ...getFeaturePermissions(isReadonly),
            // Styling based on geometry type
            // ...getStylePropertiesForGeometry(geometry.type, color),
        },
    };

    return terraDrawFeature;
}

/**
 * Get feature permissions based on readonly status
 * @param {boolean} isReadonly - Whether feature should be readonly
 * @returns {Object} - Permission properties
 */
export function getFeaturePermissions(isReadonly) {
    if (isReadonly) {
        return {
            editable: false,
            draggable: false,
            rotateable: false,
            scaleable: false,
            deletable: false,
            coordinatesDraggable: false,
            coordinatesDeletable: false,
            coordinatesAddable: false,
            midpoints: false,
        };
    } else {
        return {
            editable: true,
            draggable: true,
            rotateable: true,
            scaleable: true,
            deletable: true,
            coordinatesDraggable: true,
            coordinatesDeletable: true,
            coordinatesAddable: true,
            midpoints: true,
        };
    }
}

/**
 * Get style properties for different geometry types
 * @param {string} geometryType - Type of geometry
 * @param {string} color - Color for the feature
 * @returns {Object} - Style properties
 */
export function getStylePropertiesForGeometry(geometryType, color) {
    switch (geometryType) {
        case 'Point':
            return {
                pointColor: color,
                pointOutlineColor: color,
            };

        case 'LineString':
        case 'MultiLineString':
            return {
                lineColor: color,
                pointColor: color,
            };

        case 'Polygon':
        case 'MultiPolygon':
        case 'Rectangle':
        case 'Circle':
            return {
                fillColor: color,
                fillOpacity: TERRA_DRAW_DEFAULT_CONFIG.defaultFillOpacity,
                outlineColor: color,
                outlineWidth: TERRA_DRAW_DEFAULT_CONFIG.defaultOutlineWidth,
            };

        default:
            return {
                fillColor: color,
                fillOpacity: 0.3,
                outlineColor: color,
                outlineWidth: TERRA_DRAW_DEFAULT_CONFIG.defaultOutlineWidth,
            };
    }
}

/**
 * Process GeoJSON features with enhanced MultiPolygon handling
 * @param {Object} geoJsonData - GeoJSON data
 * @param {string} color - Color for the features
 * @param {boolean} isReadonly - Whether features should be readonly
 * @returns {Array} - Processed Terra Draw features
 */
export function processGeoJsonFeatures(geoJsonData, recordId, color, isReadonly = false) {
    const processedFeatures = [];

    geoJsonData.features.forEach((feature, featureIndex) => {
        const geometry = feature.geometry;
        feature.properties = Object.assign(feature.properties || {}, { odoo: recordId });;

        if (geometry.type === 'MultiPolygon') {
            // Split MultiPolygon into individual polygons
            const splitPolygons = processComplexMultiPolygon(feature, color, isReadonly);
            processedFeatures.push(...splitPolygons);
        } else {
            // Process single geometry features
            const processedFeature = createTerraDrawFeature(feature, color, isReadonly);
            if (processedFeature) {
                processedFeatures.push(processedFeature);
            }
        }
    });

    return processedFeatures;
}

/**
 * Add features to Terra Draw with comprehensive debugging
 * @param {Object} terraDrawInstance - Terra Draw instance
 * @param {Array} features - Features to add
 * @param {string} context - Context for debugging (e.g., 'readonly', 'editable')
 * @returns {Promise<boolean>} - Success status
 */
export async function addFeaturesToTerraDrawWithDebugging(
    terraDrawInstance,
    features,
    context = ''
) {
    try {
        // Validate first feature
        if (features.length > 0) {
            const isValid = validateTerraDrawFeature(features[0]);
            if (!isValid) {
                console.error(`Invalid feature in context ${context}:`, features[0]);
                return false;
            }
        }

        // Ensure Terra Draw is in select mode for viewing features
        if (terraDrawInstance.getMode() !== 'select') {
            terraDrawInstance.setMode('select');
        }
        
        // Add features to Terra Draw
        terraDrawInstance.addFeatures(features);
        
        // Wait for Terra Draw to process the features
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify features were added successfully
        try {
            terraDrawInstance.getSnapshot();
            return true;
        } catch (error) {
            console.warn('Failed to get Terra Draw snapshot after adding features:', error);
            return false;
        }
        
    } catch (error) {
        console.error(`Error adding features to Terra Draw (${context}):`, error);
        return false;
    }
}

export function getRandomColor() {
    const randomIndex = Math.floor(Math.random() * COLOR_PALETTE.length);
    return COLOR_PALETTE[randomIndex];
}

/**
 * Calculate the distance between two geographic coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @param {string} unit - Unit of measurement ('metric' or 'imperial')
 * @returns {number} Distance in kilometers or miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    const R =
        unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL
            ? MEASUREMENT_CONFIG.EARTH_RADIUS_MILES
            : MEASUREMENT_CONFIG.EARTH_RADIUS_KM;

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate the area of a polygon using the spherical excess formula
 * @param {Array} coordinates - Array of [lng, lat] coordinates forming the polygon
 * @param {string} unit - Unit of measurement ('metric' or 'imperial')
 * @returns {number} Area in square kilometers or square miles
 */
export function calculatePolygonArea(coordinates, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    if (coordinates.length < 3) return 0;

    const R =
        unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL
            ? MEASUREMENT_CONFIG.EARTH_RADIUS_MILES
            : MEASUREMENT_CONFIG.EARTH_RADIUS_KM;

    let area = 0;
    const coords = coordinates.slice(); // Copy array

    // Ensure polygon is closed
    if (
        coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]
    ) {
        coords.push(coords[0]);
    }

    for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];

        area +=
            (lon2 - lon1) *
            (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
    }

    area = Math.abs((area * R * R * Math.PI) / 360);
    return area;
}

/**
 * Calculate the total length of a linestring
 * @param {Array} coordinates - Array of [lng, lat] coordinates
 * @param {string} unit - Unit of measurement ('metric' or 'imperial')
 * @returns {number} Total length in kilometers or miles
 */
export function calculateLineStringLength(coordinates, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    if (coordinates.length < 2) return 0;

    let totalLength = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1] = coordinates[i];
        const [lon2, lat2] = coordinates[i + 1];
        totalLength += calculateDistance(lat1, lon1, lat2, lon2, unit);
    }

    return totalLength;
}

/**
 * Calculate the area of a circle given its radius
 * @param {number} radius - Radius in kilometers or miles
 * @returns {number} Area in square kilometers or square miles
 */
export function calculateCircleArea(radius) {
    return Math.PI * Math.pow(radius, 2);
}

/**
 * Calculate the radius of a circle from polygon coordinates
 * @param {Array} polygonCoords 
 * @param {string} unit 
 * @returns {number} radius in kilometers or miles
 */
export function calculateCircleRadius(polygonCoords, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    // Assuming polygonCoords is an array of linear rings, take the first ring
    const firstRing = polygonCoords[0];
    if (firstRing.length < 2) return 0;

    // Calculate the centroid of the polygon
    let sumLat = 0;
    let sumLng = 0;
    firstRing.forEach(([lng, lat]) => {
        sumLat += lat;
        sumLng += lng;
    });
    const centroidLat = sumLat / firstRing.length;
    const centroidLng = sumLng / firstRing.length;

    // Calculate the distance from the centroid to the first point as radius
    const [firstLng, firstLat] = firstRing[0];
    const radius = calculateDistance(centroidLat, centroidLng, firstLat, firstLng, unit);

    return radius;
}

/**
 * Calculate circle measurements: area and diameter
 * @param {Number} radius
 * @returns {Object} area and diameter
 */
export function calculateCircleMeasurements(radius) {
    const area = calculateCircleArea(radius);
    const diameter = radius * 2;
    return { area, diameter };
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
 * Format measurement value with appropriate units and precision
 * @param {number} value - The measurement value
 * @param {string} type - Type of measurement ('distance', 'area')
 * @param {string} unit - Unit system ('metric' or 'imperial')
 * @returns {string} Formatted measurement string
 */
export function formatMeasurement(value, type, unit = MEASUREMENT_CONFIG.UNITS.METRIC, locale = 'en-US') {
    if (type === 'distance') {
        if (unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
            if (value < 0.1) {
                // Very short distances in feet with no decimals for readability
                const feet = value * 5280;
                return `${formatNumber(feet, 0, locale)} ft`;
            } else if (value < 1) {
                // Short distances in feet with 1 decimal
                const feet = value * 5280;
                return `${formatNumber(feet, 1, locale)} ft`;
            } else {
                // Longer distances in miles
                return `${formatNumber(value, 2, locale)} mi`;
            }
        } else {
            if (value < 0.001) {
                // Very short distances in centimeters
                const cm = value * 100000;
                return `${formatNumber(cm, 0, locale)} cm`;
            } else if (value < 1) {
                // Short distances in meters
                const meters = value * 1000;
                return `${formatNumber(meters, meters < 10 ? 1 : 0, locale)} m`;
            } else {
                // Longer distances in kilometers
                return `${formatNumber(value, 2, locale)} km`;
            }
        }
    } else if (type === 'area') {
        if (unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
            if (value < 0.0015625) {
                // Very small areas in square feet
                const sqFeet = value * 27878400; // 1 sq mile = 27,878,400 sq ft
                return `${formatNumber(sqFeet, 0, locale)} ft²)`;
            } else if (value < 1) {
                // Small to medium areas in acres
                const acres = value * 640;
                return `${formatNumber(acres, acres < 1 ? 2 : 1, locale)} acres`;
            } else {
                // Large areas in square miles
                return `${formatNumber(value, 2, locale)} m²`;
            }
        } else {
            if (value < 0.01) {
                // Small areas in square meters
                const sqMeters = value * 1000000;
                return `${formatNumber(sqMeters, sqMeters < 100 ? 1 : 0, locale)} m²`;
            } else if (value < 1) {
                // Medium areas in hectares
                const hectares = value * 100;
                return `${formatNumber(hectares, 2, locale)} ha`;
            } else {
                // Large areas in square kilometers
                return `${formatNumber(value, 2, locale)} km²`;
            }
        }
    }
    return formatNumber(value, 2, locale);
}
