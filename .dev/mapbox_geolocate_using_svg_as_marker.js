import { _t } from '@web/core/l10n/translation';
import { MAPBOXGL_CONFIG, STROKE_CONFIG } from '@base_mapbox_gl_js/utils/utils';
import { BaseMapboxRenderer } from '@web_view_base_mapbox/map_base/map_base_renderer';
import { calculateFeatureCentroid } from '@web_view_base_mapbox/map_base/utils';

// Layer configuration for Mapbox GL JS - Point geometry only
const LAYER_CONFIG = {
    GEOJSON_SYMBOL: 'geojson-symbol',
    GEOJSON_SYMBOL_HOVER: 'geojson-symbol-hover',
    GEOJSON_SYMBOL_SELECTED: 'geojson-symbol-selected',
    GEOJSON_SOURCE: 'geojson-data',
};

// Feature styling configuration for Point geometry with icon markers
const FEATURE_STYLES = {
    ICON: {
        SIZE: { DEFAULT: 1.0, HOVER: 1.2, SELECTED: 1.4 },
        OPACITY: { DEFAULT: 0.9, HOVER: 0.95, SELECTED: 1.0 },
        ANCHOR: 'bottom',
        ALLOW_OVERLAP: true,
    },
    COLORS: {
        DEFAULT: {
            FILL: MAPBOXGL_CONFIG.DEFAULT_COLORS.FILL,
            STROKE: MAPBOXGL_CONFIG.DEFAULT_COLORS.STROKE,
        },
        HOVER: {
            FILL: '#f57c20',
            STROKE: '#ff9130',
        },
        SELECTED: {
            FILL: '#4ECDC4',
            STROKE: '#45B7B8',
        },
    },
    TRANSITIONS: {
        DURATION: 300,
        EASING: 'ease-out',
    },
};

export class MapboxGlJsGeolocateRenderer extends BaseMapboxRenderer {
    setup() {
        super.setup();

        // Mapbox-specific state
        this.hoveredFeatureId = null;
        this.hoverCleanupTimeout = null;
        this.mouseMoveDebounce = null;
        this.popup = null;

        // Store bound function references for proper cleanup
        this.boundHandleFeatureClick = this._handleFeatureClick.bind(this);
        this.boundHandleFeatureHover = this._handleFeatureHover.bind(this);
        this.boundHandleFeatureLeave = this._handleFeatureLeave.bind(this);
        this.boundHandleMouseMove = this._handleMouseMove.bind(this);

        // Store loaded icon images to avoid duplicates
        this.loadedIcons = new Set();
    }

    /**
     * Create SVG marker icon with specified fill and stroke colors
     * @param {string} fillColor - Fill color for the marker
     * @param {string} strokeColor - Stroke color for the marker
     * @returns {string} Base64 encoded SVG data URI
     * @private
     */
    _createMarkerSvg(fillColor, strokeColor) {
        const svg = `
            <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.3"/>
                    </filter>
                </defs>
                <!-- Marker pin shape -->
                <path d="M12 0C5.383 0 0 5.383 0 12c0 9 12 24 12 24s12-15 12-24c0-6.617-5.383-12-12-12z"
                      fill="${fillColor}"
                      stroke="${strokeColor}"
                      stroke-width="2"
                      filter="url(#shadow)"/>
                <!-- Inner circle -->
                <circle cx="12" cy="12" r="6" fill="#ffffff" opacity="0.9"/>
                <circle cx="12" cy="12" r="4" fill="${fillColor}"/>
            </svg>
        `;

        // Convert SVG to base64 data URI
        const base64 = btoa(svg);
        return `data:image/svg+xml;base64,${base64}`;
    }

    /**
     * Generate icon ID based on colors for caching
     * @param {string} fillColor - Fill color
     * @param {string} strokeColor - Stroke color
     * @returns {string} Unique icon ID
     * @private
     */
    _getIconId(fillColor, strokeColor) {
        const fill = fillColor.replace('#', '');
        const stroke = strokeColor.replace('#', '');
        return `marker-${fill}-${stroke}`;
    }

    /**
     * Load icon image into map style if not already loaded
     * @param {string} fillColor - Fill color for the marker
     * @param {string} strokeColor - Stroke color for the marker
     * @returns {string} Icon ID that can be used in symbol layer
     * @private
     */
    _loadMarkerIcon(fillColor, strokeColor) {
        const iconId = this._getIconId(fillColor, strokeColor);

        if (!this.loadedIcons.has(iconId)) {
            const svgDataUri = this._createMarkerSvg(fillColor, strokeColor);

            // Create an image element to load the SVG
            const img = new Image();
            img.onload = () => {
                if (this.isMapReady() && !this.mapBoxGlJs.hasImage(iconId)) {
                    this.mapBoxGlJs.addImage(iconId, img);
                    this.loadedIcons.add(iconId);
                }
            };
            img.src = svgDataUri;
        }

        return iconId;
    }

    /**
     * Preload icons for all custom colors found in current features
     * @private
     */
    _preloadCustomIcons() {
        if (!this.geoJsonData) return;

        const uniqueColorCombinations = new Set();

        // Collect all unique color combinations from features
        this.geoJsonData.forEach((feature) => {
            const fillColor = feature.properties?.fillColor;
            const strokeColor = feature.properties?.strokeColor;

            if (fillColor && strokeColor) {
                const key = `${fillColor}-${strokeColor}`;
                uniqueColorCombinations.add(key);
            }
        });

        // Load icons for each unique color combination
        uniqueColorCombinations.forEach((colorKey) => {
            const [fillColor, strokeColor] = colorKey.split('-');
            this._loadMarkerIcon(fillColor, strokeColor);
        });
    }

    /**
     * Update the map with processed GeoJSON data
     * Creates or updates map layers and sources
     * @override
     */
    updateMap() {
        if (!this.isMapReady()) return;

        // If no data, clear layers and return
        if (!this.hasData) {
            this.removeFeatureInteractions();
            this.removeMapLayers();
            return;
        }

        // Preload icons for custom colors in features
        this._preloadCustomIcons();

        // Update existing source data if source exists, otherwise create new layers
        const source = this.mapBoxGlJs.getSource(LAYER_CONFIG.GEOJSON_SOURCE);
        if (source) {
            const features = Array.from(this.geoJsonData.values());
            source.setData({
                type: 'FeatureCollection',
                features: features,
            });
        } else {
            this.addGeometryLayers();
            this.setupFeatureInteractions();
        }

        this.debounceCenterMap();
    }

    /**
     * Remove all map layers and sources
     * @override
     */
    removeMapLayers() {
        if (!this.isMapReady()) return;

        // Remove all symbol layers
        const layers = [
            LAYER_CONFIG.GEOJSON_SYMBOL_SELECTED,
            LAYER_CONFIG.GEOJSON_SYMBOL_HOVER,
            LAYER_CONFIG.GEOJSON_SYMBOL,
        ];

        layers.forEach((layerId) => {
            if (this.mapBoxGlJs.getLayer(layerId)) {
                this.mapBoxGlJs.removeLayer(layerId);
            }
        });

        if (this.mapBoxGlJs.getSource(LAYER_CONFIG.GEOJSON_SOURCE)) {
            this.mapBoxGlJs.removeSource(LAYER_CONFIG.GEOJSON_SOURCE);
        }
    }

    /**
     * Add symbol layer for Point geometries with icon markers
     * Creates layer with data-driven styling for feature colors
     * @override
     */
    addGeometryLayers() {
        // Remove existing layers first
        this.removeMapLayers();

        // Add or update the GeoJSON source
        this.addGeoJsonSource();

        // Load default icons for different states
        this._loadDefaultIcons();

        // Add symbol layers for different states
        this._addSymbolLayers();
    }

    /**
     * Add or update the GeoJSON data source
     * @override
     */
    addGeoJsonSource() {
        if (!this.mapBoxGlJs.getSource(LAYER_CONFIG.GEOJSON_SOURCE)) {
            const features = Array.from(this.geoJsonData.values());
            this.mapBoxGlJs.addSource(LAYER_CONFIG.GEOJSON_SOURCE, {
                type: 'geojson',
                generateId: true, // Ensure Mapbox generates consistent IDs for feature-state
                data: {
                    type: 'FeatureCollection',
                    features: features,
                },
            });
        }
    }

    /**
     * Load default icon variants for different states
     * @private
     */
    _loadDefaultIcons() {
        // Load icons for default, hover, and selected states
        this._loadMarkerIcon(
            FEATURE_STYLES.COLORS.DEFAULT.FILL,
            FEATURE_STYLES.COLORS.DEFAULT.STROKE
        );
        this._loadMarkerIcon(
            FEATURE_STYLES.COLORS.HOVER.FILL,
            FEATURE_STYLES.COLORS.HOVER.STROKE
        );
        this._loadMarkerIcon(
            FEATURE_STYLES.COLORS.SELECTED.FILL,
            FEATURE_STYLES.COLORS.SELECTED.STROKE
        );
    }

    /**
     * Add symbol layers for Point geometries with icon markers
     * Creates multiple layers to handle different states since feature-state
     * is not supported in layout properties
     * @private
     */
    _addSymbolLayers() {
        // Base layer - always visible
        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_SYMBOL,
            type: 'symbol',
            source: LAYER_CONFIG.GEOJSON_SOURCE,
            layout: {
                'icon-image': this._createIconExpression(),
                'icon-size': FEATURE_STYLES.ICON.SIZE.DEFAULT,
                'icon-anchor': FEATURE_STYLES.ICON.ANCHOR,
                'icon-allow-overlap': FEATURE_STYLES.ICON.ALLOW_OVERLAP,
            },
            paint: {
                'icon-opacity': FEATURE_STYLES.ICON.OPACITY.DEFAULT,
            },
        });

        // Hover layer - initially hidden, shown on hover
        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_SYMBOL_HOVER,
            type: 'symbol',
            source: LAYER_CONFIG.GEOJSON_SOURCE,
            layout: {
                'icon-image': this._createHoverIconExpression(),
                'icon-size': FEATURE_STYLES.ICON.SIZE.HOVER,
                'icon-anchor': FEATURE_STYLES.ICON.ANCHOR,
                'icon-allow-overlap': FEATURE_STYLES.ICON.ALLOW_OVERLAP,
            },
            paint: {
                'icon-opacity': FEATURE_STYLES.ICON.OPACITY.HOVER,
            },
            filter: ['==', ['get', 'id'], ''], // Initially hide all features
        });

        // Selected layer - initially hidden, shown on selection
        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_SYMBOL_SELECTED,
            type: 'symbol',
            source: LAYER_CONFIG.GEOJSON_SOURCE,
            layout: {
                'icon-image': this._createSelectedIconExpression(),
                'icon-size': FEATURE_STYLES.ICON.SIZE.SELECTED,
                'icon-anchor': FEATURE_STYLES.ICON.ANCHOR,
                'icon-allow-overlap': FEATURE_STYLES.ICON.ALLOW_OVERLAP,
            },
            paint: {
                'icon-opacity': FEATURE_STYLES.ICON.OPACITY.SELECTED,
            },
            filter: ['==', ['get', 'id'], ''], // Initially hide all features
        });
    }


    /**
     * Create a Mapbox GL JS opacity expression with hover/selected states
     * @param {number} selectedOpacity - Opacity when selected
     * @param {number} hoverOpacity - Opacity when hovered
     * @param {number} defaultOpacity - Default opacity
     * @returns {Array} Mapbox GL JS expression array
     * @private
     */
    _createOpacityExpression(selectedOpacity, hoverOpacity, defaultOpacity) {
        return [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            selectedOpacity,
            ['boolean', ['feature-state', 'hover'], false],
            hoverOpacity,
            defaultOpacity,
        ];
    }

    /**
     * Create a Mapbox GL JS icon expression for symbol markers (default state)
     * @returns {Array} Mapbox GL JS expression array
     * @private
     */
    _createIconExpression() {
        const defaultIcon = this._getIconId(
            FEATURE_STYLES.COLORS.DEFAULT.FILL,
            FEATURE_STYLES.COLORS.DEFAULT.STROKE
        );

        return [
            'case',
            // Check if feature has custom colors
            ['all', ['!=', ['get', 'fillColor'], null], ['!=', ['get', 'strokeColor'], null]],
            ['concat', 'marker-', ['slice', ['get', 'fillColor'], 1], '-', ['slice', ['get', 'strokeColor'], 1]],
            defaultIcon,
        ];
    }

    /**
     * Create a Mapbox GL JS icon expression for hover state
     * @returns {string} Static hover icon ID
     * @private
     */
    _createHoverIconExpression() {
        return this._getIconId(
            FEATURE_STYLES.COLORS.HOVER.FILL,
            FEATURE_STYLES.COLORS.HOVER.STROKE
        );
    }

    /**
     * Create a Mapbox GL JS icon expression for selected state
     * @returns {string} Static selected icon ID
     * @private
     */
    _createSelectedIconExpression() {
        return this._getIconId(
            FEATURE_STYLES.COLORS.SELECTED.FILL,
            FEATURE_STYLES.COLORS.SELECTED.STROKE
        );
    }


    /**
     * Setup feature interaction handlers (click, hover, mousemove) for symbol layer
     * Configures event listeners for map feature interactions
     */
    setupFeatureInteractions() {
        // Clean up existing listeners first
        this.removeFeatureInteractions();

        // Only setup interactions if there is data
        if (!this.hasData) return;

        // Setup click and hover handlers for symbol layer
        this.mapBoxGlJs.on('click', LAYER_CONFIG.GEOJSON_SYMBOL, this.boundHandleFeatureClick);
        this.mapBoxGlJs.on('mouseenter', LAYER_CONFIG.GEOJSON_SYMBOL, this.boundHandleFeatureHover);
        this.mapBoxGlJs.on('mouseleave', LAYER_CONFIG.GEOJSON_SYMBOL, this.boundHandleFeatureLeave);

        // Add a global mousemove handler for better hover detection
        this.mapBoxGlJs.on('mousemove', this.boundHandleMouseMove);
    }

    /**
     * Remove all feature interaction handlers to prevent memory leaks
     * Cleans up event listeners when component is destroyed or data changes
     */
    removeFeatureInteractions() {
        if (!this.isMapReady()) return;

        // Remove global mouse move handler
        this.mapBoxGlJs.off('mousemove', this.boundHandleMouseMove);

        // Remove symbol layer event handlers
        try {
            this.mapBoxGlJs.off('click', LAYER_CONFIG.GEOJSON_SYMBOL, this.boundHandleFeatureClick);
            this.mapBoxGlJs.off(
                'mouseenter',
                LAYER_CONFIG.GEOJSON_SYMBOL,
                this.boundHandleFeatureHover
            );
            this.mapBoxGlJs.off(
                'mouseleave',
                LAYER_CONFIG.GEOJSON_SYMBOL,
                this.boundHandleFeatureLeave
            );
        } catch (error) {
            // Layer might not exist, ignore error
        }
    }

    /**
     * Handle feature click events
     * Opens the record detail view when a feature is clicked
     * @param {Object} e - Click event object
     * @private
     */
    _handleFeatureClick(e) {
        if (!e.features || e.features.length === 0) return;

        try {
            const feature = e.features[0];
            const odooData = JSON.parse(feature.properties?.odoo);
            if (odooData?.resId) {
                const record = this.getRecordById(odooData.resId);
                if (record) {
                    this.props.showRecord(record);
                }
            }
        } catch (error) {
            console.error('Error handling feature click:', error);
        }
    }

    /**
     * Handle feature hover events
     * Shows popup and applies hover styling to features
     * @param {Object} e - Hover event object
     * @private
     */
    _handleFeatureHover(e) {
        if (!e.features || e.features.length === 0) {
            this._hideFeaturePopup();
            return;
        }

        const feature = e.features[0];
        const featureId = feature.id;

        if (featureId === undefined || featureId === null) {
            this._hideFeaturePopup();
            console.warn('Feature has no ID from Mapbox, hover state cannot work');
            return;
        }

        // Cancel any pending hover cleanup
        if (this.hoverCleanupTimeout) {
            clearTimeout(this.hoverCleanupTimeout);
            this.hoverCleanupTimeout = null;
        }

        // Clear previous hover state by hiding the hover layer for all features
        if (this.hoveredFeatureId !== null && this.hoveredFeatureId !== featureId) {
            this.mapBoxGlJs.setFilter(LAYER_CONFIG.GEOJSON_SYMBOL_HOVER, ['==', ['get', 'id'], '']);
        }

        // Set new hover state by showing the hover layer for this feature
        this.hoveredFeatureId = featureId;
        const odooData = JSON.parse(feature.properties?.odoo || '{}');
        const recordId = odooData.resId || feature.properties?.id;
        if (recordId) {
            this.mapBoxGlJs.setFilter(LAYER_CONFIG.GEOJSON_SYMBOL_HOVER, ['==', ['get', 'id'], recordId]);
        }

        // Enhanced cursor feedback
        const canvas = this.mapBoxGlJs.getCanvas();
        canvas.style.cursor = 'pointer';

        // Show popup
        this._showFeaturePopup(e, feature);
    }

    /**
     * Handle feature mouse leave events
     * Removes hover styling and hides popup with delay for adjacent polygons
     * @private
     */
    _handleFeatureLeave() {
        if (this.hoverCleanupTimeout) {
            clearTimeout(this.hoverCleanupTimeout);
        }
        // For adjacent polygons, use a longer timeout to prevent flicker
        this.hoverCleanupTimeout = setTimeout(() => {
            if (this.hoveredFeatureId !== null) {
                // Hide hover layer for all features
                this.mapBoxGlJs.setFilter(LAYER_CONFIG.GEOJSON_SYMBOL_HOVER, ['==', ['get', 'id'], '']);
                this.hoveredFeatureId = null;
            }

            // Reset cursor
            const canvas = this.mapBoxGlJs.getCanvas();
            canvas.style.cursor = '';

            // Hide popup
            this._hideFeaturePopup();
        }, 100);
    }

    /**
     * Handle mouse move for better hover detection of Point features
     * Provides more reliable hover detection for Point geometries
     * @param {Object} e - Mouse move event object
     * @private
     */
    _handleMouseMove(e) {
        // if there is no symbol layer, skip processing
        if (!this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_SYMBOL)) {
            return;
        }

        // Debounce mouse move to avoid excessive processing
        if (this.mouseMoveDebounce) {
            clearTimeout(this.mouseMoveDebounce);
        }

        this.mouseMoveDebounce = setTimeout(() => {
            // Query features at current position
            try {
                const features = this.mapBoxGlJs.queryRenderedFeatures(e.point, {
                    layers: [LAYER_CONFIG.GEOJSON_SYMBOL],
                });
                if (features && features.length > 0) {
                    const feature = features[0];
                    const featureId = feature.id;

                    // If we have a different feature than currently hovered, trigger hover
                    if (
                        featureId !== undefined &&
                        featureId !== null &&
                        this.hoveredFeatureId !== featureId
                    ) {
                        this.boundHandleFeatureHover({ features: [feature], point: e.point });
                    }
                } else {
                    // No features found, clear hover if we have one
                    if (this.hoveredFeatureId !== null) {
                        this._handleFeatureLeave(e);
                    }
                }
            } catch (error) {
                console.error('Error querying features on mouse move:', error);
            }
        }, 10); // Small debounce delay
    }

    /**
     * Show popup with feature information
     * @param {Object} e - Event object containing coordinates
     * @param {Object} feature - GeoJSON feature object
     * @private
     */
    _showFeaturePopup(e, feature) {
        const odooData = feature.properties?.odoo;
        if (!odooData) return;

        // Always ensure any existing popup is removed first
        this._hideFeaturePopup();

        try {
            const data = JSON.parse(odooData);
            const geometryType = feature.geometry?.type || 'Unknown';
            const featureColor = feature.properties?.color || FEATURE_STYLES.COLORS.HOVER.FILL;

            const popupContent = `
                <div class="mapbox-popup-content" style="min-width: 200px;">
                    <div class="popup-header" style="border-left: 4px solid ${featureColor}; padding-left: 8px; margin-bottom: 8px;">
                        <h6 style="margin: 0; color: #2c3e50; font-weight: 600;">${
                            data.title || 'Feature'
                        }</h6>
                        <small style="color: #7f8c8d; font-size: 11px; text-transform: uppercase;">${geometryType}</small>
                    </div>
                    ${
                        data.subTitle
                            ? `<p style="margin: 4px 0; color: #34495e; font-size: 13px;">${data.subTitle}</p>`
                            : ''
                    }
                    <div class="popup-actions" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ecf0f1;">
                        <small style="color: #95a5a6; font-size: 11px;">
                            <i class="fa fa-hand-pointer-o"></i> Click to view details
                        </small>
                    </div>
                </div>
            `;

            // Get popup coordinates - handle different event sources
            let popupCoords;
            if (e.lngLat) {
                // Standard mouseenter event
                popupCoords = e.lngLat;
            } else if (e.point && this.mapBoxGlJs) {
                // Mouse move event - convert screen coordinates to lng/lat
                popupCoords = this.mapBoxGlJs.unproject(e.point);
            } else {
                // Fallback: calculate centroid of the feature
                popupCoords = calculateFeatureCentroid(feature);
            }

            this.popup = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'mapbox-feature-popup enhanced-popup',
                maxWidth: '300px',
            })
                .setLngLat(popupCoords)
                .setHTML(popupContent)
                .addTo(this.mapBoxGlJs);

            // Add close event listener to clean up reference
            this.popup.on('close', () => {
                this.popup = null;
            });

            // Add smooth fade-in animation
            const popupElement = this.popup.getElement();
            if (popupElement) {
                popupElement.style.opacity = '0';
                popupElement.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    popupElement.style.opacity = '1';
                }, 10);
            }
        } catch (error) {
            console.error('Error parsing odoo data for popup:', error);
        }
    }

    /**
     * Hide and remove the current feature popup
     * @private
     */
    _hideFeaturePopup() {
        if (this.popup) {
            try {
                this.popup.remove();
            } catch (error) {
                console.warn('Error removing popup:', error);
            }
            this.popup = null;
        }
    }

    /**
     * Calculate bounding box for a geometry
     * @param {Object} geometry - GeoJSON geometry object
     * @returns {Object} Bounding box with minX, minY, maxX, maxY
     * @private
     */
    _calculateFeatureBounds(geometry) {
        if (!geometry || !geometry.coordinates) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        let coords = [];

        const extractCoordinates = (coordArray) => {
            if (typeof coordArray[0] === 'number') {
                coords.push(coordArray);
            } else {
                coordArray.forEach(extractCoordinates);
            }
        };

        try {
            extractCoordinates(geometry.coordinates);

            if (coords.length === 0) {
                return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
            }

            const lngs = coords.map((coord) => coord[0]);
            const lats = coords.map((coord) => coord[1]);

            return {
                minX: Math.min(...lngs),
                minY: Math.min(...lats),
                maxX: Math.max(...lngs),
                maxY: Math.max(...lats),
            };
        } catch (error) {
            console.error('Error calculating feature bounds:', error);
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }
    }

    /**
     * Zoom and center map on a specific record
     * @param {Object} record - Record to focus on
     * @override
     */
    pointInMap(record) {
        if (!record) return;
        const recordId = this.getRecordId(record);
        this._isSidebarAction = true;
        const feature = this.getGeoJsonByRecordId(recordId);
        this.centerMapByFeature(feature);
        this.hoverByFeature(feature);
    }

    /**
     * Hover and highlight a feature by its GeoJSON feature
     * @param {Object} record - The record associated with the feature
     */
    hoverByFeature(feature) {
        const centroid = calculateFeatureCentroid(feature);
        this.boundHandleFeatureHover({
            features: [feature],
            point: null,
            lngLat: { lng: centroid[0], lat: centroid[1] },
        });
    }

    /**
     * Center map on a specific feature
     * @param {Object} feature - The GeoJSON feature to center on
     */
    centerMapByFeature(feature) {
        if (feature && feature.geometry) {
            const bounds = this._calculateFeatureBounds(feature.geometry);
            if (bounds.minX === bounds.maxX && bounds.minY === bounds.maxY) {
                // Single point - zoom in closely
                this.mapBoxGlJs.flyTo({
                    center: [bounds.minX, bounds.minY],
                    zoom: 15,
                    essential: true,
                    duration: 1000,
                });
            } else {
                // Fit to bounds with padding
                this.mapBoxGlJs.fitBounds(
                    [
                        [bounds.minX, bounds.minY],
                        [bounds.maxX, bounds.maxY],
                    ],
                    {
                        padding: 100,
                        maxZoom: 15,
                        duration: 1000,
                    }
                );
            }
        }
    }

    /**
     * Handle map loaded event
     * Sets up style change listeners and calls parent implementation
     * @override
     */
    onMapLoaded() {
        // Call parent method to render style switcher
        super.onMapLoaded();

        // Listen for style changes to restore our custom features
        this.mapBoxGlJs.on('style.load', () => {
            this.debounceUpdateMap();
        });
    }

    /**
     * Enhanced cleanup with proper memory management
     * Cleans up all event listeners, popups, and data structures
     * @override
     */
    cleanUp() {
        // Clear all timeouts
        if (this.hoverCleanupTimeout) {
            clearTimeout(this.hoverCleanupTimeout);
            this.hoverCleanupTimeout = null;
        }
        if (this.mouseMoveDebounce) {
            clearTimeout(this.mouseMoveDebounce);
            this.mouseMoveDebounce = null;
        }

        // Hide popup first
        this._hideFeaturePopup();

        // Remove event listeners to prevent memory leaks
        this.removeFeatureInteractions();

        // Reset state
        this.hoveredFeatureId = null;

        // Call parent cleanup
        super.cleanUp();
    }

    /**
     * Get GeoJSON data from record's latitude and longitude fields
     * Converts separate lat/lng fields into a GeoJSON Point feature
     * @param {Object} record - The record object
     * @returns {Object} GeoJSON FeatureCollection
     * @override
     */
    getRecordGeoJsonData(record) {
        const { lngField, latField } = this.props.viewAttrs;

        if (!lngField || !latField) {
            throw new Error(
                'Latitude and longitude fields are not defined in view attributes. Please add lat and lng attributes to the view definition.'
            );
        }

        const longitude = record.data?.[lngField];
        const latitude = record.data?.[latField];

        // Check if we have valid coordinates
        if (
            longitude === null ||
            longitude === undefined ||
            latitude === null ||
            latitude === undefined ||
            isNaN(longitude) ||
            isNaN(latitude)
        ) {
            return null;
        }

        // Create a GeoJSON Point feature from lat/lng fields
        const title = this.props.viewAttrs.title || 'None';
        const recordId = record.resId || record.id;

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)],
                    },
                    properties: {
                        id: recordId,
                        name: title,
                        description: title,
                        // Include color properties if available
                        fillColor: record.data?.fillColor || null,
                        strokeColor: record.data?.strokeColor || null,
                    },
                },
            ],
        };
    }
}
