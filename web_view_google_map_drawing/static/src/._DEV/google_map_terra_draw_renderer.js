/**
 * @fileoverview Terra Draw Readonly Renderer for Google Maps Integration
 * 
 * This module provides a readonly display interface for Google Maps using the Terra Draw library.
 * It displays GeoJSON features with measurement capabilities but without editing functionality.
 * 
 * Key Features:
 * - Readonly display of GeoJSON features (Point, LineString, Polygon, Rectangle, Circle)
 * - Real-time measurement display for all geometry types
 * - Comprehensive measurement calculations (area, perimeter, length, coordinates)
 * - Professional number formatting with locale support
 * - Measurement unit toggling (metric/imperial)
 * - Feature selection with measurement display
 * - Click-to-view measurements on features
 * 
 * @author Yan - https://github.com/yan
 * @version 1.0.0
 * @requires Terra Draw Library
 * @requires Google Maps JavaScript API
 */

import { _t } from '@web/core/l10n/translation';
import { loadJS } from '@web/core/assets';
import { useService, useBus } from '@web/core/utils/hooks';
import {
    Component,
    useEffect,
    useState,
    useRef,
    useSubEnv,
    onPatched,
    onWillStart,
    onWillDestroy,
    onWillUpdateProps,
} from '@odoo/owl';
import { isNull } from '@web/views/utils';
import { getHexColorPicker } from '@web_view_google_map/views/google_map/utils';
import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { MAX_AUTO_ZOOM, MARKER_BATCH_SIZE } from '@web_view_google_map/views/google_map/google_map_renderer'; 
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';
import { LOADER_STATUS } from '@base_google_map/utils/loader_google_map';
import { GoogleMapsDrawingSidebar } from './google_map_drawing_sidebar';
import { getRandomColor, calculatePolygonArea, calculateCircleArea, calculateLineStringLength, formatNumber, formatMeasurement, formatPointCount, MEASUREMENT_CONFIG, TERRA_DRAW_CONFIG, COLOR_PALETTE } from '../components/terra-tools-ui/terra-tools-ui';

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
 * Normalize coordinates to remove excessive precision
 * @param {Array} coordinates - Coordinate array to normalize
 * @param {number} precision - Number of decimal places (default: 10)
 * @returns {Array} - Normalized coordinates
 */
export function normalizeCoordinates(coordinates, precision = 10) {
    if (!Array.isArray(coordinates)) return coordinates;
    
    return coordinates.map(coord => {
        if (Array.isArray(coord)) {
            return normalizeCoordinates(coord, precision);
        } else if (typeof coord === 'number') {
            return parseFloat(coord.toFixed(precision));
        }
        return coord;
    });
}

/**
 * Terra Draw Readonly Renderer Component
 * 
 * A readonly display component that integrates Terra Draw with Google Maps
 * to display GeoJSON features with measurement capabilities.
 * 
 * @class GoogleMapTerraDrawRenderer
 * @extends Component
 * 
 * Features:
 * - Readonly display of GeoJSON features
 * - Feature selection with measurement display
 * - Real-time measurement calculations with professional formatting
 * - Measurement unit toggling (metric/imperial)
 * - Click-to-view measurements on features
 * 
 * Measurement Capabilities:
 * - Points: Coordinates with directional indicators (N/S, E/W)
 * - Lines: Length calculation with point count
 * - Polygons: Area and perimeter calculations
 * - Rectangles: Area and perimeter calculations  
 * - Circles: Area, radius, and circumference calculations
 * - Professional number formatting with appropriate units
 * 
 * Props:
 * @param {Object} googleMap - Google Maps instance
 * @param {Object} dataGeoJson - GeoJSON data to display
 * @param {boolean} showMeasurements - Whether to display measurements (default: true)
 * @param {string} measurementUnit - Unit system ('metric' or 'imperial', default: 'metric')
 */
export class GoogleMapTerraDrawRenderer extends BaseGoogleMapComponent {
    static template = 'web_view_google_map.GoogleMapRenderer';
    static components = {
        Geolocate: GoogleMapGeolocate,
        Sidebar: GoogleMapsDrawingSidebar,
        InMapSearchPlaces: GoogleMapSearchPlaces,
    };
    static props = {
        archInfo: Object,
        openRecord: Function,
        showRecord: Function,
        showRecordsByDomain: Function,
        readonly: Boolean,
        list: Object,
        onAdd: { type: Function, optional: true },
        activeActions: { type: Object, optional: true },
        allowSelectors: Boolean,
    };

    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.notificationService = useService('notification');
        this.uiService = useService("ui");

        this._isSidebarAction = false;

        this.state = useState({
            // flag to check if sidebar is folded or not
            sidebarIsFolded: false,
            // flag to Google Maps API loader status
            loaderStatus: LOADER_STATUS.NOT_LOADED,
            // flag to control when to update markers
            groupDatalistId: null,
        });

        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        this.shapes = new Map();
        this.prevShapeSelected = null;
        this.currentShapeSelected = null;
        this.shapesBounds = null;

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        onWillStart(async () => {
            await this._loadTerraDrawAssets();
        });

        useEffect(
            () => {
                if (this.state.groupDatalistId && this.isMapLoaded() && !this._isSidebarAction) {
                    this.renderGeolocationData();
                }
                this._isSidebarAction = false;
            },
            () => [this.state.groupDatalistId]
        );

        useEffect(() => {
            if (this.isMapLoaded() && !this.state.groupDatalistId && !this._isSidebarAction) {
                const isGrouped = this.props.list.isGrouped;
                if (isGrouped) {
                    this.state.groupDatalistId = this._generateUniqueId();
                } else {
                    this.renderGeolocationData();
                }
                this._isSidebarAction = false;
            }
        });

        onWillUpdateProps(() => {
            this.state.groupDatalistId = this._generateUniqueId();
        });

        onPatched(() => {
            if (this._isSidebarAction) {
                this._isSidebarAction = false;
            }
            if (this.state.groupDatalistId && !this.props.list.isGrouped) {
                this.state.groupDatalistId = null;
            }
        });

        if (this.props.allowSelectors) {
            useBus(this.uiService.bus, 'google-map-center-map', this.centerMap);
        }
    }

    /**
     * Toggle sidebar expand/collapse state
     */
    toggleSidebar() {
        this._isSidebarAction = true;
        this.state.sidebarIsFolded = !this.state.sidebarIsFolded;
    }

    /**
     * @override
     * @returns {HTMLElement|false} Map DOM element
     */
    mapDivElement() {
        return this.mapRef.el;
    }

    /**
     * @overwrite
     */
    renderGeolocationData() {
        if (!this.isMapLoaded()) return;
        this.renderShapes();
    }

    async renderShapes() {
        const datas = this.getGroupsOrRecords();

        // Import marker library
        await this.apiLoader.importLibrary('marker');

        if (this.props.list.isGrouped) {
            this._renderGroupedShapes(datas);
        } else {
            this._renderUngroupShapes(datas);
        }
        // Fit map to bounds once all markers are rendered
        this._fitBoundsWhenReady();
    }

    /**
     * Centers the map to show all shapes
     */
    centerMap() {
        if (!this.isMapLoaded()) return;
        const mapBounds = new google.maps.LatLngBounds();
        if (this.shapesBounds && !this.shapesBounds.isEmpty()) {
            mapBounds.union(this.shapesBounds);
        }
        this.googleMap.fitBounds(mapBounds);
    }

    /**
     * Fit the map to current bounds with animation
     * @private
     */
    _fitBoundsWhenReady() {
        if (this.shapesBounds && !this.shapesBounds.isEmpty()) {
            this._fitMapBoundsWithLimit(this.shapesBounds);
        }
    }

    /**
     * Fit map to bounds with max zoom limit
     * @private
     * @param {Object} bounds Bounds to fit
     */
    _fitMapBoundsWithLimit(bounds) {
        if (!this.isMapLoaded() || bounds.isEmpty()) return;

        this.googleMap.fitBounds(bounds);

        // Limit zoom level after bounds fit
        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
            google.maps.event.trigger(this.googleMap, 'resize');
            if (this.googleMap && this.googleMap.getZoom() > MAX_AUTO_ZOOM) this.googleMap.setZoom(MAX_AUTO_ZOOM);
        });
    }

    /**
     * Render markers for ungrouped records with batching for performance
     * @private
     * @param {Array} datas Record data array
     */
    _renderUngroupShapes(datas) {
        if (!datas.length) return;

        const processBatch = (startIndex) => {
            const endIndex = Math.min(startIndex + MARKER_BATCH_SIZE, datas.length);

            for (let i = startIndex; i < endIndex; i++) {
                this.renderRecordGeoJSON(datas[i].record);
            }

            if (endIndex < datas.length) {
                if (window.requestIdleCallback) {
                    window.requestIdleCallback(() => processBatch(endIndex));
                } else {
                    setTimeout(() => processBatch(endIndex), 10);
                }
            }
        };

        // Use requestIdleCallback if available, otherwise setTimeout
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => processBatch(0));
        } else {
            setTimeout(() => processBatch(0), 0);
        }
    }

    /**
     * Render markers for grouped records
     * @private
     * @param {Array} datas Grouped data array
     */
    _renderGroupedShapes(datas) {
        datas.forEach(async ({ group }) => {
            try {
                const records = await group.groupRecords();
                records.forEach((record) => this.renderRecordGeoJSON(record, group.markerColor));
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        });
    }


    /**
     * Handles shape creation for a given record
     * @param {Object} record - The record containing shape data
     * @param {string} [color=false] - Optional color for the shape
     * @returns {Promise<Object|undefined>} The created shape object
     */
    async renderRecordGeoJSON(record, color = false) {
        try {
            const geoJson = record.data?.gshape_geojson;
            if (!geoJson || !this.terraDrawInstance) return;

            if (!geoJson?.features || !Array.isArray(geoJson.features)) {
                console.warn('Invalid GeoJSON data provided', { geoJson });
                return; // nothing to load
            }
            // Apply style to each feature
            // geoJson.features.forEach((feature) => {
            //     feature.properties = feature.properties || {};
            //     if (feature.geometry && ['Point', 'LineString'].includes(feature.geometry.type)) {
            //         feature.properties.fill = color; // for point fill
            //         feature.properties.line = color; // for line color
            //     } else if (feature.geometry && ['LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon', 'Circle', 'Rectangle'].includes(feature.geometry.type)) {
            //         feature.properties.fill = color; // for point fill
            //         feature.properties.stroke = color; // for line color
            //     }
            // });
            // console.log('Creating shape for record:', { record, geoJson });
            console.log(' record: ', record);
            this._loadGeoJsonFeatures(geoJson, color);
        } catch (error) {
            console.error('Error creating shape:', error);
            this.notificationService.add(_t('Failed to create shape'), { type: 'danger' });
        }
    }

    _loadGeoJsonFeatures(geoJsonData, color) {
        if (!this.terraDrawInstance || !geoJsonData) {
            console.log('Terra Draw instance not initialized or no GeoJSON data');
            return;
        }
        
        try {
            console.log('Loading GeoJSON features for readonly display:', geoJsonData);
            
            // Process features with enhanced MultiPolygon handling
            const processedFeatures = this._processGeoJsonFeatures(geoJsonData, color);
            console.log('Processed features for Terra Draw:', processedFeatures);
            
            // Validate feature structure before adding
            if (processedFeatures.length > 0) {
                const isValidFeature = validateTerraDrawFeature(processedFeatures[0]);
                console.log('Feature validation result:', isValidFeature);
            }
            
            // Check Terra Draw state before adding features
            console.log('Terra Draw current mode:', this.terraDrawInstance.getMode());
            console.log('Terra Draw has features before adding:', this.terraDrawInstance.hasFeature());
            
            // Ensure Terra Draw is in select mode for viewing features
            if (this.terraDrawInstance.getMode() !== 'select') {
                this.terraDrawInstance.setMode('select');
            }
            
            // Add features to Terra Draw
            this.terraDrawInstance.addFeatures(processedFeatures);
            
            // Check Terra Draw state after adding features
            console.log('Terra Draw has features after adding:', this.terraDrawInstance.hasFeature());
            console.log('Successfully loaded', processedFeatures.length, 'readonly features');
            
            // Debug: Check what features Terra Draw actually has
            setTimeout(() => {
                try {
                    const addedFeatures = this.terraDrawInstance.getSnapshot();
                    console.log('Features actually added to Terra Draw (readonly):', addedFeatures);
                    console.log('Terra Draw has features (final check):', this.terraDrawInstance.hasFeature());
                } catch (error) {
                    console.warn('Could not get Terra Draw snapshot:', error);
                }
            }, 100);
            
            // Fit map to bounds
            this._fitMapToBounds(processedFeatures);
            
        } catch (error) {
            console.error('Error loading GeoJSON features:', error);
        }
    }

    /**
     * Process GeoJSON features with enhanced MultiPolygon handling
     * @param {Object} geoJsonData - GeoJSON data
     * @param {string} color - Color for the features
     * @returns {Array} - Processed Terra Draw features
     */
    _processGeoJsonFeatures(geoJsonData, color) {
        console.log(`Loading ${geoJsonData.features.length} original features`);
        
        const processedFeatures = [];
        
        geoJsonData.features.forEach((feature, featureIndex) => {
            const geometry = feature.geometry;
            
            if (geometry.type === 'MultiPolygon') {
                console.log(`Processing MultiPolygon with ${geometry.coordinates.length} rings`);
                
                // Split MultiPolygon into individual polygons
                const splitPolygons = this._processComplexMultiPolygon(feature, color);
                processedFeatures.push(...splitPolygons);
                
                console.log(`Split MultiPolygon into ${splitPolygons.length} polygons`);
                
            } else {
                // Process single geometry features
                const processedFeature = this._createTerraDrawFeature(feature, color);
                if (processedFeature) {
                    processedFeatures.push(processedFeature);
                }
            }
        });
        
        console.log(`Processed into ${processedFeatures.length} Terra Draw compatible features`);
        return processedFeatures;
    }

    /**
     * Process complex MultiPolygon by splitting into individual polygons
     * @param {Object} multiPolygonFeature - Original MultiPolygon feature
     * @param {string} color - Color for the features
     * @returns {Array} - Array of individual polygon features
     */
    _processComplexMultiPolygon(multiPolygonFeature, color) {
        const polygonFeatures = [];
        const coordinates = multiPolygonFeature.geometry.coordinates;
        
        coordinates.forEach((polygonCoords, index) => {
            // Create individual polygon feature
            const polygonFeature = {
                type: 'Feature',
                id: generateUUID(), // Generate Terra Draw compatible UUID
                geometry: {
                    type: 'Polygon',
                    coordinates: normalizeCoordinates(polygonCoords)
                },
                properties: {
                    ...multiPolygonFeature.properties,
                    mode: 'polygon',
                    // Readonly properties
                    editable: false,
                    draggable: false,
                    rotateable: false,
                    scaleable: false,
                    deletable: false,
                    coordinatesDraggable: false,
                    coordinatesDeletable: false,
                    coordinatesAddable: false,
                    midpoints: false,
                    // Styling
                    fillColor: color,
                    fillOpacity: 0.3,
                    outlineColor: color,
                    outlineWidth: 1,
                    // Metadata
                    originalFeatureId: multiPolygonFeature.id,
                    partIndex: index,
                    totalParts: coordinates.length
                }
            };
            
            polygonFeatures.push(polygonFeature);
        });
        
        return polygonFeatures;
    }

    /**
     * Create Terra Draw compatible feature from GeoJSON feature
     * @param {Object} feature - Original GeoJSON feature
     * @param {string} color - Color for the feature
     * @returns {Object} - Terra Draw compatible feature
     */
    _createTerraDrawFeature(feature, color) {
        const geometry = feature.geometry;
        
        // Normalize coordinates
        const normalizedGeometry = {
            ...geometry,
            coordinates: normalizeCoordinates(geometry.coordinates)
        };
        
        // Generate Terra Draw compatible UUID if no ID exists
        const featureId = feature.id || generateUUID();
        
        // Determine Terra Draw mode based on geometry type
        const modeMap = {
            'Point': 'point',
            'LineString': 'linestring',
            'Polygon': 'polygon',
            'Circle': 'circle',
            'Rectangle': 'rectangle'
        };
        
        const mode = modeMap[geometry.type] || 'polygon';
        
        // Create Terra Draw feature with readonly properties
        const terraDrawFeature = {
            type: 'Feature',
            id: featureId,
            geometry: normalizedGeometry,
            properties: {
                ...feature.properties,
                mode: mode,
                // Readonly properties
                editable: false,
                draggable: false,
                rotateable: false,
                scaleable: false,
                deletable: false,
                coordinatesDraggable: false,
                coordinatesDeletable: false,
                coordinatesAddable: false,
                midpoints: false,
                // Styling based on geometry type
                ...this._getReadonlyStyleProperties(geometry.type, color)
            }
        };
        
        return terraDrawFeature;
    }

    /**
     * Get readonly style properties for different geometry types
     * @param {string} geometryType - Type of geometry
     * @param {string} color - Color for the feature
     * @returns {Object} - Style properties
     */
    _getReadonlyStyleProperties(geometryType, color) {
        switch (geometryType) {
            case 'Point':
                return {
                    pointColor: color,
                    pointOutlineColor: color
                };
                
            case 'LineString':
            case 'MultiLineString':
                return {
                    lineColor: color,
                    pointColor: color
                };
                
            case 'Polygon':
            case 'MultiPolygon':
            case 'Rectangle':
            case 'Circle':
                return {
                    fillColor: color,
                    fillOpacity: 0.3,
                    outlineColor: color,
                    outlineWidth: 2
                };
                
            default:
                return {
                    fillColor: color,
                    fillOpacity: 0.3,
                    outlineColor: color,
                    outlineWidth: 2
                };
        }
    }

    _setFeaturesReadonly(geojson, color) {
        try {
            // Process each feature to ensure readonly properties
            const readonlyFeatures = geojson.features.map(feature => {
                // Clone the feature to avoid modifying the original
                const readonlyFeature = JSON.parse(JSON.stringify(feature));
                
                // Ensure properties object exists
                if (!readonlyFeature.properties) {
                    readonlyFeature.properties = {};
                }
                
                // Set readonly properties to prevent editing
                readonlyFeature.properties.editable = false;
                readonlyFeature.properties.draggable = false;
                readonlyFeature.properties.rotateable = false;
                readonlyFeature.properties.scaleable = false;
                readonlyFeature.properties.deletable = false;
                
                // Set coordinate manipulation properties to readonly
                readonlyFeature.properties.coordinatesDraggable = false;
                readonlyFeature.properties.coordinatesDeletable = false;
                readonlyFeature.properties.coordinatesAddable = false;
                readonlyFeature.properties.midpoints = false;
                
                // Ensure proper styling for readonly display
                switch (readonlyFeature.geometry.type) {
                    case 'Point':
                        readonlyFeature.properties.pointColor = color;
                        readonlyFeature.properties.pointOutlineColor = color;
                        break;
                        
                    case 'LineString':
                    case 'MultiLineString':
                        readonlyFeature.properties.lineColor = color;
                        readonlyFeature.properties.pointColor = color;
                        break;
                        
                    case 'Polygon':
                    case 'MultiPolygon':
                    case 'Rectangle':
                    case 'Circle':
                        readonlyFeature.properties.fillColor = color;
                        readonlyFeature.properties.fillOpacity = readonlyFeature.properties.fillOpacity || 0.3;
                        readonlyFeature.properties.outlineColor = color;
                        readonlyFeature.properties.outlineWidth = readonlyFeature.properties.outlineWidth || 2;
                        break;
                }
                
                return readonlyFeature;
            });
            return readonlyFeatures;
        } catch (error) {
            console.error('Error setting features to readonly:', error);
            return geojson.features; // Fallback to original features on error
        }
    }
    

    async _fitMapToBounds(features) {
        console.log('_fitMapToBounds');
        if (features.length <= 0) return;
        
        try {
            if (!this.latLngBounds) {
                const { LatLngBounds } = await this.apiLoader.importLibrary('core');
                this.latLngBounds = new LatLngBounds();
            }

            features.forEach(feature => {
                this._extendBoundsFromFeature(feature);
            });

            if (!this.latLngBounds.isEmpty()) {
                this.googleMap.fitBounds(this.latLngBounds);
            }
        } catch (error) {
            console.warn('Failed to fit map bounds:', error);
        }
    }

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
     * Get current groups or records data
     * @returns {Array} Array of group or record data
     */
    getGroupsOrRecords() {
        if (!this.isMapLoaded()) return [];
        const { list } = this.props;

        const currentProps = {
            isGrouped: list.isGrouped,
            recordsIds: list.isGrouped
                ? list.groups.map((group) => group.id)
                : list.records.map((record) => record.id),
            length: list.isGrouped ? list.groups.length : list.records.length,
        };

        if (
            this.cachedGroupsOrRecords &&
            JSON.stringify(currentProps) === JSON.stringify(this.lastGroupsOrRecordsProps)
        ) {
            return this.cachedGroupsOrRecords;
        }

        let result;
        if (list.isGrouped) {
            result = [...list.groups]
                .sort((a, b) => (a.value && !b.value ? 1 : !a.value && b.value ? -1 : 0))
                .map((group, i) => ({
                    group,
                    key: isNull(group.value) ? `group_key_${i}` : `${String(group.value)}_${i}`,
                }));
        } else {
            result = list.records.map((record) => ({ record, key: record.id }));
        }

        this.lastGroupsOrRecordsProps = currentProps;
        this.cachedGroupsOrRecords = result;
        return result;
    }

    /**
     * Load Terra Draw library assets
     * @returns {Promise<void>}
     * @private
     */
    async _loadTerraDrawAssets() {
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
            console.error('Failed to load Terra Draw assets:', error);
            this.notificationService.add(
                _t('Failed to load drawing libraries. Please refresh the page.'),
                { type: 'danger' }
            );
        }
    }

    /**
     * @override
     */
    async onMapReady(map) {
        await super.onMapReady(map);
        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        this.shapesBounds = new LatLngBounds();
        this.markerInfoWindow = new google.maps.InfoWindow({ disableAutoPan: true });
        this.initializeTerraDrawInstance();
    }

    /**
     * Initialize the Terra Draw instance for readonly display
     * @returns {Promise<void>}
     * @public
     */
    initializeTerraDrawInstance() {
        return new Promise((resolve, reject) => {
            if (!this.googleMap) {
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
     * Create and configure the Terra Draw instance for readonly mode
     * @private
     */
    _initializeTerraDrawInstance() {
        if (this.terraDrawInstance || !this.googleMap) {
            return;
        }

        const createTerraDrawInstance = () => {
            // Create Terra Draw instance with only selection mode (readonly)
            this.terraDrawInstance = new window.terraDraw.TerraDraw({
                adapter: new window.terraDrawGoogleMapsAdapter.TerraDrawGoogleMapsAdapter({
                    map: this.googleMap,
                    lib: google.maps,
                    coordinatePrecision: TERRA_DRAW_CONFIG.COORDINATE_PRECISION,
                }),
                modes: this._createTerraDrawModes(),
            });

            this.terraDrawInstance.start();
            this.terraDrawInstance.on('ready', () => {
                this.terraDrawInstance.setMode('select');
                this.terraDrawInstance.on('select', this.onFeatureSelect.bind(this));
                this.terraDrawInstance.on('deselect', this.onFeatureDeselect.bind(this));
                
                // Load initial GeoJSON data if available
                this.renderGeolocationData();
            });
        };

        // Check if map projection is already available
        const projection = this.googleMap.getProjection();
        if (projection) {
            createTerraDrawInstance();
        } else {
            this.eventProjectionChanges = this.googleMap.addListener('projection_changed', () => {
                if (this.eventProjectionChanges) {
                    google.maps.event.removeListener(this.eventProjectionChanges);
                    this.eventProjectionChanges = null;
                }
                createTerraDrawInstance();
            });

            this.initTimeout = setTimeout(() => {
                if (!this.terraDrawInstance && this.googleMap) {
                    if (this.eventProjectionChanges) {
                        google.maps.event.removeListener(this.eventProjectionChanges);
                        this.eventProjectionChanges = null;
                    }
                    createTerraDrawInstance();
                }
            }, 2000);
        }
    }

    /**
     * Centers the map to show all shapes in a group
     * @param {Array} groupRecords - Array of records in the group
     * @returns {Promise<void>}
     */
    async centerMapByGroup(groupRecords) {
        if (!this.isMapLoaded() || !Array.isArray(groupRecords)) return;
        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        const bounds = new LatLngBounds();
        groupRecords.forEach((record) => {
            const shape = this.shapes.get(record.id);
            if (shape && shape.getShape().getMap()) {
                bounds.union(shape.getBounds());
            }
        });
        this._fitMapBoundsWithLimit(bounds);
    }

    /**
     * Returns base color options for shapes
     * @returns {Object} Shape color options
     * @private
     */
    _getBaseColorOptions() {
        return {
            strokeColor: '#fc3232',
            strokeOpacity: 0.55,
            strokeWeight: 0.85,
            fillColor: '#fa5a5a',
            fillOpacity: 0.45,
            editable: false,
            draggable: false,
            zIndex: 1,
        };
    }

    /**
     * Returns color options for selected shapes
     * @returns {Object} Selected shape color options
     * @private
     */
    _getSelectedColorOptions() {
        return {
            fillColor: '#de6ade',
            strokeColor: '#b038b0',
            strokeOpacity: 0.65,
            strokeWeight: 0.85,
            fillOpacity: 0.45,
            editable: false,
            draggable: false,
            zIndex: 99,
        };
    }


    /**
     * Updates the visual state of active/inactive shapes
     * @private
     */
    _handleActiveShape() {
        let options;
        if (this.prevShapeSelected) {
            options = this._getBaseColorOptions();
            this.prevShapeSelected.getShape().setOptions(options);
        }
        if (this.currentShapeSelected) {
            options = this._getSelectedColorOptions();
            this.currentShapeSelected.getShape().setOptions(options);
        }
    }

    /**
     * Centers the map on a specific shape
     * @param {string|number} shapeId - ID of the shape to center on
     */
    pointInMap(shapeId) {
        if (!this.isMapLoaded() || !this.terraDrawInstance) return;

        if (shapeId && this.shapes.has(shapeId)) {
            const shape = this.shapes.get(shapeId);
            this.shapeManager.updateMeasurementLabel(shape, this.googleMap);
            this.prevShapeSelected = this.currentShapeSelected;
            this.currentShapeSelected = shape;

            const bounds = shape.getBounds();

            this._handleActiveShape();
            if (bounds && !bounds.isEmpty()) {
                this.googleMap.fitBounds(bounds);
                this.googleMap.panTo(bounds.getCenter());
                google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                    google.maps.event.trigger(this.googleMap, 'resize');
                    if (this.googleMap.getZoom() > MAX_AUTO_ZOOM)
                        this.googleMap.setZoom(MAX_AUTO_ZOOM);
                });
            }
        }
    }

    /**
     * Toggles selection state of a specific record
     * @param {Object} record - Record to toggle selection for
     * @param {boolean} [pointInMap=false] - Whether to center map on selection
     */
    toggleRecordSelection(record, pointInMap = false) {
        if (!record) return;

        this.markerInfoWindow.close();

        record.toggleSelection().then(() => {
            this._updateShapeSelectionState(record);
        });

        this.props.list.selectDomain(false);
    }

    /**
     * Toggle selection of all records
     * @returns {Promise} Promise that resolves when all selections are toggled
     */
    toggleSelectionAll() {
        const list = this.props.list;
        if (!this.canSelectRecord) {
            return Promise.resolve();
        }

        const recordsToUpdate = [...list.records];
        const shouldSelect = list.selection.length !== recordsToUpdate.length;

        // Deselect domain if we're deselecting
        if (!shouldSelect) {
            list.selectDomain(false);
        }

        // Process records in batches for better UI responsiveness
        return this._processSelectionInBatches(recordsToUpdate, shouldSelect);
    }

    /**
     * Check if all records are selected
     */
    get selectAll() {
        const list = this.props.list;
        const nbDisplayedRecords = list.records.length;
        if (list.isDomainSelected) {
            return true;
        } else {
            return nbDisplayedRecords > 0 && list.selection.length === nbDisplayedRecords;
        }
    }

    /**
     * Check if records can be selected
     */
    get canSelectRecord() {
        return !this.props.list.editedRecord && !this.props.list.model.useSampleModel;
    }

    /**
     * Provides properties for the sidebar component
     * @returns {Object} Sidebar component properties
     */
    get sidebarProps() {
        const { viewTitle } = this.props.archInfo;
        return {
            header: viewTitle,
            title: this.props.archInfo.sidebarTitleField,
            subTitle: this.props.archInfo.sidebarSubtitleField,
            getGroupsOrRecords: this.getGroupsOrRecords.bind(this),
            openRecord: this.props.openRecord.bind(this),
            createShape: this.renderRecordGeoJSON.bind(this),
            showRecordsByDomain: this.props.showRecordsByDomain.bind(this),
            pointInMap: this.pointInMap.bind(this),
            centerMapByGroup: this.centerMapByGroup.bind(this),
            handleToggleRecordSelection: this.toggleRecordSelection.bind(this),
            handleToggleSelection: this.toggleSelectionAll.bind(this),
            handleCanSelectRecord: this.canSelectRecord,
            handleSelectAll: this.props.allowSelectors ? this.selectAll : false,
            allowSelectors: this.props.allowSelectors,
            isGrouped: !!this.props.list.isGrouped,
        };
    }

    /**
     * Handle feature selection events
     * @param {string} id - ID of the selected feature
     * @private
     */
    onFeatureSelect(id) {
        this.state.selectedFeatureId = id;
        
        // Show measurement for selected feature if enabled
        if (this.state.showMeasurements) {
            const measurement = this.getSelectedFeatureMeasurement();
            if (measurement) {
                this._showMeasurementNotification(measurement);
            }
        }

        // Trigger callback if provided
        if (this.props.onFeatureClick) {
            const feature = this._getFeatureById(id);
            this.props.onFeatureClick(feature);
        }
    }

    /**
     * Handle feature deselection events
     * @private
     */
    onFeatureDeselect() {
        this.state.selectedFeatureId = null;
    }

    /**
     * Get feature by ID
     * @param {string} id - Feature ID
     * @returns {Object|null} Feature object or null
     * @private
     */
    _getFeatureById(id) {
        if (!this.terraDrawInstance) {
            return null;
        }
        
        const features = this.terraDrawInstance.getSnapshot();
        return features.find(f => f.id === id) || null;
    }

    /**
     * Get measurement for currently selected feature
     * @returns {Object|null} Measurement object or null
     * @public
     */
    getSelectedFeatureMeasurement() {
        if (!this.state.selectedFeatureId) {
            return null;
        }
        
        const selectedFeature = this._getFeatureById(this.state.selectedFeatureId);
        if (selectedFeature) {
            return this._calculateFeatureMeasurement(selectedFeature);
        }
        return null;
    }

    /**
     * Calculate measurements for a given feature based on its geometry type
     * @param {Object} feature - GeoJSON feature to measure
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
                    const polygonCoords = coordinates[0]; // Outer ring
                    const area = calculatePolygonArea(polygonCoords, unit);
                    const perimeter = calculateLineStringLength(polygonCoords, unit);
                    measurements.type = 'Polygon';
                    measurements.area = formatMeasurement(area, 'area', unit);
                    measurements.perimeter = formatMeasurement(perimeter, 'distance', unit);
                    measurements.points = formatPointCount(polygonCoords.length - 1); // Subtract 1 for closed polygon
                    break;
                    
                default:
                    measurements.type = type;
                    measurements.info = 'Measurements not available for this geometry type';
            }
        } catch (error) {
            console.error('Error calculating measurement:', error);
            measurements.error = 'Error calculating measurements';
        }
        
        return measurements;
    }

    /**
     * Show measurement notification
     * @param {Object} measurement - Measurement object to display
     * @private
     */
    _showMeasurementNotification(measurement) {
        if (!measurement) return;
        
        let message = `${measurement.type} Measurements:\n`;
        const details = [];
        
        if (measurement.coordinates) details.push(`Coordinates: ${measurement.coordinates}`);
        if (measurement.length) details.push(`Length: ${measurement.length}`);
        if (measurement.area) details.push(`Area: ${measurement.area}`);
        if (measurement.perimeter) details.push(`Perimeter: ${measurement.perimeter}`);
        if (measurement.radius) details.push(`Radius: ${measurement.radius}`);
        if (measurement.circumference) details.push(`Circumference: ${measurement.circumference}`);
        if (measurement.points) details.push(`Points: ${measurement.points}`);
        if (measurement.info) details.push(measurement.info);
        if (measurement.error) details.push(measurement.error);
        
        if (details.length > 0) {
            message += details.join('\n');
        }
        
        this.notificationService.add(message, {
            title: _t('Feature Measurements'),
            type: 'info',
            sticky: true,
        });
    }

    /**
     * Toggle measurement unit between metric and imperial
     * @public
     */
    toggleMeasurementUnit() {
        const newUnit = this.state.measurementUnit === MEASUREMENT_CONFIG.UNITS.METRIC ? 
            MEASUREMENT_CONFIG.UNITS.IMPERIAL : 
            MEASUREMENT_CONFIG.UNITS.METRIC;
        
        this.state.measurementUnit = newUnit;
        
        // Refresh measurement for selected feature
        if (this.state.selectedFeatureId && this.state.showMeasurements) {
            const measurement = this.getSelectedFeatureMeasurement();
            if (measurement) {
                this._showMeasurementNotification(measurement);
            }
        }
    }

    /**
     * Toggle measurement display on/off
     * @public
     */
    toggleMeasurementDisplay() {
        this.state.showMeasurements = !this.state.showMeasurements;
    }

    /**
     * Get all features currently loaded
     * @returns {Array} Array of GeoJSON features
     * @public
     */
    getAllFeatures() {
        if (!this.terraDrawInstance) {
            return [];
        }
        return this.terraDrawInstance.getSnapshot();
    }

    /**
     * Get measurements for all loaded features
     * @returns {Array} Array of measurement objects
     * @public
     */
    getAllFeatureMeasurements() {
        const features = this.getAllFeatures();
        return features.map(feature => ({
            id: feature.id,
            measurement: this._calculateFeatureMeasurement(feature)
        })).filter(item => item.measurement);
    }

    /**
     * Cleanup Terra Draw instance and event listeners
     * @private
     */
    _cleanup() {
        if (this.eventProjectionChanges) {
            google.maps.event.removeListener(this.eventProjectionChanges);
            this.eventProjectionChanges = null;
        }
        
        if (this.initTimeout) {
            clearTimeout(this.initTimeout);
            this.initTimeout = null;
        }
        
        if (this.terraDrawInstance) {
            try {
                this.terraDrawInstance.stop();
                this.terraDrawInstance = null;
            } catch (error) {
                console.error('Error stopping Terra Draw instance:', error);
            }
        }
    }

    getShapeColor() {
        return getRandomColor();
    }

    get featureOptions() {
        return {
            feature: {
                draggable: false,
                rotateable: false,
                coordinates: {
                    midpoints: false,
                    draggable: false,
                    deletable: false,
                },
            },
        };
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
                            draggable: false,
                            rotateable: false,
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
        const opt = Object.assign(
            { editable: false },
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
        const opt = Object.assign(
            { editable: false },
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
        const opt = Object.assign(
            { editable: false },
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
        const opt = Object.assign(
            { editable: false },
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
        const opt = Object.assign(
            { editable: false },
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
        const opt = Object.assign(
            { editable: false },
            options || {}
        );
        return new window.terraDraw.TerraDrawFreehandMode(opt);
    }
}
