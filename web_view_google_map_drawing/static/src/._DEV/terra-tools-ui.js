/**
 * @fileoverview Terra Draw Tools UI Component for Google Maps Integration
 * 
 * This module provides a comprehensive drawing interface for Google Maps using the Terra Draw library.
 * It includes support for multiple geometry types (Point, LineString, Polygon, Rectangle, Circle, Freehand),
 * real-time measurement calculations, undo/redo functionality, and feature management.
 * 
 * Key Features:
 * - Multiple drawing modes with visual toolbar
 * - Real-time measurement display for all geometry types
 * - Comprehensive measurement calculations (area, perimeter, length, coordinates)
 * - Professional number formatting with locale support
 * - Undo/redo history management
 * - Feature import/export capabilities
 * - Keyboard shortcuts for common operations
 * - Measurement unit toggling (metric/imperial)
 * - In-map overlay positioning for better UX
 * 
 * @author Yopi Angi - https://github.com/gityopie
 * @version 1.0.0
 * @requires Terra Draw Library
 * @requires Google Maps JavaScript API
 */

import { _t } from '@web/core/l10n/translation';
import { loadJS } from '@web/core/assets';
import { debounce } from '@web/core/utils/timing';
import { useService } from '@web/core/utils/hooks';
import {
    Component,
    useEffect,
    useState,
    useRef,
    onWillStart,
    onWillDestroy,
    onWillUpdateProps,
} from '@odoo/owl';
import { processColor } from '@web_view_google_map/views/google_map/utils';

export const COLOR_PALETTE = [
    '#E74C3C', // Red
    '#F39C12', // Yellow-Orange
    '#FF0066', // Pink
    '#9B59B6', // Purple
    '#673AB7', // Deep Purple
    '#3F51B5', // Indigo
    '#3498DB', // Blue
    '#03A9F4', // Light Blue
    '#00BCD4', // Cyan
    '#009688', // Teal
    '#27AE60', // Green
    '#8BC34A', // Light Green
    '#CDDC39', // Lime
    '#F1C40F', // Yellow
    '#FFC107', // Amber
    '#F39C12', // Orange
    '#FF5722', // Deep Orange
    '#795548', // Brown
];

export const MODE_BUTTONS = {
    'select-mode': 'select',
    'point-mode': 'point',
    'linestring-mode': 'linestring',
    'polygon-mode': 'polygon',
    'rectangle-mode': 'rectangle',
    'circle-mode': 'circle',
    'freehand-mode': 'freehand',
    'clear-mode': 'static',
};

export const TERRA_DRAW_CONFIG = {
    COORDINATE_PRECISION: 9,
    SAVE_DEBOUNCE_DELAY: 3000,
    RESTORE_DELAY: 500,
    UNDO_RESTORE_DELAY: 100,
    FALLBACK_TIMEOUT: 2000
};

/**
 * Configuration for measurement calculations and display
 * Supports both metric and imperial unit systems with appropriate precision
 */
export const MEASUREMENT_CONFIG = {
    EARTH_RADIUS_KM: 6371,                    // Earth radius in kilometers
    EARTH_RADIUS_MILES: 3959,                 // Earth radius in miles
    UNITS: {
        METRIC: 'metric',                     // Metric system (km, m, ha, sq km)
        IMPERIAL: 'imperial'                  // Imperial system (mi, ft, ac, sq mi)
    },
    DISTANCE_PRECISION: 2,                    // Decimal places for distance measurements
    AREA_PRECISION: 2,                        // Decimal places for area measurements
    COORDINATE_PRECISION: 6                   // Decimal places for coordinate display
};

export function getRandomColor() {
    const randomIndex = Math.floor(Math.random() * COLOR_PALETTE.length);
    return COLOR_PALETTE[randomIndex];
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
        console.log(feature)
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
    
    console.log('Feature validation passed for:', feature.id);
    return true;
}

/**
 * Generate a UUID similar to Terra Draw's format
 * @returns {string} UUID in format like "3072758a-d7b2-4ad9-9f68-93028d811a59"
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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
    const R = unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL ? 
        MEASUREMENT_CONFIG.EARTH_RADIUS_MILES : 
        MEASUREMENT_CONFIG.EARTH_RADIUS_KM;
    
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
    
    const R = unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL ? 
        MEASUREMENT_CONFIG.EARTH_RADIUS_MILES : 
        MEASUREMENT_CONFIG.EARTH_RADIUS_KM;
    
    let area = 0;
    const coords = coordinates.slice(); // Copy array
    
    // Ensure polygon is closed
    if (coords[0][0] !== coords[coords.length - 1][0] || 
        coords[0][1] !== coords[coords.length - 1][1]) {
        coords.push(coords[0]);
    }
    
    for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        
        area += (lon2 - lon1) * (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
    }
    
    area = Math.abs(area * R * R * Math.PI / 360);
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
 * @param {string} unit - Unit of measurement ('metric' or 'imperial')
 * @returns {number} Area in square kilometers or square miles
 */
export function calculateCircleArea(radius, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    return Math.PI * radius * radius;
}

/**
 * Format a number with thousand separators for better readability
 * @param {number} num - The number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number with commas
 */
export function formatNumber(num, decimals = 2) {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
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
export function formatMeasurement(value, type, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    if (type === 'distance') {
        if (unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
            if (value < 0.1) {
                // Very short distances in feet with no decimals for readability
                const feet = value * 5280;
                return `${formatNumber(feet, 0)} ft`;
            } else if (value < 1) {
                // Short distances in feet with 1 decimal
                const feet = value * 5280;
                return `${formatNumber(feet, 1)} ft`;
            } else {
                // Longer distances in miles
                return `${formatNumber(value, 2)} mi`;
            }
        } else {
            if (value < 0.001) {
                // Very short distances in centimeters
                const cm = value * 100000;
                return `${formatNumber(cm, 0)} cm`;
            } else if (value < 1) {
                // Short distances in meters
                const meters = value * 1000;
                return `${formatNumber(meters, meters < 10 ? 1 : 0)} m`;
            } else {
                // Longer distances in kilometers
                return `${formatNumber(value, 2)} km`;
            }
        }
    } else if (type === 'area') {
        if (unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
            if (value < 0.0015625) {
                // Very small areas in square feet
                const sqFeet = value * 27878400; // 1 sq mile = 27,878,400 sq ft
                return `${formatNumber(sqFeet, 0)} sq ft`;
            } else if (value < 1) {
                // Small to medium areas in acres
                const acres = value * 640;
                return `${formatNumber(acres, acres < 1 ? 2 : 1)} acres`;
            } else {
                // Large areas in square miles
                return `${formatNumber(value, 2)} sq mi`;
            }
        } else {
            if (value < 0.01) {
                // Small areas in square meters
                const sqMeters = value * 1000000;
                return `${formatNumber(sqMeters, sqMeters < 100 ? 1 : 0)} sq m`;
            } else if (value < 1) {
                // Medium areas in hectares
                const hectares = value * 100;
                return `${formatNumber(hectares, 2)} ha`;
            } else {
                // Large areas in square kilometers
                return `${formatNumber(value, 2)} sq km`;
            }
        }
    }
    return formatNumber(value, 2);
}

/**
 * Terra Draw Tools UI Component
 * 
 * A comprehensive drawing interface component that integrates Terra Draw with Google Maps
 * to provide advanced drawing capabilities for geographic features.
 * 
 * @class TerraDrawToolsUI
 * @extends Component
 * 
 * Features:
 * - Drawing modes: Point, LineString, Polygon, Rectangle, Circle, Freehand
 * - Selection and editing of existing features
 * - Real-time measurement calculations with professional formatting
 * - Undo/redo functionality with history management
 * - Feature import/export (GeoJSON format)
 * - Keyboard shortcuts (Delete, Ctrl+Z, Ctrl+Y, Ctrl+A, Escape)
 * - Measurement unit toggling (metric/imperial)
 * - In-map overlay positioning for optimal user experience
 * 
 * Measurement Capabilities:
 * - Points: Coordinates with directional indicators (N/S, E/W)
 * - Lines: Length calculation with point count
 * - Polygons: Area and perimeter calculations
 * - Rectangles: Area and perimeter calculations  
 * - Circles: Area, radius, and circumference calculations
 * - Professional number formatting with appropriate units
 * 
 * Event Handling:
 * - Drawing completion triggers measurement display (finish event)
 * - Feature selection shows measurements (select event)
 * - Change events only handle history/undo functionality (no measurements)
 *   to prevent interference with active drawing workflow
 * 
 * Props:
 * @param {Object} googleMap - Google Maps instance
 * @param {Function} saveFeatures - Callback function to save features
 * @param {Object} dataGeoJson - Initial GeoJSON data to load
 * 
 * State Management:
 * - currentMode: Active drawing mode
 * - selectedFeatureId: Currently selected feature ID
 * - measurementUnit: Current unit system (metric/imperial)
 * - showMeasurements: Whether to display measurements
 * - isRestoring/isSaving: State flags for async operations
 */
export class TerraDrawToolsUI extends Component {
    static template = 'web_view_google_map_drawing.TerraToolsUI';
    static props = {
        googleMap: [Object, { value: null }],
        saveFeatures: Function,
        dataGeoJson: [Object, { value: null }],
        record: Object,
    };

    setup() {
        this.notificationService = useService('notification');
        this.toolsUiRef = useRef('toolUiRef');
        this.state = useState({
            currentMode: null,
            activeButton: null,
            selectedFeatureId: null,
            isRestoring: null,
            resizingEnabled: null,
            isSaving: null,
            measurementUnit: MEASUREMENT_CONFIG.UNITS.METRIC,
            showMeasurements: false,
        });

        this.terraDrawInstance = null;
        this.history = [];
        this.redoHistory = [];
        this.debounceTimeout = null;
        this.latLngBounds = null;
        this.eventProjectionChanges = null;
        this.initTimeout = null;

        this.debounceSaveChanges = debounce(this._saveChanges.bind(this), 3000);

        // Add keyboard shortcuts
        useEffect(() => {
            const handleKeydown = this._handleKeyboardShortcuts.bind(this);
            document.addEventListener('keydown', handleKeydown);
            
            return () => {
                document.removeEventListener('keydown', handleKeydown);
            };
        });

        onWillStart(async () => {
            try {
                if (window.terraDraw && window.terraDrawGoogleMapsAdapter) {
                    return;
                }
                await loadJS(
                    '/web_view_google_map_drawing/static/src/libs/terra/1.13.0/terra-draw.umd.js'
                );
                await loadJS(
                    '/web_view_google_map_drawing/static/src/libs/terra-google-maps-adapter/1.0.2/terra-draw-google-maps-adapter.umd.js'
                );
            } catch (error) {
                console.error(error);
                this.notificationService.add(
                    _t('Failed to load Terra Draw assets. Please check javascript console for more information'),
                    { type: 'danger', title: _t('Error'), }
                );
            }
        });

        onWillDestroy(this._cleanup);

        onWillUpdateProps((nextProps) => {
            if (
                JSON.stringify(nextProps.dataGeoJson) !== JSON.stringify(this.props.dataGeoJson) &&
                this.terraDrawInstance !== null
            ) {
                if (this.state.isRestoring || this.state.isSaving) {
                    return;
                }
                this.terraDrawInstance.clear();
                this.latLngBounds = null; // reset latLngBounds to recalculate
                this.loadRecordData(nextProps.dataGeoJson);
            }
        });

        useEffect(
            (googleMap, toolUiRef) => {
                if (googleMap && toolUiRef.el && window.terraDraw) {
                    this.initTerraDraw().catch((error) => {
                        console.error('Failed to initialize Terra Draw:', error);
                        this.notificationService.add(
                            _t('Failed to initialize Terra Draw. Please check javascript console for more information'),
                            { title: _t('Error'), type: 'danger' }
                        );
                    });
                }
            },
            () => [this.props.googleMap, this.toolsUiRef]
        );
    }

    /**
     * Load existing GeoJSON features into the Terra Draw instance
     * @param {Object} geoJson - GeoJSON object containing features to load
     * @param {Array} geoJson.features - Array of GeoJSON features
     * @returns {Promise<void>}
     * @private
     */
    async loadRecordData(geoJson) {
        if (!geoJson?.features || !Array.isArray(geoJson.features)) {
            console.warn('Invalid GeoJSON data provided', { geoJson });
            return; // nothing to load
        }

        if (!this.terraDrawInstance) {
            console.warn('TerraDraw instance not initialized yet');
            return;
        }

        try {
            console.log(`Loading ${geoJson.features.length} original features`);

            // Clear existing features before loading new ones
            if (this.terraDrawInstance.hasFeature()) {
                this.terraDrawInstance.clear();
            }
            this.state.isRestoring = true;

            // Process features while preserving all information
            const processedFeatures = this._validateAndPrepareFeatures(geoJson.features);
            console.log(`Processed into ${processedFeatures.length} Terra Draw compatible features`);

            // Add the processed features to Terra Draw
            console.log('Features to be added to Terra Draw:', processedFeatures);
            console.log('Sample processed feature structure:', processedFeatures[0]);
            
            // Validate feature structure before adding
            const isValidFeature = validateTerraDrawFeature(processedFeatures[0]);
            console.log('Feature validation result:', isValidFeature);
            
            // Ensure Terra Draw is in select mode for viewing features
            if (this.terraDrawInstance.getMode() !== 'select') {
                this.terraDrawInstance.setMode('select');
            }
            
            // Check Terra Draw state before adding features
            console.log('Terra Draw current mode:', this.terraDrawInstance.getMode());
            console.log('Terra Draw has features before adding:', this.terraDrawInstance.hasFeature());
            
            this.terraDrawInstance.addFeatures(processedFeatures);
            
            // Check Terra Draw state after adding features
            console.log('Terra Draw has features after adding:', this.terraDrawInstance.hasFeature());

            // Debug: Check what features Terra Draw actually has
            setTimeout(() => {
                const addedFeatures = this.terraDrawInstance.getSnapshot();
                console.log('Features actually added to Terra Draw:', addedFeatures);
                console.log('Terra Draw has features:', this.terraDrawInstance.hasFeature());
                console.log('Current Terra Draw mode:', this.terraDrawInstance.getMode());
                
                // Force a render/redraw
                if (addedFeatures.length > 0) {
                    console.log('Forcing Terra Draw refresh...');
                    console.log('Features have proper structure:', addedFeatures[0]);
                    
                    // Try forcing Google Maps to redraw
                    google.maps.event.trigger(this.props.googleMap, 'resize');
                    
                    // Try multiple approaches to force rendering
                    
                    // Approach 1: Clear and re-add
                    this.terraDrawInstance.clear();
                    setTimeout(() => {
                        this.terraDrawInstance.addFeatures(addedFeatures);
                        console.log('Re-added features. Has features now:', this.terraDrawInstance.hasFeature());
                        
                        // Approach 2: Force mode changes after re-adding
                        setTimeout(() => {
                            this.terraDrawInstance.setMode('static');
                            setTimeout(() => {
                                this.terraDrawInstance.setMode('select');
                                console.log('Final check - Has features:', this.terraDrawInstance.hasFeature());
                                
                                // Try to manually trigger render
                                if (this.terraDrawInstance.render) {
                                    this.terraDrawInstance.render();
                                }
                            }, 100);
                        }, 100);
                    }, 100);
                }
            }, 100);

            this.setSelectedFeatureId(null);

            await new Promise(resolve => setTimeout(resolve, TERRA_DRAW_CONFIG.RESTORE_DELAY));
            this.state.isRestoring = false;

            // Create summary for user
            this._showProcessingSummary(geoJson.features, processedFeatures);

            // Fit map to bounds of loaded features
            this._fitMapToBounds(processedFeatures);
            // Note: Measurements are disabled by default for cleaner view
            // Users can enable them manually using the eye icon button
        } catch (error) {
            console.error('Failed to load existing features:', error);
            this.notificationService.add(_t('Failed to load existing features'), { title: _t('Error'), type: 'danger' });
            this.state.isRestoring = false;
        }
    }

    /**
     * Process complex MultiPolygon features for Terra Draw compatibility
     * Preserves all data while creating Terra Draw compatible representations
     * @param {Object} feature - Original GeoJSON feature
     * @returns {Array} Array of Terra Draw compatible features
     * @private
     */
    _processComplexMultiPolygon(feature) {
        if (feature.geometry.type !== 'MultiPolygon') {
            return [feature];
        }
        
        const coordinates = feature.geometry.coordinates;
        const originalProperties = feature.properties || {};
        
        console.log(`Processing MultiPolygon with ${coordinates.length} rings`);
        
        // Create multiple Polygon features from the MultiPolygon
        const polygonFeatures = coordinates.map((polygonCoords, index) => {
            // Calculate area to identify main vs island polygons
            const ringArea = this._calculateRingArea(polygonCoords[0]);
            const isMainLandmass = index === 0 || ringArea > 1000; // Adjust threshold as needed
            
            return {
                type: 'Feature',
                id: generateUUID(), // Generate Terra Draw compatible UUID
                geometry: {
                    type: 'Polygon',
                    coordinates: this._normalizeCoordinates(polygonCoords)
                },
                properties: {
                    // Keep only essential Terra Draw properties
                    mode: 'polygon',
                    // Store metadata in a separate object to avoid conflicts
                    _metadata: {
                        ...originalProperties,
                        originalType: 'MultiPolygon',
                        originalId: feature.id,
                        partIndex: index,
                        totalParts: coordinates.length,
                        isMainLandmass: isMainLandmass,
                        partName: isMainLandmass ? 
                            `${originalProperties.state || originalProperties.name || 'Region'} - Main Area` : 
                            `${originalProperties.state || originalProperties.name || 'Region'} - Island ${index}`,
                    }
                }
            };
        });
        
        return polygonFeatures;
    }

    /**
     * Calculate approximate area of a polygon ring for classification
     * @param {Array} coordinates - Ring coordinates
     * @returns {number} Approximate area
     * @private
     */
    _calculateRingArea(coordinates) {
        if (coordinates.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < coordinates.length - 1; i++) {
            const [x1, y1] = coordinates[i];
            const [x2, y2] = coordinates[i + 1];
            area += (x2 - x1) * (y1 + y2);
        }
        return Math.abs(area / 2);
    }

    /**
     * Normalize coordinates to match Terra Draw precision expectations
     * @param {Array} coordinates - Coordinate array to normalize
     * @returns {Array} Normalized coordinates
     * @private
     */
    _normalizeCoordinates(coordinates) {
        if (!Array.isArray(coordinates)) return coordinates;
        
        return coordinates.map(coord => {
            if (Array.isArray(coord[0])) {
                // This is a nested array (polygon ring)
                return this._normalizeCoordinates(coord);
            } else {
                // This is a coordinate pair [lng, lat]
                return [
                    Number(parseFloat(coord[0]).toFixed(TERRA_DRAW_CONFIG.COORDINATE_PRECISION)),
                    Number(parseFloat(coord[1]).toFixed(TERRA_DRAW_CONFIG.COORDINATE_PRECISION))
                ];
            }
        });
    }

    /**
     * Enhanced feature validation and preparation
     * @param {Array} features - Array of GeoJSON features
     * @returns {Array} Processed features ready for Terra Draw
     * @private
     */
    _validateAndPrepareFeatures(features) {
        const processedFeatures = [];
        
        features.forEach((feature, index) => {
            try {
                if (feature.geometry.type === 'MultiPolygon') {
                    // Process MultiPolygon into multiple Polygon features
                    const polygonFeatures = this._processComplexMultiPolygon(feature);
                    processedFeatures.push(...polygonFeatures);
                    
                    console.log(`Split MultiPolygon into ${polygonFeatures.length} polygons`);
                } else {
                    // Process other geometry types normally
                    const processedFeature = this._processRegularFeature(feature);
                    if (processedFeature) {
                        processedFeatures.push(processedFeature);
                    }
                }
            } catch (error) {
                console.error(`Error processing feature ${index}:`, error);
                // Try to create a simplified version as fallback
                const fallbackFeature = this._createFallbackFeature(feature, index);
                if (fallbackFeature) {
                    processedFeatures.push(fallbackFeature);
                }
            }
        });
        
        return processedFeatures;
    }

    /**
     * Process regular (non-MultiPolygon) features
     * @param {Object} feature - GeoJSON feature
     * @returns {Object} Processed feature
     * @private
     */
    _processRegularFeature(feature) {
        const processedFeature = JSON.parse(JSON.stringify(feature));
        
        // Ensure properties exist
        if (!processedFeature.properties) {
            processedFeature.properties = {};
        }
        
        // Preserve original type information in metadata
        processedFeature.properties.originalType = feature.geometry.type;
        
        // Keep only essential Terra Draw properties for rendering
        processedFeature.properties.mode = feature.geometry.type.toLowerCase();
        
        // Store all other metadata separately to avoid Terra Draw conflicts
        processedFeature.properties._metadata = {
            ...(feature.properties || {}),
            originalType: feature.geometry.type,
        };
        
        return processedFeature;
    }

    /**
     * Create a fallback feature for problematic geometries
     * @param {Object} feature - Original feature
     * @param {number} index - Feature index
     * @returns {Object|null} Fallback feature or null
     * @private
     */
    _createFallbackFeature(feature, index) {
        try {
            // For complex features, create a point at the centroid
            const centroid = this._calculateCentroid(feature.geometry);
            if (!centroid) return null;
            
            return {
                type: 'Feature',
                id: generateUUID(), // Generate Terra Draw compatible UUID
                geometry: {
                    type: 'Point',
                    coordinates: centroid
                },
                properties: {
                    // Keep only essential Terra Draw properties
                    mode: 'point',
                    // Store metadata separately
                    _metadata: {
                        ...(feature.properties || {}),
                        originalType: feature.geometry.type,
                        fallback: true,
                        fallbackReason: 'Complex geometry simplified to point',
                    }
                }
            };
        } catch (error) {
            console.error('Failed to create fallback feature:', error);
            return null;
        }
    }

    /**
     * Calculate centroid of any geometry type
     * @param {Object} geometry - GeoJSON geometry
     * @returns {Array|null} [lng, lat] coordinates or null
     * @private
     */
    _calculateCentroid(geometry) {
        const { type, coordinates } = geometry;
        
        try {
            switch (type) {
                case 'Point':
                    return coordinates;
                    
                case 'LineString':
                    const midIndex = Math.floor(coordinates.length / 2);
                    return coordinates[midIndex];
                    
                case 'Polygon':
                    return this._calculatePolygonCentroid(coordinates[0]);
                    
                case 'MultiPoint':
                    const avgX = coordinates.reduce((sum, coord) => sum + coord[0], 0) / coordinates.length;
                    const avgY = coordinates.reduce((sum, coord) => sum + coord[1], 0) / coordinates.length;
                    return [avgX, avgY];
                    
                case 'MultiLineString':
                    const allCoords = coordinates.flat();
                    const midIdx = Math.floor(allCoords.length / 2);
                    return allCoords[midIdx];
                    
                case 'MultiPolygon':
                    // Use the centroid of the largest polygon
                    let largestPolygon = coordinates[0];
                    let maxArea = this._calculateRingArea(coordinates[0][0]);
                    
                    coordinates.forEach(polygon => {
                        const area = this._calculateRingArea(polygon[0]);
                        if (area > maxArea) {
                            maxArea = area;
                            largestPolygon = polygon;
                        }
                    });
                    
                    return this._calculatePolygonCentroid(largestPolygon[0]);
                    
                default:
                    return null;
            }
        } catch (error) {
            console.error('Error calculating centroid:', error);
            return null;
        }
    }

    /**
     * Calculate centroid of a polygon ring
     * @param {Array} coordinates - Polygon ring coordinates
     * @returns {Array} [lng, lat] centroid coordinates
     * @private
     */
    _calculatePolygonCentroid(coordinates) {
        let area = 0;
        let x = 0;
        let y = 0;
        
        for (let i = 0; i < coordinates.length - 1; i++) {
            const [x0, y0] = coordinates[i];
            const [x1, y1] = coordinates[i + 1];
            const a = x0 * y1 - x1 * y0;
            area += a;
            x += (x0 + x1) * a;
            y += (y0 + y1) * a;
        }
        
        area *= 0.5;
        const factor = 1 / (6 * area);
        
        return [x * factor, y * factor];
    }

    /**
     * Show processing summary to inform user about feature handling
     * @param {Array} originalFeatures - Original features
     * @param {Array} processedFeatures - Processed features
     * @private
     */
    _showProcessingSummary(originalFeatures, processedFeatures) {
        const summary = {
            original: originalFeatures.length,
            processed: processedFeatures.length,
            multiPolygons: 0,
            splitIntoPolygons: 0,
            fallbacks: 0
        };
        
        originalFeatures.forEach(f => {
            if (f.geometry.type === 'MultiPolygon') {
                summary.multiPolygons++;
            }
        });
        
        processedFeatures.forEach(f => {
            if (f.properties?.originalType === 'MultiPolygon') {
                summary.splitIntoPolygons++;
            }
            if (f.properties?.fallback) {
                summary.fallbacks++;
            }
        });
        
        let message = `Loaded ${summary.processed} features`;
        if (summary.multiPolygons > 0) {
            message += ` (${summary.multiPolygons} MultiPolygon regions split into ${summary.splitIntoPolygons} individual areas)`;
        }
        if (summary.fallbacks > 0) {
            message += ` (${summary.fallbacks} complex features simplified)`;
        }
        
        this.notificationService.add(
            _t(message),
            { 
                title: _t('Features Loaded'),
                type: 'info' 
            }
        );
    }

    /**
     * Group related polygon parts from MultiPolygon features
     * @returns {Object} Grouped features by original ID
     * @public
     */
    getFeatureGroups() {
        if (!this.terraDrawInstance) return {};
        
        const features = this.terraDrawInstance.getSnapshot();
        const groups = {};
        
        features.forEach(feature => {
            const metadata = feature.properties?._metadata || {};
            if (metadata.originalId) {
                const originalId = metadata.originalId;
                if (!groups[originalId]) {
                    groups[originalId] = {
                        originalId: originalId,
                        parts: [],
                        totalParts: metadata.totalParts || 1,
                        originalType: metadata.originalType,
                        state: metadata.state || metadata.name || 'Unknown Region'
                    };
                }
                groups[originalId].parts.push(feature);
            }
        });
        
        return groups;
    }

    /**
     * Select all parts of a MultiPolygon feature group
     * @param {string} originalId - Original feature ID
     * @public
     */
    selectFeatureGroup(originalId) {
        const groups = this.getFeatureGroups();
        const group = groups[originalId];
        
        if (group) {
            group.parts.forEach(part => {
                this.terraDrawInstance.selectFeature(part.id);
            });
            
            this.notificationService.add(
                _t('Selected all %d parts of %s', group.parts.length, group.state),
                { type: 'info' }
            );
        }
    }

    /**
     * Fit the map view to contain all the given features
     * @param {Array} features - Array of GeoJSON features to fit bounds around
     * @returns {Promise<void>}
     * @private
     */
    async _fitMapToBounds(features) {
        if (!features.length) return;
        
        try {
            const { LatLngBounds } = await this.env.apiLoader.importLibrary('core');
            
            if (!this.latLngBounds) {
                this.latLngBounds = new LatLngBounds();
            }
            
            features.forEach(feature => {
                this._extendBoundsFromFeature(feature);
            });
            
            if (!this.latLngBounds.isEmpty()) {
                this.props.googleMap.fitBounds(this.latLngBounds);
            }
        } catch (error) {
            console.warn('Failed to fit map bounds:', error);
        }
    }
    
    /**
     * Extend the current map bounds to include coordinates from a GeoJSON feature
     * @param {Object} feature - GeoJSON feature to extract coordinates from
     * @param {Object} feature.geometry - Geometry object containing coordinates
     * @param {string} feature.geometry.type - Geometry type (Point, LineString, Polygon, etc.)
     * @param {Array} feature.geometry.coordinates - Coordinate array
     * @private
     */
    _extendBoundsFromFeature(feature) {
        const { coordinates } = feature.geometry;
        const { type } = feature.geometry;
        
        const coordHandlers = {
            Point: (coords) => {
                const latLng = new google.maps.LatLng(coords[1], coords[0]);
                this.latLngBounds.extend(latLng);
            },
            LineString: (coords) => coords.forEach((coord) => coordHandlers.Point(coord)),
            MultiPoint: (coords) => coords.forEach((coord) => coordHandlers.Point(coord)),
            Polygon: (coords) =>
                coords.forEach((ring) => ring.forEach((coord) => coordHandlers.Point(coord))),
            MultiLineString: (coords) =>
                coords.forEach((line) => line.forEach((coord) => coordHandlers.Point(coord))),
            MultiPolygon: (coords) =>
                coords.forEach((polygon) =>
                    polygon.forEach((ring) => ring.forEach((coord) => coordHandlers.Point(coord)))
                ),
        };
        
        if (coordHandlers[type]) {
            coordHandlers[type](coordinates);
        }
    }

    /**
     * Handle keyboard shortcuts for Terra Draw operations
     * @param {KeyboardEvent} event - The keyboard event
     * @private
     */
    _handleKeyboardShortcuts(event) {
        // Only handle shortcuts when not typing in input fields or textareas
        console.log(' TerraDrawToolsUI _handleKeyboardShortcuts event.key: ', event.key );
        console.log(' event.target.tagName: ', event.target.tagName );
        const excludeTags = ['INPUT', 'TEXTAREA', 'GMP-PLACE-AUTOCOMPLETE'];
        if (excludeTags.includes(event.target.tagName) || event.target.isContentEditable) {
            return;
        }

        // Only handle shortcuts if Terra Draw is initialized
        if (!this.terraDrawInstance) {
            return;
        }

        // Handle different keyboard shortcuts
        if (event.ctrlKey || event.metaKey) { // Support both Ctrl (PC) and Cmd (Mac)
            switch (event.key.toLowerCase()) {
                case 'z':
                    if (event.shiftKey) {
                        // Ctrl+Shift+Z or Cmd+Shift+Z - Redo
                        event.preventDefault();
                        this._actionRedo();
                    } else {
                        // Ctrl+Z or Cmd+Z - Undo
                        event.preventDefault();
                        this._actionUndo();
                    }
                    break;
                
                case 'y':
                    // Ctrl+Y or Cmd+Y - Redo (alternative)
                    event.preventDefault();
                    this._actionRedo();
                    break;
                
                case 's':
                    // Ctrl+S or Cmd+S - Save manually
                    event.preventDefault();
                    this._saveChanges();
                    break;
                
                case 'm':
                    // Ctrl+M or Cmd+M - Toggle measurement unit
                    event.preventDefault();
                    this.toggleMeasurementUnit();
                    break;
                
                case 'c':
                    // Ctrl+C or Cmd+C - Copy measurements (only if no text is selected)
                    if (window.getSelection().toString() === '') {
                        event.preventDefault();
                        this.copyMeasurementsToClipboard(!!this.state.selectedFeatureId);
                    }
                    break;
            }
        } else {
            // Handle non-modifier key shortcuts
            switch (event.key) {
                case 'Delete':
                case 'Backspace':
                    // Delete or Backspace - Delete selected feature
                    event.preventDefault();
                    this._actionDeleteSelectedFeature();
                    break;
                
                case 'Escape':
                    // Escape - Switch to select mode
                    event.preventDefault();
                    this.setActiveMode('select-mode');
                    break;
                
                // Quick mode switching shortcuts
                case '1':
                    event.preventDefault();
                    this.setActiveMode('select-mode');
                    break;
                
                case '2':
                    event.preventDefault();
                    this.setActiveMode('point-mode');
                    break;
                
                case '3':
                    event.preventDefault();
                    this.setActiveMode('linestring-mode');
                    break;
                
                case '4':
                    event.preventDefault();
                    this.setActiveMode('polygon-mode');
                    break;
                
                case '5':
                    event.preventDefault();
                    this.setActiveMode('rectangle-mode');
                    break;
                
                case '6':
                    event.preventDefault();
                    this.setActiveMode('circle-mode');
                    break;
                
                case '7':
                    event.preventDefault();
                    this.setActiveMode('freehand-mode');
                    break;
                
                case 'c':
                case 'C':
                    // C - Clear all features
                    event.preventDefault();
                    this._actionClearMode();
                    break;
                
                case 'm':
                case 'M':
                    // M - Toggle measurement display
                    event.preventDefault();
                    this.toggleMeasurementDisplay();
                    break;
            }
        }
    }

    /**
     * Handle click events on mode selection buttons
     * @param {Event} ev - Click event from mode button
     * @public
     */
    onClickSetActiveMode(ev) {
        if (!this.terraDrawInstance) {
            this.notificationService.add(
                _t('Terra Draw is not initialized properly. Please inform your administrator'),
                { title: _t('Error'), type: 'danger' }
            );
            return;
        }
        const button = ev.currentTarget;
        const mode = button.id;
        this.setActiveMode(mode);
    }

    /**
     * Handle click events on action buttons (clear, delete, undo, redo, resize)
     * @param {Event} ev - Click event from action button
     * @public
     */
    onClickActionButton(ev) {
        if (!this.terraDrawInstance) {
            this.notificationService.add(
                _t('Terra Draw is not initialized properly. Please inform your administrator'),
                { title: _t('Error'), type: 'danger' }
            );
            return;
        }
        const button = ev.currentTarget;
        const action = button.id;
        if (action === 'clear-mode') {
            this._actionClearMode();
            this.updateActiveButton(action);
        } else if (action === 'delete-selected-button') {
            this._actionDeleteSelectedFeature();
            this.updateActiveButton(action);
        } else if (action === 'undo-button') {
            this._actionUndo();
        } else if (action === 'redo-button') {
            this._actionRedo();
        } else if (action === 'resize-button') {
            this._actionResize();
        } else if (action === 'measurement-unit-button') {
            this.toggleMeasurementUnit();
        } else if (action === 'measurement-toggle-button') {
            this.toggleMeasurementDisplay();
        }
    }

    /**
     * Clear all drawn features from the Terra Draw instance
     * Resets the current mode and selected feature state
     * @private
     */
    _actionClearMode() {
        this.terraDrawInstance.clear();
        this.state.currentMode = null;
        this.state.selectedFeatureId = null;
        this.setActiveMode('clear-mode');
        this.notificationService.add(_t('All features cleared'), { type: 'info' });
        // Save changes after clearing
        this.debounceSaveChanges();
    }

    /**
     * Delete the currently selected feature, or the last drawn feature if none selected
     * Provides user feedback via notifications and includes error handling
     * @private
     */
    _actionDeleteSelectedFeature() {
        if (!this.terraDrawInstance) {
            console.warn('TerraDraw not initialized');
            return;
        }
        
        try {
            if (this.state.selectedFeatureId) {
                // Delete selected feature
                this.terraDrawInstance.removeFeatures([this.state.selectedFeatureId]);
                this.state.selectedFeatureId = null;
                this.notificationService.add(_t('Selected feature deleted'), { type: 'info' });
            } else {
                // Delete last feature as fallback
                const features = this.terraDrawInstance.getSnapshot();
                const nonSystemFeatures = features.filter(f => 
                    !f.properties?.midPoint && !f.properties?.selectionPoint
                );
                
                if (nonSystemFeatures.length > 0) {
                    const lastFeature = nonSystemFeatures[nonSystemFeatures.length - 1];
                    this.terraDrawInstance.removeFeatures([lastFeature.id]);
                    // Save changes after deletion
                    this.debounceSaveChanges();
                    this.notificationService.add(_t('Last feature deleted'), { type: 'info' });
                } else {
                    this.notificationService.add(_t('No features to delete'), { type: 'warning' });
                }
            }
        } catch (error) {
            console.error('Error deleting feature:', error);
            this.notificationService.add(_t('Failed to delete feature'), { type: 'danger' });
        }
    }

    /**
     * Undo the last action by restoring the previous state from history
     * Provides user feedback and moves current state to redo history
     * @private
     */
    _actionUndo() {
        if (this.history.length <= 1) {
            this.notificationService.add(_t('Nothing to undo'), { type: 'info' });
            return;
        }
        
        try {
            this.redoHistory.push(this.history.pop());
            const snapshotToRestore = this.history[this.history.length - 1];
            
            this._restoreSnapshot(snapshotToRestore, 'Undo completed');
            // Save changes after undo
            this.debounceSaveChanges();
        } catch (error) {
            console.error('Error during undo:', error);
            this.notificationService.add(_t('Undo failed'), { title: _t('Error'), type: 'danger' });
        }
    }

    /**
     * Redo the last undone action by restoring from redo history
     * Provides user feedback and moves state back to main history
     * @private
     */
    _actionRedo() {
        if (this.redoHistory.length === 0) {
            this.notificationService.add(_t('Nothing to redo'), { type: 'info' });
            return;
        }
        
        try {
            const snapshotToRestore = this.redoHistory.pop();
            this.history.push(snapshotToRestore);
            
            this._restoreSnapshot(snapshotToRestore, 'Redo completed');

            // Save changes after redo
            this.debounceSaveChanges();
        } catch (error) {
            console.error('Error during redo:', error);
            this.notificationService.add(_t('Redo failed'), { type: 'danger' });
        }
    }

    /**
     * Restore Terra Draw to a previous state snapshot
     * @param {Array} snapshot - Array of GeoJSON features representing the state to restore
     * @param {string} successMessage - Message to display on successful restoration
     * @returns {Promise<void>}
     * @private
     */
    async _restoreSnapshot(snapshot, successMessage) {
        this.state.isRestoring = true;
        
        try {
            this.terraDrawInstance.clear();
            if (snapshot.length > 0) {
                // Note: Snapshot features should already be Terra Draw compatible
                // since they were processed when first loaded or created through drawing
                this.terraDrawInstance.addFeatures(snapshot);
            }
            
            await new Promise(resolve => setTimeout(resolve, TERRA_DRAW_CONFIG.UNDO_RESTORE_DELAY));
            this.notificationService.add(_t(successMessage), { title: _t('Restore'), type: 'success' });
        } finally {
            this.state.isRestoring = false;
        }
    }

    /**
     * Check if a feature is part of a processed MultiPolygon
     * @param {Object} feature - Feature to check
     * @returns {boolean} True if feature is a MultiPolygon part
     * @public
     */
    isMultiPolygonPart(feature) {
        const metadata = feature?.properties?._metadata || {};
        return metadata.originalType === 'MultiPolygon' && 
               typeof metadata.partIndex === 'number';
    }

    /**
     * Get all parts of a MultiPolygon feature
     * @param {string} originalId - Original MultiPolygon ID
     * @returns {Array} Array of polygon parts
     * @public
     */
    getMultiPolygonParts(originalId) {
        if (!this.terraDrawInstance) return [];
        
        const features = this.terraDrawInstance.getSnapshot();
        return features.filter(f => {
            const metadata = f.properties?._metadata || {};
            return metadata.originalId === originalId && this.isMultiPolygonPart(f);
        }).sort((a, b) => {
            const aIndex = a.properties._metadata?.partIndex || 0;
            const bIndex = b.properties._metadata?.partIndex || 0;
            return aIndex - bIndex;
        });
    }

    /**
     * Toggle resize mode for drawn features
     * Switches between draggable coordinates and resizable coordinates
     * @private
     */
    _actionResize() {
        this.state.resizingEnabled = !this.state.resizingEnabled;
        const flags = {
            polygon: {
                feature: {
                    draggable: true,
                    coordinates: {
                        resizable: this.state.resizingEnabled ? 'center' : undefined,
                        draggable: !this.state.resizingEnabled,
                    },
                },
            },
            linestring: {
                feature: {
                    draggable: true,
                    coordinates: {
                        resizable: this.state.resizingEnabled ? 'center' : undefined,
                        draggable: !this.state.resizingEnabled,
                    },
                },
            },
            rectangle: {
                feature: {
                    draggable: true,
                    coordinates: {
                        resizable: this.state.resizingEnabled ? 'center' : undefined,
                        draggable: !this.state.resizingEnabled,
                    },
                },
            },
            circle: {
                feature: {
                    draggable: true,
                    coordinates: {
                        resizable: this.state.resizingEnabled ? 'center' : undefined,
                        draggable: !this.state.resizingEnabled,
                    },
                },
            },
            freehand: {
                feature: {
                    draggable: true,
                    coordinates: {
                        resizable: this.state.resizingEnabled ? 'center' : undefined,
                        draggable: !this.state.resizingEnabled,
                    },
                },
            },
        };
        this.terraDrawInstance.updateModeOptions('select', { flags });
    }

    _actionProcessSnapshotForUndo(snapshot) {
        return snapshot.map((feature) => {
            const newFeature = JSON.parse(JSON.stringify(feature));
            if (newFeature.properties.mode === 'rectangle') {
                newFeature.geometry.type = 'Polygon';
                newFeature.properties.mode = 'polygon';
            } else if (newFeature.properties.mode === 'circle') {
                newFeature.geometry.type = 'Polygon';
                // The radius is already in properties, so we just need to ensure the mode is correct for re-creation
                newFeature.properties.mode = 'circle';
            }
            return newFeature;
        });
    }

    /**
     * Update the visual active state of mode buttons in the UI
     * @param {string} modeId - ID of the mode button to make active
     * @public
     */
    updateActiveButton(modeId) {
        this.toolsUiRef.el.querySelectorAll('.mode-button').forEach((btn) => {
            btn.classList.remove('active');
        });
        this.toolsUiRef.el.querySelector(`#${modeId}`)?.classList.add('active');
    }

    /**
     * Set the active drawing mode in Terra Draw
     * @param {string} mode - Mode identifier (e.g., 'select-mode', 'polygon-mode')
     * @public
     */
    setActiveMode(mode) {
        const activeMode = MODE_BUTTONS[mode];
        if (!activeMode) {
            return;
        }
        this.terraDrawInstance.setMode(activeMode);
        this.state.currentMode = activeMode;
        this.updateActiveButton(mode);
    }

    /**
     * Set the currently selected feature ID and update component state
     * @param {string|null} id - Feature ID to select, or null to deselect
     * @public
     */
    setSelectedFeatureId(id) {
        this.state.selectedFeatureId = id;
    }

    /**
     * Initialize the Terra Draw instance with Google Maps integration
     * Validates prerequisites and calls the actual initialization
     * @returns {Promise<void>} Promise that resolves when Terra Draw is ready
     * @public
     */
    initTerraDraw() {
        return new Promise((resolve, reject) => {
            if (!this.props.googleMap) {
                return reject(new Error('Google Map instance is not available'));
            }
            if (!window.terraDraw || !window.terraDrawGoogleMapsAdapter) {
                return reject(new Error('Terra Draw libraries are not loaded'));
            }
            try {
                this._initializeTerraDrawInstance();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Create and configure the Terra Draw instance with Google Maps adapter
     * Handles both immediate initialization and delayed initialization via events
     * Sets up all drawing modes and event listeners
     * @private
     */
    _initializeTerraDrawInstance() {
        if (this.terraDrawInstance || !this.props.googleMap) {
            return;
        }

        // Function to create and start Terra Draw instance
        const createTerraDrawInstance = () => {
            this.terraDrawInstance = new window.terraDraw.TerraDraw({
                adapter: new window.terraDrawGoogleMapsAdapter.TerraDrawGoogleMapsAdapter({
                    map: this.props.googleMap,
                    lib: google.maps,
                    coordinatePrecision: TERRA_DRAW_CONFIG.COORDINATE_PRECISION,
                }),
                modes: this._createTerraDrawModes(),
            });

            this.terraDrawInstance.start();
            this.terraDrawInstance.on('ready', () => {
                this.loadRecordData(this.props.dataGeoJson);
                this.setActiveMode('select-mode');
                this.terraDrawInstance.on('select', this.onDrawSelect.bind(this));
                this.terraDrawInstance.on('deselect', this.onDrawDeselect.bind(this));
                this.history.push(
                    this._actionProcessSnapshotForUndo(this.terraDrawInstance.getSnapshot())
                ); // push initial empty state
                this.terraDrawInstance.on('change', this.onDrawChange.bind(this));
                
                // Handle drawing completion - this is the correct place for measurement calculations
                // Using 'finish' event ensures measurements only show after drawing is complete,
                // preventing interference with the active drawing workflow
                this.terraDrawInstance.on('finish', () => {
                    this.notificationService.add(_t('Detected changes, saving on progress..'), { title: _t('Saving..'), type: 'info' });
                    this.debounceSaveChanges();
                    
                    // Show measurement for the newly completed feature if enabled
                    // This only triggers when drawing is actually finished, not during drawing
                    if (this.state.showMeasurements) {
                        setTimeout(() => {
                            const features = this.terraDrawInstance.getSnapshot();
                            const nonSystemFeatures = features.filter(f => 
                                !f.properties?.midPoint && !f.properties?.selectionPoint
                            );
                            if (nonSystemFeatures.length > 0) {
                                const lastFeature = nonSystemFeatures[nonSystemFeatures.length - 1];
                                const measurement = this._calculateFeatureMeasurement(lastFeature);
                                if (measurement) {
                                    this._showMeasurementNotification(measurement);
                                }
                            }
                        }, 100);
                    }
                });
            });
        };

        // Check if map projection is already available
        const projection = this.props.googleMap.getProjection();
        if (projection) {
            // Projection is already available, create instance immediately
            createTerraDrawInstance();
        } else {
            // Projection not available yet, wait for it
            this.eventProjectionChanges = this.props.googleMap.addListener('projection_changed', () => {
                // Remove the listener after first execution
                if (this.eventProjectionChanges) {
                    google.maps.event.removeListener(this.eventProjectionChanges);
                    this.eventProjectionChanges = null;
                }
                createTerraDrawInstance();
            });

            // Fallback: if projection_changed doesn't fire within reasonable time
            this.initTimeout = setTimeout(() => {
                if (!this.terraDrawInstance && this.props.googleMap) {
                    if (this.eventProjectionChanges) {
                        google.maps.event.removeListener(this.eventProjectionChanges);
                        this.eventProjectionChanges = null;
                    }
                    createTerraDrawInstance();
                }
            }, 2000); // 2 second fallback
        }
    }

    /**
     * Calculate measurements for a given feature based on its geometry type
     * @param {Object} feature - GeoJSON feature to measure
     * @param {Object} feature.geometry - Geometry object
     * @param {string} feature.geometry.type - Geometry type
     * @param {Array} feature.geometry.coordinates - Coordinate array
     * @param {Object} [feature.properties] - Feature properties
     * @returns {Object} Measurement results with formatted strings
     * @private
     */
    _calculateFeatureMeasurement(feature) {
        if (!feature || !feature.geometry) return null;
        
        const { type, coordinates } = feature.geometry;
        const unit = this.state.measurementUnit;
        const measurements = {};
        
        try {
            switch (type) {
                case 'Point':
                    measurements.type = 'Point';
                    const lat = coordinates[1];
                    const lng = coordinates[0];
                    const latDir = lat >= 0 ? 'N' : 'S';
                    const lngDir = lng >= 0 ? 'E' : 'W';
                    measurements.coordinates = `${Math.abs(lat).toFixed(MEASUREMENT_CONFIG.COORDINATE_PRECISION)}°${latDir}, ${Math.abs(lng).toFixed(MEASUREMENT_CONFIG.COORDINATE_PRECISION)}°${lngDir}`;
                    break;
                    
                case 'LineString':
                    const length = calculateLineStringLength(coordinates, unit);
                    measurements.type = 'Line';
                    measurements.length = formatMeasurement(length, 'distance', unit);
                    measurements.points = formatPointCount(coordinates.length);
                    break;
                    
                case 'Polygon':
                    const area = calculatePolygonArea(coordinates[0], unit);
                    const perimeter = calculateLineStringLength(coordinates[0], unit);
                    measurements.type = 'Polygon';
                    measurements.area = formatMeasurement(area, 'area', unit);
                    measurements.perimeter = formatMeasurement(perimeter, 'distance', unit);
                    measurements.points = formatPointCount(coordinates[0].length - 1); // Exclude closing point
                    
                    // Add MultiPolygon part information if applicable
                    if (this.isMultiPolygonPart(feature)) {
                        const metadata = feature.properties?._metadata || {};
                        measurements.type = metadata.isMainLandmass ? 'Main Area' : `Island ${metadata.partIndex}`;
                        measurements.partInfo = `Part ${metadata.partIndex + 1} of ${metadata.totalParts}`;
                        if (metadata.partName) {
                            measurements.partName = metadata.partName;
                        }
                    }
                    break;
                    
                case 'MultiPoint':
                    measurements.type = 'Multi Point';
                    measurements.points = formatPointCount(coordinates.length);
                    break;
                    
                case 'MultiLineString':
                    let totalLength = 0;
                    let totalPoints = 0;
                    coordinates.forEach(line => {
                        totalLength += calculateLineStringLength(line, unit);
                        totalPoints += line.length;
                    });
                    measurements.type = 'Multi Line';
                    measurements.length = formatMeasurement(totalLength, 'distance', unit);
                    measurements.lines = `${formatNumber(coordinates.length, 0)} ${coordinates.length === 1 ? 'line' : 'lines'}`;
                    measurements.points = formatPointCount(totalPoints);
                    break;
                    
                case 'MultiPolygon':
                    let totalArea = 0;
                    let totalPerimeter = 0;
                    let totalPolygonPoints = 0;
                    coordinates.forEach(polygon => {
                        totalArea += calculatePolygonArea(polygon[0], unit);
                        totalPerimeter += calculateLineStringLength(polygon[0], unit);
                        totalPolygonPoints += polygon[0].length - 1;
                    });
                    measurements.type = 'Multi Polygon';
                    measurements.area = formatMeasurement(totalArea, 'area', unit);
                    measurements.perimeter = formatMeasurement(totalPerimeter, 'distance', unit);
                    measurements.polygons = `${formatNumber(coordinates.length, 0)} ${coordinates.length === 1 ? 'polygon' : 'polygons'}`;
                    measurements.points = formatPointCount(totalPolygonPoints);
                    break;
            }
            
            // Handle special Terra Draw modes
            if (feature.properties) {
                if (feature.properties.mode === 'rectangle') {
                    measurements.type = 'Rectangle';
                    const area = calculatePolygonArea(coordinates[0], unit);
                    const perimeter = calculateLineStringLength(coordinates[0], unit);
                    measurements.area = formatMeasurement(area, 'area', unit);
                    measurements.perimeter = formatMeasurement(perimeter, 'distance', unit);
                } else if (feature.properties.mode === 'circle') {
                    measurements.type = 'Circle';
                    if (feature.properties.center && feature.properties.radiusKilometers) {
                        const radiusInUnit = unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL ? 
                            feature.properties.radiusKilometers * 0.621371 : 
                            feature.properties.radiusKilometers;
                        const area = calculateCircleArea(radiusInUnit, unit);
                        const circumference = 2 * Math.PI * radiusInUnit;
                        measurements.radius = formatMeasurement(radiusInUnit, 'distance', unit);
                        measurements.area = formatMeasurement(area, 'area', unit);
                        measurements.circumference = formatMeasurement(circumference, 'distance', unit);
                    }
                } else if (feature.properties.mode === 'freehand') {
                    measurements.type = 'Freehand';
                    if (type === 'Polygon') {
                        const area = calculatePolygonArea(coordinates[0], unit);
                        const perimeter = calculateLineStringLength(coordinates[0], unit);
                        measurements.area = formatMeasurement(area, 'area', unit);
                        measurements.perimeter = formatMeasurement(perimeter, 'distance', unit);
                    } else if (type === 'LineString') {
                        const length = calculateLineStringLength(coordinates, unit);
                        measurements.length = formatMeasurement(length, 'distance', unit);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error calculating measurements:', error);
            return null;
        }
        
        return measurements;
    }

    /**
     * Get measurements for all current features
     * @returns {Array} Array of measurement objects for each feature
     * @public
     */
    getAllFeatureMeasurements() {
        if (!this.terraDrawInstance) return [];
        
        try {
            const features = this.terraDrawInstance.getSnapshot();
            const measurements = [];
            
            features.forEach((feature, index) => {
                // Skip system features like midpoints and selection points
                if (feature.properties?.midPoint || feature.properties?.selectionPoint) {
                    return;
                }
                
                const measurement = this._calculateFeatureMeasurement(feature);
                if (measurement) {
                    measurements.push({
                        id: feature.id,
                        index: index + 1,
                        ...measurement
                    });
                }
            });
            
            return measurements;
        } catch (error) {
            console.error('Error getting all measurements:', error);
            return [];
        }
    }

    /**
     * Get measurement for the currently selected feature
     * @returns {Object|null} Measurement object or null if no feature selected
     * @public
     */
    getSelectedFeatureMeasurement() {
        if (!this.state.selectedFeatureId || !this.terraDrawInstance) return {};
        
        try {
            const features = this.terraDrawInstance.getSnapshot();
            const selectedFeature = features.find(f => f.id === this.state.selectedFeatureId);
            
            if (selectedFeature) {
                return this._calculateFeatureMeasurement(selectedFeature);
            }
        } catch (error) {
            console.error('Error getting selected feature measurement:', error);
        }
        
        return {};
    }

    /**
     * Toggle measurement unit between metric and imperial
     * @public
     */
    toggleMeasurementUnit() {
        this.state.measurementUnit = this.state.measurementUnit === MEASUREMENT_CONFIG.UNITS.METRIC ? 
            MEASUREMENT_CONFIG.UNITS.IMPERIAL : 
            MEASUREMENT_CONFIG.UNITS.METRIC;
        
        const unitName = this.state.measurementUnit === MEASUREMENT_CONFIG.UNITS.METRIC ? 'Metric' : 'Imperial';
        this.notificationService.add(
            _t('Measurement unit changed to %s', unitName),
            { type: 'info' }
        );
    }

    /**
     * Toggle measurement display on/off
     * @public
     */
    toggleMeasurementDisplay() {
        this.state.showMeasurements = !this.state.showMeasurements;
        
        const status = this.state.showMeasurements ? 'enabled' : 'disabled';
        this.notificationService.add(
            _t('Measurement display %s', status),
            { type: 'info' }
        );
    }

    /**
     * Export all measurements as a structured object for external use
     * @returns {Object} Structured measurement data
     * @public
     */
    exportMeasurements() {
        const measurements = this.getAllFeatureMeasurements();
        const summary = {
            unit: this.state.measurementUnit,
            unitName: this.state.measurementUnit === MEASUREMENT_CONFIG.UNITS.METRIC ? 'Metric' : 'Imperial',
            totalFeatures: measurements.length,
            features: measurements,
            exportedAt: new Date().toISOString()
        };
        
        // Calculate totals by type
        const totals = {
            totalLength: 0,
            totalArea: 0,
            totalPerimeter: 0,
            pointCount: 0,
            lineCount: 0,
            polygonCount: 0,
            circleCount: 0
        };
        
        measurements.forEach(m => {
            if (m.type.toLowerCase().includes('point')) totals.pointCount++;
            if (m.type.toLowerCase().includes('line')) totals.lineCount++;
            if (m.type.toLowerCase().includes('polygon') || m.type.toLowerCase().includes('rectangle')) totals.polygonCount++;
            if (m.type.toLowerCase().includes('circle')) totals.circleCount++;
        });
        
        summary.totals = totals;
        return summary;
    }

    /**
     * Copy measurements to clipboard as formatted text
     * @param {boolean} selectedOnly - If true, copy only selected feature measurement
     * @returns {Promise<boolean>} Success status
     * @public
     */
    async copyMeasurementsToClipboard(selectedOnly = false) {
        try {
            let text = '';
            
            if (selectedOnly && this.state.selectedFeatureId) {
                const measurement = this.getSelectedFeatureMeasurement();
                if (measurement) {
                    text = this._formatMeasurementText(measurement);
                } else {
                    this.notificationService.add(_t('No measurement available for selected feature'), { type: 'warning' });
                    return false;
                }
            } else {
                const allMeasurements = this.getAllFeatureMeasurements();
                if (allMeasurements.length === 0) {
                    this.notificationService.add(_t('No features to copy measurements for'), { type: 'warning' });
                    return false;
                }
                
                const unitName = this.state.measurementUnit === MEASUREMENT_CONFIG.UNITS.METRIC ? 'Metric' : 'Imperial';
                text = `Feature Measurements (${unitName})\n`;
                text += '='.repeat(30) + '\n\n';
                
                allMeasurements.forEach((measurement, index) => {
                    text += `${index + 1}. ${this._formatMeasurementText(measurement)}\n\n`;
                });
                
                text += `Total: ${allMeasurements.length} feature(s)\n`;
                text += `Exported: ${new Date().toLocaleString()}`;
            }
            
            await navigator.clipboard.writeText(text);
            this.notificationService.add(
                _t('Measurements copied to clipboard'),
                { type: 'success' }
            );
            return true;
        } catch (error) {
            console.error('Failed to copy measurements:', error);
            this.notificationService.add(
                _t('Failed to copy measurements to clipboard'),
                { type: 'danger' }
            );
            return false;
        }
    }

    /**
     * Format a single measurement object as readable text
     * @param {Object} measurement - Measurement object to format
     * @returns {string} Formatted text
     * @private
     */
    _formatMeasurementText(measurement) {
        let text = measurement.type;
        const details = [];
        
        if (measurement.coordinates) details.push(`Coordinates: ${measurement.coordinates}`);
        if (measurement.length) details.push(`Length: ${measurement.length}`);
        if (measurement.area) details.push(`Area: ${measurement.area}`);
        if (measurement.perimeter) details.push(`Perimeter: ${measurement.perimeter}`);
        if (measurement.radius) details.push(`Radius: ${measurement.radius}`);
        if (measurement.circumference) details.push(`Circumference: ${measurement.circumference}`);
        if (measurement.points) details.push(`Points: ${measurement.points}`);
        
        if (details.length > 0) {
            text += '\n  ' + details.join('\n  ');
        }
        
        return text;
    }

    /**
     * Handle Terra Draw feature selection events
     * Ensures only one feature is selected at a time and displays measurements
     * This is one of the two appropriate places for measurement calculations
     * (the other being the 'finish' event for newly completed drawings)
     * @param {string} id - ID of the selected feature
     * @private
     */
    onDrawSelect(id) {
        if (this.state.selectedFeatureId && this.state.selectedFeatureId !== id) {
            this.terraDrawInstance.deselectFeature(this.state.selectedFeatureId);
        }
        this.setSelectedFeatureId(id);
        
        // Show measurement for selected feature if enabled
        // Safe to calculate here as this only triggers when selecting existing features
        // if (this.state.showMeasurements) {
        //     const measurement = this.getSelectedFeatureMeasurement();
        //     if (measurement) {
        //         this._showMeasurementNotification(measurement);
        //     }
        // }
    }

    /**
     * Handle Terra Draw feature deselection events
     * @private
     */
    onDrawDeselect() {
        this.setSelectedFeatureId(null);
    }

    /**
     * Handle Terra Draw change events (feature creation, modification, deletion)
     * Updates history for undo/redo functionality and triggers debounced save
     * @private
     */
    onDrawChange() {
        if (this.state.isRestoring || this.state.isSaving) {
            return;
        }
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        this.debounceTimeout = setTimeout(() => {
            if (!this.terraDrawInstance) return;
            const snapshot = this.terraDrawInstance.getSnapshot();
            const processedSnapshot = this._actionProcessSnapshotForUndo(snapshot);
            const filteredSnapshot = processedSnapshot.filter(
                (f) => !f.properties.midPoint && !f.properties.selectionPoint
            );
            this.history.push(filteredSnapshot);
            this.redoHistory = [];
        }, 500);
    }

    /**
     * Show a notification with measurement information
     * @param {Object} measurement - Measurement object to display
     * @private
     */
    _showMeasurementNotification(measurement) {
        if (!measurement) return;
        
        let message = `${measurement.type}`;
        let details = [];
        
        if (measurement.coordinates) {
            details.push(`Coordinates: ${measurement.coordinates}`);
        }
        if (measurement.length) {
            details.push(`Length: ${measurement.length}`);
        }
        if (measurement.area) {
            details.push(`Area: ${measurement.area}`);
        }
        if (measurement.perimeter) {
            details.push(`Perimeter: ${measurement.perimeter}`);
        }
        if (measurement.radius) {
            details.push(`Radius: ${measurement.radius}`);
        }
        if (measurement.circumference) {
            details.push(`Circumference: ${measurement.circumference}`);
        }
        if (measurement.points) {
            details.push(`Points: ${measurement.points}`);
        }
        
        if (details.length > 0) {
            message += ` - ${details.join(', ')}`;
        }
        
        this.notificationService.add(
            _t(message),
            { title: _t('Measurement'), type: 'info' }
        );
    }

    async _saveChanges() {
        try {
            const snapshot = this.terraDrawInstance.getSnapshot();
            const geoJson = {
                type: 'FeatureCollection',
                features: snapshot,
            };

            this.state.isSaving = true;
            await this.props.saveFeatures(geoJson);

            this.notificationService.add(
                _t('Changes saved successfully'), 
                { title: _t('Saved'), type: 'success' }
            );
        } catch (error) {
            console.error('Save failed:', error);
            this.notificationService.add(
                _t('Failed to save changes: %s', error.message), 
                { title: _t('Error'), type: 'danger' }
            );
        } finally {
            this.state.isSaving = false;
        }
    }

    /**
     * Get default feature options for Terra Draw modes
     * Defines interaction capabilities for drawn features
     * @returns {Object} Configuration object for feature interactions
     * @public
     */
    get featureOptions() {
        return {
            feature: {
                draggable: true,
                rotateable: true,
                coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                },
            },
        };
    }

    getShapeColor() {
        return getRandomColor();
    }

    _createTerraDrawModes() {
        const modes = [];
        const modeCreators = [
            { name: 'Select', creator: () => this._createTerraDrawSelectMode() },
            { name: 'Point', creator: () => this._createTerraDrawPointMode() },
            { name: 'LineString', creator: () => this._createTerraDrawLineStringMode() },
            { name: 'Polygon', creator: () => this._createTerraDrawPolygonMode() },
            { name: 'Rectangle', creator: () => this._createTerraDrawRectangleMode() },
            { name: 'Circle', creator: () => this._createTerraDrawCircleMode() },
            { name: 'Freehand', creator: () => this._createTerraDrawFreehandMode() },
        ];
        
        modeCreators.forEach(({ name, creator }) => {
            try {
                modes.push(creator());
            } catch (error) {
                console.error(`Failed to create ${name} mode:`, error);
                this.notificationService.add(
                    _t('Failed to initialize %s drawing mode', name),
                    { title: _t('Error'), type: 'warning' }
                );
            }
        });
        
        return modes;
    }

    /**
     * Create Terra Draw select mode for selecting and manipulating existing features
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawSelectMode instance
     * @private
     */
    _createTerraDrawSelectMode(options) {
        const opt = Object.assign(
            {
                flags: {
                    polygon: this.featureOptions,
                    linestring: this.featureOptions,
                    point: {
                        feature: {
                            draggable: true,
                            rotateable: true,
                        },
                    },
                    rectangle: this.featureOptions,
                    circle: this.featureOptions,
                    freehand: this.featureOptions,
                },
            },
            options || {}
        );
        return new window.terraDraw.TerraDrawSelectMode(opt);
    }

    /**
     * Create Terra Draw point mode for drawing individual points
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawPointMode instance
     * @private
     */
    _createTerraDrawPointMode(options) {
        const color = this.getShapeColor();
        const opt = Object.assign(
            {
                editable: true,
                styles: {
                    pointColor: color,
                },
            },
            options || {}
        );
        return new window.terraDraw.TerraDrawPointMode(opt);
    }

    /**
     * Create Terra Draw line string mode for drawing connected line segments
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawLineStringMode instance
     * @private
     */
    _createTerraDrawLineStringMode(options) {
        const color = this.getShapeColor();
        const opt = Object.assign(
            {
                editable: true,
                styles: {
                    lineStringColor: color,
                },
            },
            options || {}
        );
        return new window.terraDraw.TerraDrawLineStringMode(opt);
    }

    /**
     * Create Terra Draw polygon mode for drawing closed polygon shapes
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawPolygonMode instance
     * @private
     */
    _createTerraDrawPolygonMode(options) {
        const color = this.getShapeColor();
        const opt = Object.assign(
            {
                styles: {
                    fillColor: color,
                    outlineColor: color,
                },
            },
            options || {}
        );
        return new window.terraDraw.TerraDrawPolygonMode(opt);
    }

    /**
     * Create Terra Draw rectangle mode for drawing rectangular shapes
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawRectangleMode instance
     * @private
     */
    _createTerraDrawRectangleMode(options) {
        const color = this.getShapeColor();
        const opt = Object.assign(
            {
                styles: {
                    fillColor: color,
                    outlineColor: color,
                },
            },
            options || {}
        );
        return new window.terraDraw.TerraDrawRectangleMode(opt);
    }

    /**
     * Create Terra Draw circle mode for drawing circular shapes
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawCircleMode instance
     * @private
     */
    _createTerraDrawCircleMode(options) {
        const color = this.getShapeColor();
        const opt = Object.assign(
            {
                styles: {
                    fillColor: color,
                    outlineColor: color,
                },
            },
            options || {}
        );
        return new window.terraDraw.TerraDrawCircleMode(opt);
    }

    /**
     * Create Terra Draw freehand mode for drawing freeform shapes
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawFreehandMode instance
     * @private
     */
    _createTerraDrawFreehandMode(options) {
        const color = this.getShapeColor();
        const opt = Object.assign(
            {
                styles: {
                    fillColor: color,
                    outlineColor: color,
                },
            },
            options || {}
        );
        return new window.terraDraw.TerraDrawFreehandMode(opt);
    }

    /**
     * Clean up all resources when the component is destroyed
     * Clears timeouts, removes event listeners, stops Terra Draw instance,
     * resets state, and logs cleanup completion
     * @private
     */
    _cleanup() {
        // Clear any pending timeouts first
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }
        
        if (this.initTimeout) {
            clearTimeout(this.initTimeout);
            this.initTimeout = null;
        }
        
        // Remove Google Maps event listeners
        if (this.eventProjectionChanges) {
            try {
                google.maps.event.removeListener(this.eventProjectionChanges);
            } catch (error) {
                console.warn('Error removing projection_changed listener:', error);
            }
            this.eventProjectionChanges = null;
        }
        
        // Clean up Terra Draw instance
        if (this.terraDrawInstance) {
            try {
                // Remove all Terra Draw event listeners
                this.terraDrawInstance.off('ready');
                this.terraDrawInstance.off('select');
                this.terraDrawInstance.off('deselect');
                this.terraDrawInstance.off('change');
                this.terraDrawInstance.off('finish');
                
                // Clear all features and stop the instance
                this.terraDrawInstance.clear();
                this.terraDrawInstance.stop();
            } catch (error) {
                console.warn('Error cleaning up TerraDraw instance:', error);
            }
            this.terraDrawInstance = null;
        }
        
        // Clear history arrays
        this.history = [];
        this.redoHistory = [];
        
        // Reset state
        this.state.currentMode = null;
        this.state.activeButton = null;
        this.state.selectedFeatureId = null;
        this.state.isRestoring = null;
        this.state.resizingEnabled = null;
        this.state.isSaving = null;
        // Keep measurement settings as they are user preferences
        // this.state.measurementUnit = MEASUREMENT_CONFIG.UNITS.METRIC;
        // this.state.showMeasurements = true;
        
        // Clear bounds
        this.latLngBounds = null;
    }
}
