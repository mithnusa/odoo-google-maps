import { _t } from '@web/core/l10n/translation';
import { useService, useBus } from '@web/core/utils/hooks';
import { debounce } from '@web/core/utils/timing';
import { renderToString } from '@web/core/utils/render';
import { user } from "@web/core/user";
import {
    useEffect,
    useState,
    useRef,
    useSubEnv,
    onPatched,
    onWillStart,
    onWillUpdateProps,
} from '@odoo/owl';
import { isNull } from '@web/views/utils';
import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { getRecordDataView, hexToRgba, generateColor, darkenColor } from '@web_view_google_map/views/google_map/utils';
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';
import { GoogleMapsDrawingSidebar } from './google_map_drawing_sidebar';
import {
    formatAreaMeasurement,
    formatLengthMeasurement,
    formatPointCount,
    MEASUREMENT_CONFIG,
    loadDeckGlAssets,
    loadTurfJSAssets,
} from '../../utils/utils';

/**
 * Deck.gl configuration constants
 */
const DECKGL_CONFIG = {
    // Visual styling
    DEFAULT_COLORS: {
        FILL: [70, 130, 180, 80], // Steel blue with 80% opacity
        STROKE: [25, 25, 112, 255], // Midnight blue
        SELECTED_FILL: [0, 123, 255, 120], // Bright blue with transparency
        SELECTED_STROKE: [0, 86, 179, 255], // Deep blue
        HOVERED_FILL: [255, 165, 0, 120], // Gold with transparency
        HOVERED_STROKE: [255, 140, 0, 255], // Dark orange
    },
};

const STROKE_CONFIG = { 
    DEFAULT_WIDTH: 2, // Default stroke width in pixels
    HOVER_WIDTH: 4,   // Stroke width on hover in pixels
};

/**
 * Deck.gl High-Performance Renderer Component
 *
 * A high-performance rendering component that uses Deck.gl for GPU-accelerated
 * visualization of large GeoJSON datasets on Google Maps with interactive features.
 *
 * @class GoogleMapDeckGLRenderer
 * @extends BaseGoogleMapComponent
 *
 * Core Features:
 * - Handles 10k+ features with smooth performance
 * - GPU-accelerated rendering with WebGL
 * - Interactive tooltips with detailed measurements
 * - Hover effects with GPU-level autoHighlight
 * - Feature selection with info windows
 * - Efficient data indexing for O(1) lookups
 * - Measurement caching for fast tooltip rendering
 * - Real-time styling and updates
 *
 * Interactive Features:
 * - Hover: GPU-accelerated highlighting with measurement tooltips
 * - Click: Feature selection with detailed info windows
 * - Tooltips: Display geometry type, measurements, and properties
 * - Sidebar integration: Point-to-feature navigation
 *
 * Measurement Capabilities:
 * - Point geometries: Coordinate display with cardinal directions
 * - Line geometries: Length calculation and vertex count
 * - Polygon geometries: Area, perimeter, and vertex calculations
 * - Multi-geometries: Aggregated measurements across components
 *
 * Performance Optimizations:
 * - GPU-accelerated rendering via Deck.gl (10-100x faster than DOM-based)
 * - Constant 60fps regardless of feature count
 * - Synchronous batch processing for fast initial load
 * - O(1) feature lookup via featuresByRecordId index
 * - Measurement caching to avoid redundant calculations
 *
 * Props:
 * @param {Object} archInfo - Architecture information
 * @param {Function} openRecord - Function to open record details
 * @param {Function} showRecord - Function to show record
 * @param {Function} showRecordsByDomain - Function to show records by domain
 * @param {boolean} readonly - Whether the view is readonly
 * @param {Object} list - List data containing records
 * @param {Function} [onAdd] - Optional add function
 * @param {Object} [activeActions] - Optional active actions
 * @param {boolean} allowSelectors - Whether to allow selection
 */
export class GoogleMapDeckGLRenderer extends BaseGoogleMapComponent {
    static template = 'web_view_google_map.GoogleMapRenderer';
    static templateInfoWindow = 'web_view_google_map_drawing.ShapeInfoWindow';

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
        viewAttrs: Object,
    };

    setup() {
        super.setup();
        this.validateProps();

        this.mapRef = useRef('map');
        this.notificationService = useService('notification');
        this.actionService = useService('action');

        this._isSidebarAction = false;

        this.state = useState({
            ...this.state,
            // Sidebar state
            sidebarIsFolded: false,
            // Assets loaded state
            isAssetsLoaded: false,
        });

        this.fitBoundsTimeout = null;

        this.selectedFeatureIds = new Set();
        this._selectionVersion = 0; // Incrementing counter to trigger updates

        // Performance optimization
        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        // Deck.gl instance and layers
        this.deckglOverlay = null;


        // Data management
        this.geoJsonData = new Map(); // Efficient feature storage
        this.featuresByRecordId = new Map(); // Index: recordId -> Set of featureIds (for O(1) related feature lookup)

        this.cacheRecordDataView = new Map(); // Cache for record data views
        this.measurementCache = new Map(); // Cache: featureId -> measurements (for O(1) tooltip lookup)
        this._elementEventListeners = new Map(); // Track element event listeners
        this.hoveredRecordId = null;

        // Debounced operations for performance
        this.debounceRenderGeolocationData = debounce(this.renderGeolocationData.bind(this), 200);
        this.debounceUpdateLayers = debounce(this._updateDeckGLLayers.bind(this), 500);
        this.debounceToggleRecordSelection = debounce(this._toggleRecordSelectionImpl.bind(this), 100);

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        onWillStart(async () => {
            try {
                await loadDeckGlAssets();
                await loadTurfJSAssets();
                this.state.isAssetsLoaded = true;
            } catch (error) {
                console.error(error);
                this.notificationService.add(
                    _t('Failed to load Deck.gl assets. Please check javascript console for more information'),
                    { type: 'danger', title: _t('Error'), }
                );
            }
        });

        useEffect(
            (isMapLoaded) => {
                if (isMapLoaded && !this._isSidebarAction) {
                    this.debounceRenderGeolocationData();
                    this._isSidebarAction = false;
                }
            }, () => {
                return [this.isMapLoaded()]
            }
        );

        onWillUpdateProps((nextProps) => {
            this.onWillUpdatePropsRenderFeatures(nextProps);
        });

        onPatched(() => {
            if (this._isSidebarAction) {
                this._isSidebarAction = false;
            }
        });

        if (this.props.allowSelectors) {
            useBus(this.uiService.bus, 'google-map-center-map', this.centerMap);
        }

    }

    isMapLoaded() {
        return super.isMapLoaded() && this.state.isAssetsLoaded && !!this.deckglOverlay;
    }

    /**
     * Handles feature rendering logic before props are updated.
     * Manages feature lifecycle based on grouping state changes.
     * When switching to grouped view, clears all rendering data. Otherwise, triggers a debounced render.
     *
     * @param {Object} nextProps - The incoming props object containing the updated state
     * @param {Object} nextProps.list - The list data object
     * @param {boolean} nextProps.list.isGrouped - Whether the next state is grouped
     */
    onWillUpdatePropsRenderFeatures(nextProps) {
        if (!this.isMapLoaded()) return;

        const nextIsGrouped = !!nextProps.list.isGrouped;
        const currentIsGrouped = !!this.props.list.isGrouped;
        const isGroupingChanged = nextIsGrouped !== currentIsGrouped;

        // Clear all data when switching to grouped view
        if (isGroupingChanged && nextIsGrouped) {
            this._clearRenderingData();
            this.debounceUpdateLayers();
            return;
        }

        if (!isGroupingChanged && currentIsGrouped && nextIsGrouped) {
            this.debounceUpdateLayers();
            return;
        }

        // Re-render when not in grouped view (staying ungrouped or switching from grouped)
        if (!nextIsGrouped) {
            this.debounceRenderGeolocationData();
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
     * @override
     * Main rendering method with performance optimizations
     */
    renderGeolocationData() {
        // Clear previous data
        this._clearRenderingData();

        // Render shapes synchronously
        this._renderShapesOptimized();

        // Fit bounds to show all features (after data is ready)
        this._fitBoundsWhenReady();
    }

    /**
     * Clear previous rendering data efficiently
     * @private
     */
    _clearRenderingData() {
        // Close any open info windows
        if (this.markerInfoWindow) {
            this.markerInfoWindow.close();
        }
        this.cacheRecordDataView.clear();

        this.selectedFeatureIds.clear();
        this.geoJsonData.clear();

        this.featuresByRecordId.clear();
        this.measurementCache.clear();
    }

    /**
     * Optimized shape rendering - synchronous for faster initial load
     * @private
     */
    _renderShapesOptimized() {
        const datas = this.getGroupsOrRecords();
        if (this.isListGrouped) {
            this._renderGroupedShapesOptimized(datas);
        } else {
            this._renderUngroupedShapesOptimized(datas);
        }

        // Update Deck.gl layers
        this.debounceUpdateLayers();
    }

    /**
     * Render ungrouped shapes with performance optimizations
     * @private
     */
    _renderUngroupedShapesOptimized(datas) {
        if (!datas.length) return;
        // Process all records synchronously - faster than requestIdleCallback
        this._processBatch(datas);
    }

    /**
     * Process a batch of features synchronously
     * Faster than requestIdleCallback for initial data loading
     * @param {Array} batch - Array of record objects to process
     * @param {string} [color] - Optional color for features
     * @private
     */
    _processBatch(batch, color) {
        for (const { record } of batch) {
            this._processRecordGeoJSON(record, color);
        }
    }

    /**
     * Render grouped shapes with optimizations
     * @private
     */
    _renderGroupedShapesOptimized(datas) {
        for (const { group } of datas) {
            try {
                const batch = group.records.map(record => ({ record }));
                this._processBatch(batch, group.groupColor);
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        }
    }

    /**
     * Render grouped records and fit bounds
     * @param {Array} datas
     */
    _renderGroupedRecordsFitBounds(datas) {
        // Render grouped shapes synchronously
        this._renderGroupedShapesOptimized(datas);
        // Cancel any pending debounced updates to prevent conflicts
        this.debounceUpdateLayers.cancel();
        // Update Deck.gl layers immediately (no debounce)
        this._updateDeckGLLayers();
        // Fit bounds to show the expanded group
        this._fitBoundsWhenReady();
    }

    /**
     * Process individual record GeoJSON with optimizations
     * Optimized for large datasets - pre-calculates colors once per record
     * @private
     */
    _processRecordGeoJSON(record, color) {
        try {
            const geoJson = record.data[this.props.viewAttrs.geoJsonField];
            if (!geoJson?.features?.length) return;

            const dataView = this.getRecordDataView(record);
            const recordValues = this._prepareInfoWindowValues(record);
            recordValues.id = record.id;
            recordValues.resId = record.resId;

            // Pre-calculate colors ONCE per record (not per feature)
            const featureColor = color || dataView?.other?.__geoColor || generateColor();
            const fillColor = hexToRgba(featureColor, 0.5, DECKGL_CONFIG.DEFAULT_COLORS.FILL);
            const strokeColor = hexToRgba(darkenColor(featureColor, 0.3), 1, DECKGL_CONFIG.DEFAULT_COLORS.STROKE);

            // Pre-build shared properties object
            const sharedProps = {
                odoo: recordValues,
                color: featureColor,
                fillColor,
                strokeColor,
                odooId: recordValues.id,
                odooResId: recordValues.resId,
            };

            const features = geoJson.features;
            const recordId = record.id;

            // Initialize the record's feature set if not exists
            if (!this.featuresByRecordId.has(recordId)) {
                this.featuresByRecordId.set(recordId, new Set());
            }
            const recordFeatureIds = this.featuresByRecordId.get(recordId);

            // Process features with for loop (faster than forEach)
            for (let i = 0; i < features.length; i++) {
                const feature = features[i];
                const featureId = `${recordId}-${i}`;

                // Inline feature creation for performance
                this.geoJsonData.set(featureId, {
                    id: featureId,
                    type: feature.type,
                    geometry: feature.geometry,
                    properties: feature.properties
                        ? { ...feature.properties, ...sharedProps }
                        : sharedProps,
                    bounds: this._calculateFeatureBounds(feature.geometry),
                    visible: true,
                    selected: false,
                });

                // Index feature by record ID for O(1) related feature lookup
                recordFeatureIds.add(featureId);
            }

        } catch (error) {
            console.error('Error processing record GeoJSON:', error);
        }
    }

    /**
     * Calculate feature bounds for map centering and info window positioning
     * Uses switch-based iteration instead of recursive closures for performance
     * @private
     */
    _calculateFeatureBounds(geometry) {
        if (!geometry || !geometry.coordinates) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        const { type, coordinates } = geometry;

        switch (type) {
            case 'Point': {
                const lng = coordinates[0], lat = coordinates[1];
                if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
                    minX = maxX = lng;
                    minY = maxY = lat;
                }
                break;
            }
            case 'LineString':
            case 'MultiPoint':
                for (const coord of coordinates) {
                    const lng = coord[0], lat = coord[1];
                    if (lng < minX) minX = lng;
                    if (lng > maxX) maxX = lng;
                    if (lat < minY) minY = lat;
                    if (lat > maxY) maxY = lat;
                }
                break;
            case 'Polygon':
            case 'MultiLineString':
                for (const ring of coordinates) {
                    for (const coord of ring) {
                        const lng = coord[0], lat = coord[1];
                        if (lng < minX) minX = lng;
                        if (lng > maxX) maxX = lng;
                        if (lat < minY) minY = lat;
                        if (lat > maxY) maxY = lat;
                    }
                }
                break;
            case 'MultiPolygon':
                for (const polygon of coordinates) {
                    for (const ring of polygon) {
                        for (const coord of ring) {
                            const lng = coord[0], lat = coord[1];
                            if (lng < minX) minX = lng;
                            if (lng > maxX) maxX = lng;
                            if (lat < minY) minY = lat;
                            if (lat > maxY) maxY = lat;
                        }
                    }
                }
                break;
        }

        if (!isFinite(minX)) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }
        return { minX, maxX, minY, maxY };
    }

    /**
     * Update Deck.gl layers with current data
     *
     * Creates and updates Deck.gl layers for rendering different geometry types:
     * - GeoJsonLayer for polygons with fill and stroke styling
     * - GeoJsonLayer for lines with stroke styling
     * - ScatterplotLayer for points with fill and stroke styling
     *
     * Each layer handles hover and selection states with dynamic styling.
     * Deck.gl handles viewport culling automatically at the GPU level.
     *
     * @private
     */
    _updateDeckGLLayers() {
        if (!this.isMapLoaded()) return;

        // Build selected records set efficiently
        const recordsSelected = new Set();
        const datas = this.getGroupsOrRecords();
        if (this.props.list.isGrouped) {
            for (const { group } of datas) {
                for (const record of group.records) {
                    if (record.selected) {
                        recordsSelected.add(record.id);
                    }
                }
            }
        } else {
            for (const { record } of datas) {
                if (record.selected) {
                    recordsSelected.add(record.id);
                }
            }
        }

        // Categorize features by geometry type
        // Note: Viewport culling removed - Deck.gl handles this at the GPU level
        const polygonData = [];
        const lineData = [];
        const pointData = [];
        const featuresSelected = new Set();

        for (const feature of this.geoJsonData.values()) {
            // Check if selected
            if (recordsSelected.has(feature.properties.odooId)) {
                featuresSelected.add(feature.id);
            }

            // Categorize by geometry type
            const type = feature.geometry.type;
            switch (type) {
                case 'Polygon':
                case 'MultiPolygon':
                    polygonData.push(feature);
                    break;
                case 'LineString':
                case 'MultiLineString':
                    lineData.push(feature);
                    break;
                case 'Point':
                    pointData.push({
                        ...feature,
                        position: feature.geometry.coordinates
                    });
                    break;
                case 'MultiPoint':
                    pointData.push({
                        ...feature,
                        position: feature.geometry.coordinates[0]
                    });
                    break;
            }
        }

        const layers = [
            // Polygon layer for filled shapes
            new window.deck.GeoJsonLayer({
                id: 'polygonsLayer',
                data: polygonData,
                filled: true,
                stroked: true,
                wrapLongitude: true,
                getFillColor: d => featuresSelected.has(d.id)
                    ? DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_FILL
                    : d.properties.fillColor,
                getLineColor: d => featuresSelected.has(d.id)
                    ? DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_STROKE
                    : d.properties.strokeColor,
                getLineWidth: d => featuresSelected.has(d.id)
                    ? STROKE_CONFIG.DEFAULT_WIDTH + 1
                    : STROKE_CONFIG.DEFAULT_WIDTH,
                lineWidthMinPixels: STROKE_CONFIG.DEFAULT_WIDTH,
                lineWidthMaxPixels: STROKE_CONFIG.HOVER_WIDTH,
                pickable: true,
                autoHighlight: true,
                highlightColor: DECKGL_CONFIG.DEFAULT_COLORS.HOVERED_FILL,
            }),

            // Line layer for LineString geometries
            new window.deck.GeoJsonLayer({
                id: 'linesLayer',
                data: lineData,
                filled: false,
                stroked: true,
                wrapLongitude: true,
                getLineColor: d => featuresSelected.has(d.id)
                    ? DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_STROKE
                    : d.properties.strokeColor,
                getLineWidth: d => featuresSelected.has(d.id) ? 4 : 3,
                lineWidthUnits: 'pixels',
                lineWidthMinPixels: 3,
                lineWidthMaxPixels: 8,
                pickable: true,
                autoHighlight: true,
                highlightColor: DECKGL_CONFIG.DEFAULT_COLORS.HOVERED_STROKE,
            }),

            // Point layer for Point geometries
            new window.deck.ScatterplotLayer({
                id: 'pointsLayer',
                data: pointData,
                getPosition: d => d.position,
                getRadius: 6,
                radiusUnits: 'pixels',
                radiusMinPixels: 6,
                radiusMaxPixels: 20,
                stroked: true,
                filled: true,
                getFillColor: d => featuresSelected.has(d.id)
                    ? DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_FILL
                    : d.properties.fillColor,
                getLineColor: d => featuresSelected.has(d.id)
                    ? DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_STROKE
                    : d.properties.strokeColor,
                lineWidthMinPixels: 2,
                lineWidthMaxPixels: 4,
                pickable: true,
                autoHighlight: true,
                highlightColor: DECKGL_CONFIG.DEFAULT_COLORS.HOVERED_FILL,
            }),
        ];

        this.deckglOverlay.setProps({ layers });
    }

    /**
     * Centers the map to show all features or selected features
     *
     * Calculates the bounding box that encompasses rendered features using
     * optimized min/max tracking. If there are selected records, centers only
     * on those selected records' features. Otherwise, centers on all features.
     * Creates LatLngBounds only once with final values for better performance.
     *
     * @returns {Promise<void>} Promise that resolves when map is centered
     */
    async centerMap() {
        if (!this.isMapLoaded()) return;

        // Calculate bounds using min/max (much faster than extend() calls)
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;

        // Check if there are selected records
        const selectedRecords = this.props.list?.selection || [];
        const hasSelection = selectedRecords.length > 0;

        if (hasSelection) {
            // Center only on selected records' features
            const selectedRecordIds = new Set(selectedRecords.map(r => r.id));

            for (const feature of this.geoJsonData.values()) {
                const recordId = feature.properties?.odoo?.id;
                if (recordId && selectedRecordIds.has(recordId)) {
                    const b = feature.bounds;
                    if (b.minY < minLat) minLat = b.minY;
                    if (b.maxY > maxLat) maxLat = b.maxY;
                    if (b.minX < minLng) minLng = b.minX;
                    if (b.maxX > maxLng) maxLng = b.maxX;
                }
            }
        } else {
            // Center on all features
            for (const feature of this.geoJsonData.values()) {
                const b = feature.bounds;
                if (b.minY < minLat) minLat = b.minY;
                if (b.maxY > maxLat) maxLat = b.maxY;
                if (b.minX < minLng) minLng = b.minX;
                if (b.maxX > maxLng) maxLng = b.maxX;
            }
        }

        // Only create LatLngBounds once with the final values
        if (minLat !== Infinity) {
            const { LatLngBounds } = await this.apiLoader.importLibrary('core');
            const bounds = new LatLngBounds(
                { lat: minLat, lng: minLng },  // SW corner
                { lat: maxLat, lng: maxLng }   // NE corner
            );
            this.googleMap.fitBounds(bounds);
        }
    }

    /**
     * Schedule map centering with a delay to ensure rendering stability
     * @private
     */
    _fitBoundsWhenReady() {
        if (this.fitBoundsTimeout) {
            clearTimeout(this.fitBoundsTimeout);
        }
        this.fitBoundsTimeout = setTimeout(() => this.centerMap(), 500);
    }

    /**
     * Handle feature selection
     *
     * Processes click events on features to:
     * - Toggle selection state
     * - Display info window with feature details
     * - Update visual styling
     * - Log feature information for debugging
     *
     * @param {Object} info - Pick info from Deck.gl containing object and coordinate
     * @private
     */
    _onFeatureClick(info) {
        if (!info.object) return;

        const featureId = info.object.id;
        const feature = this.geoJsonData.get(featureId);

        if (feature) {
            this._showFeatureInfoWindow(feature, info.coordinate);
        }
    }

    /**
     * Handle feature hover events
     *
     * Tracks hovered feature state for tooltip and other features.
     * Visual highlighting is handled by Deck.gl's autoHighlight at the GPU level.
     * @param {Object} info - Pick info from Deck.gl containing object
     */
    _onFeatureHover(info) {
        // Track hovered record ID (used by tooltip content rendering)
        this.hoveredRecordId = info.object ? info.object.properties.odooId : null;
        // Note: Visual highlighting handled by Deck.gl autoHighlight - no layer rebuild needed
    }

    /**
     * Calculate measurements for a given feature based on its geometry type
     *
     * Computes appropriate measurements based on geometry type:
     * - Point: Coordinates with cardinal directions (N/S, E/W)
     * - LineString: Total length and vertex count
     * - Polygon: Area, perimeter, and vertex count (excluding closing vertex)
     * - MultiPolygon: Aggregated area, perimeter, and total vertex count
     *
     * All measurements are formatted according to MEASUREMENT_CONFIG settings
     * and include user-friendly display names for tooltips.
     *
     * @param {Object} feature - GeoJSON feature to measure
     * @returns {Object} Measurement results with formatted strings and display_name
     * @private
     */
    _calculateFeatureMeasurement(feature, relatedFeatures = []) {
        if (!feature || !feature.geometry) return null;

        const { type, coordinates } = feature.geometry;

        // Check cache for features without related polygon area calculations
        const hasRelatedPolygons = relatedFeatures.length > 0 &&
            (type === 'Polygon' || type === 'MultiPolygon');

        if (!hasRelatedPolygons && this.measurementCache.has(feature.id)) {
            return this.measurementCache.get(feature.id);
        }

        const unit = MEASUREMENT_CONFIG.UNITS.METRIC; // Default to metric
        const measurements = {};
        let area = 0;
        let totalArea = 0;
        let displayArea = '';
        let displayTotalArea = '';

        try {
            area = window.turf.area(feature);
            displayArea = formatAreaMeasurement(area, user.context.lang, 2, unit);
        } catch (error) {
            console.error('Error calculating area with Turf.js:', error);
        }

        if (hasRelatedPolygons) {
            for (const relFeature of relatedFeatures) {
                try {
                    totalArea += window.turf.area(relFeature);
                } catch (error) {
                    console.error('Error calculating related feature area:', error);
                }
            }
        }

        if (totalArea > 0) {
            displayTotalArea = formatAreaMeasurement(totalArea, user.context.lang, 2, unit);
        }

        try {
            switch (type) {
                case 'Point':
                    measurements.type = 'Point';
                    const lat = coordinates[1];
                    const lng = coordinates[0];
                    const latDir = lat >= 0 ? 'N' : 'S';
                    const lngDir = lng >= 0 ? 'E' : 'W';
                    measurements.coordinates = `${Math.abs(lat).toFixed(
                        MEASUREMENT_CONFIG.COORDINATE_PRECISION
                    )}°${latDir}, ${Math.abs(lng).toFixed(
                        MEASUREMENT_CONFIG.COORDINATE_PRECISION
                    )}°${lngDir}`;
                    measurements.display_name = [{ title: _t('Point'), value: measurements.coordinates }];
                    break;
                case 'LineString':
                case 'MultiLineString':
                    const length = window.turf.length(feature, { units: 'kilometers' });
                    measurements.type = 'Line';
                    measurements.length = formatLengthMeasurement(length, user.context.lang, 2, unit);
                    measurements.points = formatPointCount(coordinates.length);
                    measurements.display_name = [
                        { title: _t('Length'), value: measurements.length },
                        { title: _t('Points'), value: measurements.points },
                    ];
                    break;
                case 'Polygon':
                    const polygonCoords = coordinates[0]; // Outer ring
                    const lines = window.turf.lineString(polygonCoords);
                    let perimeter = window.turf.length(lines, { units: 'kilometers' });
                    measurements.type = 'Polygon';
                    measurements.area = displayArea;
                    measurements.perimeter = formatLengthMeasurement(perimeter, user.context.lang, 2, unit);
                    measurements.points = formatPointCount(polygonCoords.length - 1); // Subtract 1 for closed polygon
                    measurements.display_name = [
                        { title: _t('Area'), value: measurements.area },
                        { title: _t('Perimeter'), value: measurements.perimeter },
                        { title: _t('Points'), value: measurements.points }
                    ];
                    if (displayTotalArea) {
                        measurements.display_name.splice(1, 0, { title: _t('Total Area'), value: displayTotalArea });
                    }
                    break;
                case 'MultiPolygon': {
                    let totalPerimeter = 0;
                    let totalPoints = 0;
                    for (const polygon of coordinates) {
                        const polyCoords = polygon[0]; // Outer ring
                        const polyLines = window.turf.lineString(polyCoords);
                        totalPerimeter += window.turf.length(polyLines, { units: 'kilometers' });
                        totalPoints += polyCoords.length - 1; // Subtract 1 for closed polygon
                    }
                    measurements.type = 'MultiPolygon';
                    measurements.area = displayArea;
                    measurements.perimeter = formatLengthMeasurement(totalPerimeter, user.context.lang, 2, unit);
                    measurements.points = formatPointCount(totalPoints);
                    measurements.display_name = [
                        { title: _t('Area'), value: measurements.area },
                        { title: _t('Perimeter'), value: measurements.perimeter },
                        { title: _t('Points'), value: measurements.points }
                    ];
                    if (displayTotalArea) {
                        measurements.display_name.splice(1, 0, { title: _t('Total Area'), value: displayTotalArea });
                    }
                    break;
                }
                default:
                    measurements.type = type;
                    measurements.display_name = _t('Measurements not available for this geometry type');
            }
        } catch (error) {
            console.error('Error calculating measurement:', error);
            measurements.error = _t('Error calculating measurements');
        }

        // Cache the result for features without related polygon calculations
        if (!hasRelatedPolygons) {
            this.measurementCache.set(feature.id, measurements);
        }

        return measurements;
    }

    /**
     * Show info window for selected feature
     * @private
     */
    _showFeatureInfoWindow(feature, coordinate) {
        if (!this.markerInfoWindow) return;

        const record = this._findRecordByFeature(feature);
        if (!record) return;

        const currentContent = this.markerInfoWindow.getContent();

        if (currentContent instanceof HTMLElement) {
            // Remove all event listeners from previous content
            this._removeContentEventListeners(currentContent);
        }

        const content = this._createInfoWindowContent(record);
        if (content) {
            this.markerInfoWindow.setContent(content);
            this.markerInfoWindow.setPosition({lat: coordinate[1], lng: coordinate[0]});
            this.markerInfoWindow.open(this.googleMap);
        }
    }

    /**
     * Find record associated with feature
     * @private
     */
    _findRecordByFeature(feature) {
        const odooId = feature.properties.odooId;
        return this.props.list.records.find(r => r.id === odooId);
    }

    /**
     * Get groups or records data with caching optimization
     *
     * Retrieves and caches the current list data (groups or records) to avoid
     * unnecessary recalculations. Uses efficient first/last ID comparison to
     * detect changes (avoiding JSON.stringify overhead) and only rebuilds the
     * data structure when the underlying list changes.
     *
     * For grouped lists, sorts groups to handle null values appropriately.
     * For ungrouped lists, maps records directly with their IDs as keys.
     *
     * @returns {Array} Array of group or record data objects with keys
     */
    getGroupsOrRecords() {
        if (!this.isMapLoaded()) return [];
        const { list } = this.props;

        // Check cache validity using efficient comparison (avoid JSON.stringify)
        const isGrouped = this.isListGrouped;
        const currentLength = isGrouped ? list.groups.length : list.records.length;

        if (
            this.cachedGroupsOrRecords &&
            this.lastGroupsOrRecordsProps &&
            this.lastGroupsOrRecordsProps.isGrouped === isGrouped &&
            this.lastGroupsOrRecordsProps.length === currentLength
        ) {
            // Quick check: compare first and last IDs to detect changes
            const items = isGrouped ? list.groups : list.records;
            const lastIds = this.lastGroupsOrRecordsProps.firstLastIds;
            if (
                currentLength === 0 ||
                (items[0].id === lastIds[0] && items[currentLength - 1].id === lastIds[1])
            ) {
                return this.cachedGroupsOrRecords;
            }
        }

        // Build result
        let result;
        if (isGrouped) {
            result = [...list.groups]
                .sort((a, b) => (a.value && !b.value ? 1 : !a.value && b.value ? -1 : 0))
                .map((group, i) => ({
                    group,
                    key: isNull(group.value) ? `group_key_${i}` : `${String(group.value)}_${i}`,
                }));
        } else {
            result = list.records.map(record => ({ record, key: record.id }));
        }

        // Cache the result with lightweight comparison data
        const items = isGrouped ? list.groups : list.records;
        this.lastGroupsOrRecordsProps = {
            isGrouped,
            length: currentLength,
            firstLastIds: currentLength > 0 ? [items[0].id, items[currentLength - 1].id] : [null, null],
        };
        this.cachedGroupsOrRecords = result;
        return result;
    }

    /**
     * Toggles the expansion/collapse state of a group in the sidebar.
     * Sets a flag to indicate this is a sidebar-initiated action.
     *
     * @param {Object} group - The group object to toggle
     * @returns {Promise<void>}
     */
    async toggleGroup(group) {
        this._isSidebarAction = true;
        await group.toggle();
    }

    /**
     * @override
     * Initialize map with Deck.gl overlay
     */
    async onMapReady(map) {
        await super.onMapReady(map);

        if (!this.markerInfoWindow) {
            this.markerInfoWindow = new google.maps.InfoWindow({ disableAutoPan: true });
        }

        await this._initializeDeckGLOverlay();

        // Note: bounds_changed/zoom_changed listeners removed
        // Deck.gl handles viewport rendering automatically at the GPU level
    }

    /**
     * Render tooltip content for features
     *
     * Creates HTML content for feature tooltips including:
     * - Feature title from Odoo record
     * - Geometry measurements (area, perimeter, length, coordinates)
     * - GeoJSON properties (excluding internal Odoo properties)
     * - Formatted display with line breaks for readability
     *
     * Uses featuresByRecordId index for O(1) related feature lookup
     * and measurementCache for cached measurement retrieval.
     *
     * @param {Object} feature - GeoJSON feature to create tooltip for
     * @returns {string|null} HTML string for tooltip or null if invalid feature
     * @private
     */
    _renderTooltipContent(feature) {
        if (!feature || !feature.properties) return null;

        // Use featuresByRecordId index for O(1) related feature lookup
        const relatedFeatures = [];
        const recordId = feature.properties.odooId;
        const featureIds = this.featuresByRecordId.get(recordId);

        if (featureIds) {
            for (const featureId of featureIds) {
                if (featureId !== feature.id) {
                    const relatedFeature = this.geoJsonData.get(featureId);
                    if (relatedFeature) {
                        relatedFeatures.push(relatedFeature);
                    }
                }
            }
        }

        const measurements = this._calculateFeatureMeasurement(feature, relatedFeatures);
        const displayNames = measurements?.display_name || [];

        // Build filtered properties object
        const properties = feature.properties ? { ...feature.properties } : {};
        const attrsToExclude = [
            'odoo', 'color', 'fillColor', 'strokeColor',
            'odooId', 'odooResId'
        ];
        for (const attr of attrsToExclude) {
            delete properties[attr];
        }

        return renderToString('web_view_google_map_drawing.FeatureProperties', {
            title: feature.properties.odoo?.title || _t('Feature'),
            displayNames,
            properties,
        });
    }

    /**
     * Initialize Deck.gl overlay on Google Maps
     *
     * Sets up the Deck.gl GoogleMapsOverlay with:
     * - Tooltip configuration for interactive hover information
     * - Click and hover event handlers (visual highlighting via autoHighlight)
     * - Integration with the Google Maps instance
     * - Triggers initial data rendering via debounced method
     *
     * The overlay provides GPU-accelerated rendering of GeoJSON features
     * with interactive capabilities like tooltips and selection.
     *
     * @private
     * @throws {Error} If Deck.gl or Google Maps are not available
     */
    async _initializeDeckGLOverlay() {
        if (!window.deck || !this.googleMap) {
            throw new Error('Deck.gl or Google Maps not available');
        }

        try {
            this.deckglOverlay = new window.deck.GoogleMapsOverlay({
                layers: [],
                getTooltip: ({ object }) => {
                    if (object && object.properties) {
                        const feature = this.geoJsonData.get(object.id);
                        const content = this._renderTooltipContent(feature);
                        const properties = feature?.properties || {};
                        const style = {
                            backgroundColor: 'light-dark(white, black)',
                            padding: '8px',
                            fontSize: '12px',
                            borderRadius: '4px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                            opacity: '0.95',
                            maxWidth: '300px',
                        };
                        if (properties.color) {
                            style.borderLeft = `4px solid ${properties.color}`;
                        }
                        return {
                            html: content,
                            style
                        };
                    }
                    return null;
                },
                onClick: (info) => this._onFeatureClick(info),
                onHover: (info) => this._onFeatureHover(info),
            });

            this.deckglOverlay.setMap(this.googleMap);

            // Initial data load
            this.debounceRenderGeolocationData();

        } catch (error) {
            console.error('Failed to initialize Deck.gl overlay:', error);
            this.notificationService.add(
                _t('Failed to initialize high-performance renderer. Please refresh the page.'),
                { type: 'danger' }
            );
        }
    }

    /**
     * Create info window content for a record
     * @private
     */
    _createInfoWindowContent(record) {
        const content = this._generateInfoWindowHtml(record);

        try {
            const divContent = new DOMParser()
                .parseFromString(content, 'text/html')
                .querySelector('div');

            if (!divContent) return null;

            const openButton = divContent.querySelector('#btn-open_form');
            if (openButton) {
                const clickHandler = this.props.showRecord.bind(this, record);
                openButton.addEventListener('click', clickHandler);
                this._storeElementEventListener(openButton, 'click', clickHandler);
            }
            return divContent;
        } catch (error) {
            console.error('Error creating info window content:', error);
            return null;
        }
    }

    /**
     * Generate HTML for info window
     * @private
     */
    _generateInfoWindowHtml(record) {
        const values = this._prepareInfoWindowValues(record);
        values.recordId = record.id;
        return renderToString(this.constructor.templateInfoWindow, values);
    }

    /**
     * Store element event listener for later cleanup
     * @param {HTMLElement} element 
     * @param {string} eventType 
     * @param {Function} listener 
     */
    _storeElementEventListener(element, eventType, listener) {
        if (!this._elementEventListeners.has(element)) {
            this._elementEventListeners.set(element, new Map());
        }

        this._elementEventListeners.get(element).set(eventType, listener);
    }

    /**
     * Remove all event listeners for an element
     * @param {HTMLElement} element 
     */
    _removeElementEventListeners(element) {
        const listeners = this._elementEventListeners.get(element);
        if (listeners) {
            listeners.forEach((listener, eventType) => {
                element.removeEventListener(eventType, listener);
            });

            this._elementEventListeners.delete(element);
        }
    }

    /**
     * Remove all event listeners from elements within a container
     * @private
     * @param {HTMLElement} content - Container element to clean up
     */
    _removeContentEventListeners(content) {
        if (!content) return;

        for (const element of this._elementEventListeners.keys()) {
            if (content.contains(element)) {
                this._removeElementEventListeners(element);
            }
        }
    }

    /**
     * Prepare values for info window template
     * @private
     */
    _prepareInfoWindowValues(record) {
        const { other = {} } = this.getRecordDataView(record);

        const values = {
            title: other.title || '',
            destination: '',
        };

        if (other.subTitle) {
            if (typeof other.subTitle === 'string') {
                values.subTitle = other.subTitle;
            } else if (Array.isArray(other.subTitle)) {
                values.subTitle = other.subTitle.join(' ');
            } else if (typeof other.subTitle === 'object') {
                values.subTitle = other.subTitle.display_name || Object.values(other.subTitle).join(' ');
            }
        } else {
            values.subTitle = '';
        }
        return values;
    }

    /**
     * Get properties for the sidebar component
     *
     * Provides configuration and callback functions for the GoogleMapsDrawingSidebar
     * component, including data access, record management, and selection handlers.
     *
     * @returns {Object} Configuration object for sidebar component
     */
    get sidebarProps() {
        const { viewTitle } = this.props.archInfo;
        return {
            header: viewTitle,
            title: this.props.archInfo.sidebarTitleField,
            subTitle: this.props.archInfo.sidebarSubtitleField,
            getGroupsOrRecords: this.getGroupsOrRecords.bind(this),
            toggleGroup: this.toggleGroup.bind(this),
            renderGroupedRecordsFitBounds: this._renderGroupedRecordsFitBounds.bind(this),
            openRecord: this.props.openRecord.bind(this),
            showRecordsByDomain: this.props.showRecordsByDomain.bind(this),
            pointInMap: this.pointInMap.bind(this),
            deleteGroupRecords: this.deleteGroupRecords.bind(this),
            handleToggleRecordSelection: this.toggleRecordSelection.bind(this),
            handleToggleSelection: this.toggleSelectionAll.bind(this),
            handleCanSelectRecord: this.canSelectRecord,
            handleSelectAll: this.props.allowSelectors ? this.selectAll : false,
            allowSelectors: this.props.allowSelectors,
            isGrouped: this.isListGrouped,
        };
    }

    handleFeatureClickManually(feature) {
        if (!feature) return;
        const centerCoordinate = [
            (feature.bounds.minX + feature.bounds.maxX) / 2,
            (feature.bounds.minY + feature.bounds.maxY) / 2
        ];
        this._onFeatureClick({ object: feature, coordinate: centerCoordinate });
    }

    /**
     * Centers the map on a specific shape and selects it
     *
     * Finds all features associated with a given record ID, calculates their
     * combined bounds, centers the map on those features, and simulates a
     * click event to select and show details for the first feature.
     *
     * This method is typically called from the sidebar when a user clicks
     * on a record entry to highlight it on the map.
     *
     * @param {string|number} recordId - Record ID to center on and select
     * @returns {Promise<void>} Promise that resolves when operation completes
     */
    async pointInMap(recordId, showInfoWindow = true) {
        if (!this.isMapLoaded() || !recordId) return;
        try {
            const features = [];
            this.geoJsonData.forEach((feature) => {
                if (feature.properties.odooId === recordId) {
                    features.push(feature);
                }
            });

            if (features.length > 0) {
                const { LatLngBounds } = await this.apiLoader.importLibrary('core');
                this.latLngBounds = new LatLngBounds();

                // Extend bounds for all features
                features.forEach(feature => {
                    const featureBounds = feature.bounds;
                    this.latLngBounds.extend({ lat: featureBounds.minY, lng: featureBounds.minX });
                    this.latLngBounds.extend({ lat: featureBounds.maxY, lng: featureBounds.maxX });
                });

                if (!this.latLngBounds.isEmpty()) {
                    this.googleMap.fitBounds(this.latLngBounds);
                }
                // Simulate click on the first feature to show info window
                if (showInfoWindow) {
                    this.handleFeatureClickManually(features[0]);
                }
            }
        } catch (error) {
            console.error('Error centering map on record:', error);
            this.notificationService.add(
                _t('Failed to center map on the selected record. Please try again.'),
                { type: 'warning' }
            );
        }
    }

    /**
     * Toggles selection state of a specific record (debounced wrapper)
     * @param {Object} record - Record to toggle selection for
     * @param {boolean} [centerMap=false] - Whether to center map on selection
     */
    toggleRecordSelection(record, centerMap = false) {
        if (!record) return;
        this.debounceToggleRecordSelection(record, centerMap);
    }

    /**
     * Internal implementation of toggleRecordSelection
     * @private
     * @param {Object} record - Record to toggle selection for
     * @param {boolean} [centerMap=false] - Whether to center map on selection
     */
    async _toggleRecordSelectionImpl(record, centerMap = false) {
        if (!record) return;

        this.markerInfoWindow.close();

        try {
            await record.toggleSelection();

            // Cancel any pending debounced updates to prevent conflicts
            if (this.debounceUpdateLayers.cancel) {
                this.debounceUpdateLayers.cancel();
            }
            if (this.debounceRenderGeolocationData.cancel) {
                this.debounceRenderGeolocationData.cancel();
            }

            // Update feature selection state immediately
            const recordId = record.id;
            const isSelected = record.selected;

            // Update selectedFeatureIds for this record
            this.geoJsonData.forEach((feature) => {
                if (feature.properties?.odoo?.id === recordId) {
                    feature.selected = isSelected;
                    if (isSelected) {
                        this.selectedFeatureIds.add(feature.id);
                    } else {
                        this.selectedFeatureIds.delete(feature.id);
                    }
                }
            });

            // Update layers immediately without debouncing
            this._updateDeckGLLayers();

            // Optionally center map on the selected feature
            if (centerMap && isSelected) {
                await this.pointInMap(recordId, true);
            }
        } catch (error) {
            console.error('Error toggling record selection:', error);
        }
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

    get isListGrouped() {
        return !!this.props.list.isGrouped;
    }

    /**
     * Check if records can be selected
     */
    get canSelectRecord() {
        return !this.props.list.editedRecord && !this.props.list.model.useSampleModel;
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
     * Update feature selection state based on record selection
     * @private
     * @param {Object} record Record object
     */
    _updateShapeSelectionState(record, pointInMap = true) {
        // Center map if requested
        if (pointInMap && record.selected) {
            this.pointInMap(record.id, true);
        }
    }

    /**
     * Process record selection in batches
     * @private
     * @param {Array} records Records to process
     * @param {boolean} shouldSelect Whether to select or deselect
     * @returns {Promise} Promise resolving when complete
     */
    _processSelectionInBatches(records, shouldSelect) {
        // Process in batches to avoid UI freezing
        const batchSize = 20;
        const totalRecords = records.length;
        let processedCount = 0;

        return new Promise((resolve) => {
            const processBatch = async () => {
                const batch = records.slice(
                    processedCount,
                    Math.min(processedCount + batchSize, totalRecords)
                );

                const batchPromises = batch.map((record) =>
                    record.toggleSelection(shouldSelect).then(() => {
                        this._updateShapeSelectionState(record, false);
                    })
                );

                await Promise.all(batchPromises);

                processedCount += batch.length;

                if (processedCount < totalRecords) {
                    // Continue with next batch after a small delay
                    setTimeout(processBatch, 0);
                } else {
                    resolve();
                }
            };

            processBatch();
        });
    }

    /**
     * Deletes all map features associated with the given group records.
     * Removes features from all data structures and updates the map visualization.
     *
     * @param {Array<Object>} groupRecords - Array of record objects to delete from the map
     * @returns {Promise<void>}
     */
    async deleteGroupRecords(groupRecords) {
        if (!this.isMapLoaded() || !Array.isArray(groupRecords)) return;

        this.markerInfoWindow?.close();

        const deletedFeatureIds = new Set();

        for (const { group } of groupRecords) {
            for (const record of group.list.records) {
                const _id = record.id.toString() + '-';
                this.geoJsonData.forEach((feature) => {
                    if (feature.id.startsWith(_id)) {
                        deletedFeatureIds.add(feature.id);
                    }
                });
            }
        }

        // Delete features from all data structures
        for (const featureId of deletedFeatureIds) {
            this.geoJsonData.delete(featureId);
            this.measurementCache.delete(featureId);
        }

        // Update the visual layers to reflect the deletion
        this.debounceUpdateLayers();
    }


    /**
     * Cleanup resources
     * @private
     */
    _cleanUp() {
        // Reset hovered record ID
        this.hoveredRecordId = null;

        // Cancel all pending debounced operations to prevent stale updates
        if (this.debounceRenderGeolocationData?.cancel) {
            this.debounceRenderGeolocationData.cancel();
        }
        if (this.debounceUpdateLayers?.cancel) {
            this.debounceUpdateLayers.cancel();
        }
        if (this.debounceToggleRecordSelection?.cancel) {
            this.debounceToggleRecordSelection.cancel();
        }

        if (this.fitBoundsTimeout) {
            clearTimeout(this.fitBoundsTimeout);
            this.fitBoundsTimeout = null;
        }

        // Close any open info windows
        if (this.markerInfoWindow) {
            this.markerInfoWindow.close();
            this.markerInfoWindow = null;
        }

        // Remove all element event listeners
        for (const element of this._elementEventListeners.keys()) {
            this._removeElementEventListeners(element);
        }


        // Clean up Deck.gl overlay - clear layers first, then detach
        if (this.deckglOverlay) {
            try {
                // Clear all layers from the overlay before detaching
                this.deckglOverlay.setProps({ layers: [] });
                // Detach overlay from map
                this.deckglOverlay.setMap(null);
                // Finalize to clean up WebGL resources
                this.deckglOverlay.finalize();
            } catch (error) {
                console.warn('Error cleaning up DeckGL overlay:', error);
            } finally {
                this.deckglOverlay = null;
            }
        }

        // Clear data structures and reset features
        this.cacheRecordDataView.clear();
        this.geoJsonData.clear();


        this.selectedFeatureIds.clear();

        this.measurementCache.clear();

        // Clean up bounds
        this.latLngBounds = null;

        // Clean up cached data
        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        // Clean up event listeners
        if (this.googleMap) {
            google.maps.event.clearInstanceListeners(this.googleMap);
        }

        super._cleanUp();
    }

    validateProps() {
        if (!this.props.viewAttrs?.geoJsonField) {
            throw new Error('geoJsonField is required in view attributes for GoogleMapDeckGLRenderer');
        }

        if (this.props.list.fieldNames.indexOf(this.props.viewAttrs?.geoJsonField) === -1) {
            throw new Error(`GeoJSON field "${this.props.viewAttrs.geoJsonField}" not found in list view fields.`);
        }
    }

    getRecordDataView(record) {
        if (this.cacheRecordDataView.has(record.id)) {
            const cachedDataView = this.cacheRecordDataView.get(record.id);
            return cachedDataView;
        }
        const dataView = getRecordDataView(record, this.props.viewAttrs);
        this.cacheRecordDataView.set(record.id, dataView);
        return dataView;
    }
}
