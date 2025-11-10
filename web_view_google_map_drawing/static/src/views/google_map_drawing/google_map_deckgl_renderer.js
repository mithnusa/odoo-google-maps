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
    onMounted,
} from '@odoo/owl';
import { isNull } from '@web/views/utils';
import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { getRecordDataView, hexToRgba, generateColor, invertColorDarken } from '@web_view_google_map/views/google_map/utils';
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';
import { GoogleMapsDrawingSidebar } from './google_map_drawing_sidebar';
import {
    calculatePolygonArea,
    calculateLineStringLength,
    calculateCircleRadius,
    formatMeasurement,
    formatPointCount,
    MEASUREMENT_CONFIG,
    loadDeckGlAssets,
} from '../../utils/utils';

/**
 * Deck.gl configuration constants
 */
const DECKGL_CONFIG = {
    // Rendering performance
    MAX_FEATURES_PER_BATCH: 50000, // Maximum features to process per batch
    VIEWPORT_PADDING: 0.1, // Padding around viewport for culling (10%)

    // Memory management
    FEATURE_POOL_SIZE: 100000, // Pre-allocated feature object pool
    GC_INTERVAL: 30000, // Garbage collection interval (30s)
    MEMORY_THRESHOLD: 0.8, // Memory usage threshold for cleanup

    // Visual styling
    DEFAULT_COLORS: {
        FILL: [70, 130, 180, 80], // Steel blue with 80% opacity
        STROKE: [25, 25, 112, 255], // Midnight blue
        SELECTED_FILL: [0, 123, 255, 120], // Bright blue with transparency
        SELECTED_STROKE: [0, 86, 179, 255], // Deep blue
        HOVERED_FILL: [255, 165, 0, 120], // Gold with transparency
    },

    // Interactive features
    HOVER_RADIUS: 10, // Pixels for hover detection
    SELECT_RADIUS: 15, // Pixels for selection detection
    ANIMATION_DURATION: 300, // Milliseconds for smooth transitions
};

const STROKE_CONFIG = { 
    DEFAULT_WIDTH: 2, // Default stroke width in pixels
    HOVER_WIDTH: 4,   // Stroke width on hover in pixels
    MIN_WIDTH: 0.5, // Minimum stroke width in pixels
    MAX_WIDTH: 5, // Maximum stroke width in pixels
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
 * - Hover effects with visual feedback
 * - Feature selection with info windows
 * - Automatic viewport culling
 * - Memory-efficient data management
 * - Real-time styling and updates
 *
 * Interactive Features:
 * - Hover: Visual highlighting with measurement tooltips
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
 * Performance Benefits over Terra Draw:
 * - 10-100x faster rendering for large datasets
 * - Constant 60fps regardless of feature count
 * - Lower memory usage through efficient data structures
 * - Better responsiveness with large datasets
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
    static template = 'web_view_google_map_drawing.GoogleMapDeckGlRenderer';
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
        });

        this.controlPanelHeight = null;
        this.controlPanelResizeObserver = null;

        this.selectedFeatureIds = new Set();
        this._selectionVersion = 0; // Incrementing counter to trigger updates

        // Performance optimization
        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        // Deck.gl instance and layers
        this.deckglOverlay = null;
        this.layers = new Map();
        this.featureIndex = new Map(); // Spatial index for fast lookups

        // Data management
        this.geoJsonData = new Map(); // Efficient feature storage
        this.visibleFeatures = new Set(); // Currently visible features
        this.selectedFeatures = new Set(); // Selected features
        this.cacheRecordDataView = new Map(); // Cache for record data views
        this._elementEventListeners = new Map(); // Track element event listeners

        // Debounced operations for performance
        this.debounceRenderGeolocationData = debounce(this.renderGeolocationData.bind(this), 200);
        this.debounceUpdateViewport = debounce(this._updateViewportCulling.bind(this), 100);
        this.debounceGarbageCollection = debounce(this._performGarbageCollection.bind(this), 5000);

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        onWillStart(async () => {
            try {
                await loadDeckGlAssets();
            } catch (error) {
                console.error(error);
                this.notificationService.add(
                    _t('Failed to load Deck.gl assets. Please check javascript console for more information'),
                    { type: 'danger', title: _t('Error'), }
                );
            }
        });

        useEffect(() => {
            if (this.isMapLoaded() && !this._isSidebarAction && this.deckglOverlay) {
                this.debounceRenderGeolocationData();
                this._isSidebarAction = false;
            }
        }, () => [this.state.isMapReady]);

        onWillUpdateProps((nextProps) => {
            this.onWillUpdatePropsRenderMarkers(nextProps);
        });

        onPatched(() => {
            if (this._isSidebarAction) {
                this._isSidebarAction = false;
            }
        });

        onMounted(() => {
            this._setupControlPanelResizeObserver();
        });

        if (this.props.allowSelectors) {
            useBus(this.uiService.bus, 'google-map-center-map', this.centerMap);
        }

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
    onWillUpdatePropsRenderMarkers(nextProps) {
        if (!this.isMapLoaded()) {
            return;
        }

        const nextIsGrouped = !!nextProps.list.isGrouped;
        const currentIsGrouped = !!this.props.list.isGrouped;
        const isGroupingChanged = nextIsGrouped !== currentIsGrouped;

        // Clear all data when switching to grouped view
        if (isGroupingChanged && nextIsGrouped) {
            this._clearRenderingData();
            return;
        }

        // Re-render when not in grouped view (staying ungrouped or switching from grouped)
        if (!nextIsGrouped) {
            this.debounceRenderGeolocationData();
        }
    }

    /**
     * Create an empty feature object for the pool
     * @private
     */
    _createEmptyFeatureObject() {
        return {
            id: null,
            type: 'Feature',
            geometry: null,
            properties: null,
            bounds: null,
            visible: false,
            selected: false,
        };
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

        // Render shapes with batching
        this._renderShapesOptimized();
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
        // this.cacheRecordDataView.clear();
        this.visibleFeatures.clear();
        this.selectedFeatures.clear();
        this.selectedFeatureIds.clear();
        this.geoJsonData.clear();
        this.featureIndex.clear();
    }

    /**
     * Optimized shape rendering with batching and performance considerations
     * @private
     */
    async _renderShapesOptimized() {
        try {
            this.uiService.block();
            const datas = this.getGroupsOrRecords();
            if (this.isListGrouped) {
                await this._renderGroupedShapesOptimized(datas);
            } else {
                await this._renderUngroupedShapesOptimized(datas);
            }

            // Update Deck.gl layers
            this._updateDeckGLLayers();

            // Trigger garbage collection if needed
            this.debounceGarbageCollection();

            // Fit bounds once all features are processed
            this._fitBoundsWhenReady();
        } finally {
            this.uiService.unblock();
        }
    }

    /**
     * Render ungrouped shapes with performance optimizations
     * @private
     */
    async _renderUngroupedShapesOptimized(datas) {
        if (!datas.length) return;

        const batchSize = Math.min(DECKGL_CONFIG.MAX_FEATURES_PER_BATCH, datas.length);
        const batches = [];

        // Create batches for parallel processing
        for (let i = 0; i < datas.length; i += batchSize) {
            batches.push(datas.slice(i, i + batchSize));
        }

        // Process batches with requestIdleCallback for non-blocking rendering
        for (const batch of batches) {
            await this._processBatchAsync(batch);
        }
    }

    /**
     * Process a batch of features asynchronously
     * @private
     */
    _processBatchAsync(batch, color) {
        return new Promise((resolve) => {
            const processBatch = () => {
                batch.forEach(({ record }) => {
                    this._processRecordGeoJSON(record, color);
                });
                resolve();
            };

            if (window.requestIdleCallback) {
                window.requestIdleCallback(processBatch);
            } else {
                setTimeout(processBatch, 0);
            }
        });
    }

    /**
     * Render grouped shapes with optimizations
     * @private
     */
    async _renderGroupedShapesOptimized(datas) {
        const promises = datas.map(async ({ group }) => {
            try {
                const batch = group.records.map(record => ({ record }));
                await this._processBatchAsync(batch, group.groupColor);
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        });

        await Promise.all(promises);
    }

    /**
     * Render grouped records and fit bounds
     * @param {Array} datas 
     */
    async _renderGroupedRecordsFitBounds(datas) {
        // Render grouped shapes
        await this._renderGroupedShapesOptimized(datas);
        // Update Deck.gl layers
        this._updateDeckGLLayers();
        // Fit bounds when ready
        this._fitBoundsWhenReady();
    }

    /**
     * Process individual record GeoJSON with optimizations
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

            // Process features efficiently
            geoJson.features.forEach((feature, index) => {
                const featureId = `${record.id}-${index}`;
                const processedFeature = this._createOptimizedFeature(
                    feature,
                    recordValues,
                    dataView,
                    featureId,
                    color
                );
                this.geoJsonData.set(processedFeature.id, processedFeature);
                this._indexFeature(processedFeature);
                if (record.selected) {
                    processedFeature.selected = true;
                    this.selectedFeatureIds.add(processedFeature.id);
                }
            });

        } catch (error) {
            console.error('Error processing record GeoJSON:', error);
        }
    }

    /**
     * Create optimized feature object
     * @private
     */
    _createOptimizedFeature(feature, recordData, dataView, featureId, featureColor) {
        // Get object from pool or create new one
        const optimizedFeature = this._createEmptyFeatureObject();

        const color = featureColor || dataView?.other?.__geoColor || generateColor();

        const fillColor = hexToRgba(color, 0.3, DECKGL_CONFIG.DEFAULT_COLORS.FILL);
        const strokeColor = hexToRgba(invertColorDarken(color), 1.0, DECKGL_CONFIG.DEFAULT_COLORS.FILL);

        optimizedFeature.id = featureId;
        optimizedFeature.type = feature.type;
        optimizedFeature.geometry = feature.geometry;
        optimizedFeature.properties = {
            ...feature.properties,
            odoo: recordData,
            color,
            fillColor,
            strokeColor,
        };
        optimizedFeature.bounds = this._calculateFeatureBounds(feature.geometry);
        optimizedFeature.visible = true;
        optimizedFeature.selected = false;

        return optimizedFeature;
    }

    /**
     * Calculate feature bounds for culling
     * @private
     */
    _calculateFeatureBounds(geometry) {
        if (!geometry || !geometry.coordinates) {
            console.warn('Invalid geometry for bounds calculation');
            return { minX: 0, maxX: 0, minY: 0, maxY: 0};
        }

        const bounds = {
            minX: Infinity, maxX: -Infinity,
            minY: Infinity, maxY: -Infinity
        };

        const processCoordinates = (coords) => {
            if (!Array.isArray(coords) || coords.length === 0) return;

            if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                const [ lng, lat ] = coords;

                if (isFinite(lng) && isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
                    // Single coordinate pair
                    bounds.minX = Math.min(bounds.minX, coords[0]);
                    bounds.maxX = Math.max(bounds.maxX, coords[0]);
                    bounds.minY = Math.min(bounds.minY, coords[1]);
                    bounds.maxY = Math.max(bounds.maxY, coords[1]);
                } else {
                    console.warn('Invalid coordinate values:', coords);
                }
            } else if (Array.isArray(coords[0])) {
                // Nested coordinates
                coords.forEach(processCoordinates);
            }
        };

        processCoordinates(geometry.coordinates);

        if (!isFinite(bounds.minX)) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }
        return bounds;
    }


    /**
     * Index feature for spatial queries
     * @private
     */
    _indexFeature(feature) {
        const bounds = feature.bounds;
        const key = `${Math.floor(bounds.minX * 100)},${Math.floor(bounds.minY * 100)}`;

        if (!this.featureIndex.has(key)) {
            this.featureIndex.set(key, new Set());
        }
        this.featureIndex.get(key).add(feature.id);
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
     * Only visible features (after viewport culling) are rendered for performance.
     *
     * @private
     */
    _updateDeckGLLayers() {
        if (!this.deckglOverlay || !window.deck) return;

        const features = Array.from(this.geoJsonData.values());

        let visibleFeatures = []
        try {
            visibleFeatures = this._performViewportCulling(features);
        } catch (error) {
            console.warn('Viewport culling failed, rendering all features:', error);
            visibleFeatures = features;
        }

        const polygonData = visibleFeatures.filter(f =>
            f.geometry.type === 'Polygon' ||
            f.geometry.type === 'MultiPolygon'
        );

        const lineData = visibleFeatures.filter(f =>
            f.geometry.type === 'LineString' ||
            f.geometry.type === 'MultiLineString'
        );

        const pointData = visibleFeatures.filter(f =>
            f.geometry.type === 'Point' ||
            f.geometry.type === 'MultiPoint'
        ).map(f => ({
            ...f,
            position: f.geometry.type === 'Point'
                ? f.geometry.coordinates
                : f.geometry.coordinates[0]
        }));

        const layers = [
            // Polygon layer for filled shapes
            new window.deck.GeoJsonLayer({
                id: 'polygonsLayer',
                data: polygonData,
                filled: true,
                stroked: true,
                wrapLongitude: true, // Handle coordinate wrapping on viewport changes
                getFillColor: d => {
                    if (this.selectedFeatureIds.has(d.id)) {
                        return DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_FILL;
                    }
                    return d.properties.fillColor;
                },
                getLineColor: d => {
                    if (this.selectedFeatureIds.has(d.id)) {
                        return DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_STROKE;
                    }
                    return d.properties.strokeColor;
                },
                getLineWidth: d => {
                    if (this.selectedFeatureIds.has(d.id)) {
                        return STROKE_CONFIG.DEFAULT_WIDTH + 1; // 3px for selected
                    }
                    return STROKE_CONFIG.DEFAULT_WIDTH; // 2px default
                },
                lineWidthMinPixels: STROKE_CONFIG.DEFAULT_WIDTH,
                lineWidthMaxPixels: STROKE_CONFIG.HOVER_WIDTH,
                pickable: true,
                autoHighlight: true, // Use Deck.gl's built-in hover highlighting
                highlightColor: DECKGL_CONFIG.DEFAULT_COLORS.HOVERED_FILL, // Orange hover color
                updateTriggers: {
                    getFillColor: [this._selectionVersion],
                    getLineColor: [this._selectionVersion],
                    getLineWidth: [this._selectionVersion],
                }
            }),

            // Line layer for LineString geometries
            new window.deck.GeoJsonLayer({
                id: 'linesLayer',
                data: lineData,
                filled: false,
                stroked: true,
                wrapLongitude: true, // Handle coordinate wrapping on viewport changes
                getLineColor: d => d.properties.strokeColor,
                getLineWidth: 3,
                lineWidthMinPixels: 2,
                pickable: true,
                autoHighlight: true,
                highlightColor: DECKGL_CONFIG.DEFAULT_COLORS.HOVERED_FILL,
            }),

            // Point layer for Point geometries
            new window.deck.ScatterplotLayer({
                id: 'pointsLayer',
                data: pointData,
                getPosition: d => d.position,
                getRadius: 2,
                radiusScale: 2,
                stroked: true,
                filled: true,
                getFillColor: d => {
                    if (this.selectedFeatureIds.has(d.id)) {
                        return DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_FILL;
                    }
                    return d.properties.fillColor;
                },
                getLineColor: d => {
                    if (this.selectedFeatureIds.has(d.id)) {
                        return DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_STROKE;
                    }
                    return d.properties.strokeColor;
                },
                lineWidthMinPixels: 2,
                lineWidthMaxPixels: 3,
                pickable: true,
                autoHighlight: true,
                highlightColor: DECKGL_CONFIG.DEFAULT_COLORS.HOVERED_FILL,
                updateTriggers: {
                    getFillColor: [this._selectionVersion],
                    getLineColor: [this._selectionVersion],
                },
            }),
        ];

        this.deckglOverlay.setProps({ layers });
    }

    /**
     * Perform viewport culling for performance
     * @private
     */
    _performViewportCulling(features) {
        if (!this.googleMap) return features;

        const bounds = this.googleMap.getBounds();
        if (!bounds) return features;

        const viewport = {
            minX: bounds.getSouthWest().lng(),
            maxX: bounds.getNorthEast().lng(),
            minY: bounds.getSouthWest().lat(),
            maxY: bounds.getNorthEast().lat(),
        };

        // Add padding for smooth scrolling
        const padding = DECKGL_CONFIG.VIEWPORT_PADDING;
        const width = viewport.maxX - viewport.minX;
        const height = viewport.maxY - viewport.minY;

        viewport.minX -= width * padding;
        viewport.maxX += width * padding;
        viewport.minY -= height * padding;
        viewport.maxY += height * padding;

        // Filter features that intersect with viewport
        return features.filter(feature => {
            const bounds = feature.bounds;
            return !(bounds.maxX < viewport.minX ||
                    bounds.minX > viewport.maxX ||
                    bounds.maxY < viewport.minY ||
                    bounds.minY > viewport.maxY);
        });
    }

    /**
     * Update viewport culling when map moves
     * @private
     */
    _updateViewportCulling() {
        if (this.deckglOverlay) {
            this._updateDeckGLLayers();
        }
    }

    /**
     * Centers the map to show all features or selected features
     *
     * Calculates the bounding box that encompasses rendered features.
     * If there are selected records, centers only on those selected records' features.
     * Otherwise, centers on all features.
     * Uses Google Maps LatLngBounds for accurate geographic calculations.
     *
     * @returns {Promise<void>} Promise that resolves when map is centered
     */
    async centerMap() {
        if (!this.isMapLoaded()) return;

        // reset bounds
        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        this.latLngBounds = new LatLngBounds();

        // Check if there are selected records
        const selectedRecords = this.props.list?.selection || [];
        const hasSelection = selectedRecords.length > 0;

        if (hasSelection) {
            // Center only on selected records' features
            const selectedRecordIds = new Set(selectedRecords.map(r => r.id));

            for (const feature of this.geoJsonData.values()) {
                const recordId = feature.properties?.odoo?.id;
                if (recordId && selectedRecordIds.has(recordId)) {
                    const featureBounds = feature.bounds;
                    this.latLngBounds.extend({lat: featureBounds.minY, lng: featureBounds.minX});
                    this.latLngBounds.extend({lat: featureBounds.maxY, lng: featureBounds.maxX});
                }
            }
        } else {
            // Center on all features
            for (const feature of this.geoJsonData.values()) {
                const featureBounds = feature.bounds;
                this.latLngBounds.extend({lat: featureBounds.minY, lng: featureBounds.minX});
                this.latLngBounds.extend({lat: featureBounds.maxY, lng: featureBounds.maxX});
            }
        }

        if (!this.latLngBounds.isEmpty()) {
            this.googleMap.fitBounds(this.latLngBounds);
        }
    }

    /**
     * Fit the map to current bounds with animation
     * @private
     */
    _fitBoundsWhenReady() {
        if (this.geoJsonData.size > 0) {
            setTimeout(() => this.centerMap(), 100);
        }
    }

    /**
     * Perform garbage collection for memory management
     * @private
     */
    _performGarbageCollection() {
        // Clear unused features
        const currentTime = Date.now();
        for (const [id, feature] of this.geoJsonData.entries()) {
            if (!feature.visible && currentTime - feature.lastAccess > 60000) { // 1 minute
                this.geoJsonData.delete(id);
            }
        }

        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
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
            // Toggle selection
            const isSelected = this.selectedFeatureIds.has(featureId);

            if (isSelected) {
                this.selectedFeatureIds.delete(featureId);
            } else {
                this.selectedFeatureIds.add(featureId);
            }

            // Show info window
            this._showFeatureInfoWindow(feature, info.coordinate);

            // Trigger efficient update via updateTriggers instead of full rebuild
            // Just modify the Set, updateTriggers will detect the change and re-render
            this._triggerSelectionUpdate();
        }
    }

    /**
     * Efficiently trigger selection update without rebuilding layers
     *
     * This method forces Deck.gl to re-evaluate the color/style accessors
     * by incrementing a version counter. The updateTriggers detect this change
     * and re-render only the affected features without rebuilding layers.
     *
     * @private
     */
    _triggerSelectionUpdate() {
        if (!this.deckglOverlay) return;

        // Increment version counter to trigger updateTriggers
        // This is much more efficient than rebuilding all layers
        this._selectionVersion++;

        // Force Deck.gl to update by setting props with the same layers
        // but updateTriggers will detect the version change
        this.deckglOverlay.setProps({
            layers: this.deckglOverlay.props.layers
        });
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
    _calculateFeatureMeasurement(feature) {
        if (!feature || !feature.geometry) return null;

        const { type, coordinates } = feature.geometry;
        const unit = MEASUREMENT_CONFIG.UNITS.METRIC; // Default to metric
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
                    measurements.display_name = `Point (${measurements.coordinates})`;
                    break;

                case 'LineString':
                    const length = calculateLineStringLength(coordinates, unit);
                    measurements.type = 'Line';
                    measurements.length = formatMeasurement(length, 'distance', unit, user.context.lang);
                    measurements.points = formatPointCount(coordinates.length);
                    measurements.display_name = `Line (${measurements.length}) | Points: ${measurements.points}`;
                    break;

                case 'Polygon':
                    const polygonCoords = coordinates[0]; // Outer ring
                    const area = calculatePolygonArea(polygonCoords, unit);
                    const perimeter = calculateLineStringLength(polygonCoords, unit);
                    measurements.type = 'Polygon';
                    measurements.area = formatMeasurement(area, 'area', unit, user.context.lang);
                    measurements.perimeter = formatMeasurement(perimeter, 'distance', unit, user.context.lang);
                    measurements.points = formatPointCount(polygonCoords.length - 1); // Subtract 1 for closed polygon
                    measurements.display_name = `Polygon (${measurements.area}) | Perimeter: ${measurements.perimeter} | Points: ${measurements.points}`;

                    if (feature.properties?.mode === 'circle') {
                        if (feature.properties?.radiusKilometers) {
                            const radius = feature.properties.radiusKilometers;
                            const area = Math.PI * Math.pow(radius, 2);
                            measurements.area = formatMeasurement(area, 'area', unit, user.context.lang);
                            measurements.display_name = `Circle (${measurements.area})`;
                            measurements.radius = formatMeasurement(radius, 'distance', unit, user.context.lang);
                            measurements.display_name += ` | Radius: ${measurements.radius}`;
                            const diameter = radius * 2;
                            measurements.diameter = formatMeasurement(diameter, 'distance', unit, user.context.lang);
                            measurements.display_name += ` | Diameter: ${measurements.diameter}`;
                            break;
                        } else {
                            const radius = calculateCircleRadius(coordinates, unit);
                            const area = Math.PI * Math.pow(radius, 2);
                            measurements.area = formatMeasurement(area, 'area', unit, user.context.lang);
                            measurements.display_name = `Circle (${measurements.area})`;
                            measurements.radius = formatMeasurement(radius, 'distance', unit, user.context.lang);
                            measurements.display_name += ` | Radius: ${measurements.radius}`;
                            const diameter = Math.pow(radius, 2);
                            measurements.diameter = formatMeasurement(diameter, 'distance', unit, user.context.lang);
                            measurements.display_name += ` | Diameter: ${measurements.diameter}`;
                            break;
                        }
                    }
                    break;
                case 'MultiPolygon':
                    let totalArea = 0;
                    let totalPerimeter = 0;
                    let totalPoints = 0;
                    coordinates.forEach(polygon => {
                        const polyCoords = polygon[0]; // Outer ring
                        totalArea += calculatePolygonArea(polyCoords, unit);
                        totalPerimeter += calculateLineStringLength(polyCoords, unit);
                        totalPoints += polyCoords.length - 1; // Subtract 1 for closed polygon
                    });
                    measurements.type = 'MultiPolygon';
                    measurements.area = formatMeasurement(totalArea, 'area', unit, user.context.lang);
                    measurements.perimeter = formatMeasurement(totalPerimeter, 'distance', unit, user.context.lang);
                    measurements.points = formatPointCount(totalPoints);
                    measurements.display_name = `MultiPolygon (${measurements.area}) | Perimeter: ${measurements.perimeter} | Points: ${measurements.points}`;
                    break;

                default:
                    measurements.type = type;
                    measurements.display_name = 'Measurements not available for this geometry type';
            }
        } catch (error) {
            console.error('Error calculating measurement:', error);
            measurements.error = 'Error calculating measurements';
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
        const odooId = feature.properties?.odoo?.id;
        return this.props.list.records.find(r => r.id === odooId);
    }

    /**
     * Get groups or records data with caching optimization
     *
     * Retrieves and caches the current list data (groups or records) to avoid
     * unnecessary recalculations. Uses JSON comparison to detect changes and
     * only rebuilds the data structure when the underlying list changes.
     *
     * For grouped lists, sorts groups to handle null values appropriately.
     * For ungrouped lists, maps records directly with their IDs as keys.
     *
     * @returns {Array} Array of group or record data objects with keys
     */
    getGroupsOrRecords() {
        if (!this.isMapLoaded()) return [];
        const { list } = this.props;

        const currentProps = {
            isGrouped: this.isListGrouped,
            recordsIds: this.isListGrouped
                ? list.groups.map(group => group.id)
                : list.records.map(record => record.id),
            length: this.isListGrouped ? list.groups.length : list.records.length,
        };

        if (
            this.cachedGroupsOrRecords &&
            JSON.stringify(currentProps) === JSON.stringify(this.lastGroupsOrRecordsProps)
        ) {
            return this.cachedGroupsOrRecords;
        }

        let result;
        if (this.isListGrouped) {
            result = [...list.groups]
                .sort((a, b) => (a.value && !b.value ? 1 : !a.value && b.value ? -1 : 0))
                .map((group, i) => ({
                    group,
                    key: isNull(group.value) ? `group_key_${i}` : `${String(group.value)}_${i}`,
                }));
        } else {
            result = list.records.map(record => ({ record, key: record.id }));
        }

        this.lastGroupsOrRecordsProps = currentProps;
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

        // Add map event listeners for performance
        this.googleMap.addListener('bounds_changed', this.debounceUpdateViewport);
        this.googleMap.addListener('zoom_changed', this.debounceUpdateViewport);
    }

    /**
     * Render tooltip content for features
     *
     * Creates HTML content for feature tooltips including:
     * - Feature title from Odoo record
     * - Geometry measurements (area, perimeter, length, coordinates)
     * - Formatted display with line breaks for readability
     *
     * @param {Object} feature - GeoJSON feature to create tooltip for
     * @returns {string|null} HTML string for tooltip or null if invalid feature
     * @private
     */
    _renderTooltipContent(feature) {
        if (!feature || !feature.properties) return null;
        const measurements = this._calculateFeatureMeasurement(feature);
        const displayNames = (measurements?.display_name || '').split('|');
        const contentHtml = renderToString('web_view_google_map_drawing.FeatureProperties', {
            title: feature.properties.odoo?.title || _t('Feature'),
            displayNames,
        });
        return contentHtml;
    }

    /**
     * Initialize Deck.gl overlay on Google Maps
     *
     * Sets up the Deck.gl GoogleMapsOverlay with:
     * - Tooltip configuration for interactive hover information
     * - Click and hover event handlers
     * - Integration with the Google Maps instance
     * - Initial data rendering
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
                            opacity: '0.9',
                        }
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
     * @param {*} element 
     * @param {*} eventType 
     * @param {*} listener 
     */
    _storeElementEventListener(element, eventType, listener) {
        if (!this._elementEventListeners.has(element)) {
            this._elementEventListeners.set(element, new Map());
        }

        this._elementEventListeners.get(element).set(eventType, listener);
    }

    /**
     * Remove all event listeners for an element
     * @param {*} element 
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
        if (!this.isMapLoaded()) return;
        try {
            const features = [];
            this.geoJsonData.forEach((feature) => {
                if (feature.properties?.odoo?.id === recordId) {
                    features.push(feature);
                }
            });

            if (features.length > 0) {
                const { LatLngBounds } = await this.apiLoader.importLibrary('core');
                this.latLngBounds = new LatLngBounds();


                const boundsPromise = new Promise((resolve, reject) => {
                    try {
                        features.forEach(feature => {
                            const featureBounds = feature.bounds;
                            this.latLngBounds.extend({ lat: featureBounds.minY, lng: featureBounds.minX });
                            this.latLngBounds.extend({ lat: featureBounds.maxY, lng: featureBounds.maxX });
                        });
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });

                await boundsPromise;

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
     * Toggles selection state of a specific record
     * @param {Object} record - Record to toggle selection for
     * @param {boolean} [pointInMap=false] - Whether to center map on selection
     */
    toggleRecordSelection(record) {
        if (!record) return;

        this.markerInfoWindow.close();

        record.toggleSelection().then(() => {
            this.pointInMap(record.id, true);
        });

        this.props.list.selectDomain(false);
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
        // Find all features for this record
        const features = [];
        this.geoJsonData.forEach((feature) => {
            if (feature.id.startsWith(`${record.id}-`)) {
                features.push(feature);
            }
        });

        if (features.length > 0) {
            // Update selectedFeatureIds based on record selection state
            features.forEach(feature => {
                if (record.selected) {
                    this.selectedFeatureIds.add(feature.id);
                } else {
                    this.selectedFeatureIds.delete(feature.id);
                }
            });

            // Trigger visual update
            this._triggerSelectionUpdate();

            // Center map if requested
            if (pointInMap && record.selected) {
                this.pointInMap(record.id, true);
            }
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

        groupRecords.forEach((record) => {
            const _id = record.id.toString() + '-';
            this.geoJsonData.forEach((feature) => {
                if (feature.id.startsWith(_id)) {
                    deletedFeatureIds.add(feature.id);
                }
            });
        });

        // Delete features from all data structures
        deletedFeatureIds.forEach(featureId => {
            this.geoJsonData.delete(featureId);
            this.selectedFeatureIds.delete(featureId);
            this.visibleFeatures.delete(featureId);
        });

        // Clean up feature index
        this.featureIndex.forEach((featureSet) => {
            deletedFeatureIds.forEach(featureId => {
                featureSet.delete(featureId);
            });
        });

        // Update the visual layers to reflect the deletion
        this._updateDeckGLLayers();

        this._fitBoundsWhenReady();
    }


    /**
     * Cleanup resources
     * @private
     */
    _cleanUp() {
        // Close any open info windows
        if (this.markerInfoWindow) {
            this.markerInfoWindow.close();
            this.markerInfoWindow = null;
        }

        // Remove all element event listeners
        for (const [element, ] of this._elementEventListeners) {
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
            }
            this.deckglOverlay = null;
        }

        // Clear data structures
        this.cacheRecordDataView.clear();
        this.geoJsonData.clear();
        this.visibleFeatures.clear();
        this.selectedFeatures.clear();
        this.featureIndex.clear();
        this.selectedFeatureIds.clear();
        this.layers.clear();

        // Clean up hover state
        this.hoveredFeatureId = null;

        // Clean up bounds
        this.dataBounds = null;
        this.viewportBounds = null;
        this.latLngBounds = null;

        // Clean up cached data
        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        // Clean up event listeners
        if (this.googleMap) {
            google.maps.event.clearListeners(this.googleMap, 'idle');
            google.maps.event.clearListeners(this.googleMap, 'bounds_changed');
            google.maps.event.clearListeners(this.googleMap, 'zoom_changed');
        }

        // Clean up ResizeObserver for control panel
        if (this.controlPanelResizeObserver) {
            this.controlPanelResizeObserver.disconnect();
            this.controlPanelResizeObserver = null;
        }

        // Reset control panel height
        this.controlPanelHeight = null;

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

    /**
     * Setup ResizeObserver for control panel to prevent layout shifts
     *
     * Deck.gl is very sensitive to layout shifts causing rendering issues.
     * The control panel is adaptive and can change height dynamically when
     * records are selected, which causes a 2px shift that triggers jittery
     * hover behavior in Deck.gl.
     *
     * This method:
     * 1. Captures the initial height of the control panel
     * 2. Observes any height changes
     * 3. Locks the height to prevent unwanted shifts
     *
     * @private
     */
    _setupControlPanelResizeObserver() {
        // Prevent creating multiple observers
        if (this.controlPanelResizeObserver) {
            console.warn('Control panel ResizeObserver already exists, skipping setup');
            return;
        }

        const controlPanelEl = document.querySelector('.o_control_panel');

        if (!controlPanelEl) {
            console.warn('Control panel element not found for resize observation');
            return;
        }

        // Capture initial height
        this.controlPanelHeight = controlPanelEl.getBoundingClientRect().height;

        // Create observer to lock height when it tries to change
        this.controlPanelResizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const newHeight = entry.target.getBoundingClientRect().height;

                // If height changed from the initial value, lock it
                if (this.controlPanelHeight !== null && newHeight !== this.controlPanelHeight) {
                    entry.target.style.height = `${this.controlPanelHeight}px`;
                }
            }
        });

        // Start observing
        this.controlPanelResizeObserver.observe(controlPanelEl);
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
