import { _t } from '@web/core/l10n/translation';
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
import { hexToRgba, generateColor } from '@web_view_google_map/views/google_map/utils';
import { loadDeckGlAssets } from '../../../utils/utils';


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
        SELECTED_FILL: [255, 215, 0, 120], // Gold with transparency
        SELECTED_STROKE: [255, 140, 0, 255], // Dark orange
    },

    // Interactive features
    HOVER_RADIUS: 10, // Pixels for hover detection
    SELECT_RADIUS: 15, // Pixels for selection detection
    ANIMATION_DURATION: 300, // Milliseconds for smooth transitions
};

/**
 * Enable debug mode to see the flag canvas
 * @type {boolean}
 */
window.DEBUG_DECKGL = true;

/**
 * Create icon atlas and mapping for Deck.gl IconLayer
 */
const createIconAtlas = () => {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, size, size);
    
    // Create a simple flag icon on canvas
    ctx.fillStyle = '#dc3545'; // Red flag
    ctx.strokeStyle = '#2d3748'; // Dark pole
    ctx.lineWidth = 3;

    // Draw flag pole
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(12, 56);
    ctx.stroke();
    
    // Draw flag
    ctx.fillStyle = '#dc3545';
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(48, 16);
    ctx.lineTo(40, 28);
    ctx.lineTo(48, 40);
    ctx.lineTo(12, 32);
    ctx.closePath();
    ctx.fill();
    
    // Add border to flag
    ctx.strokeStyle = '#721c24';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw pole base
    ctx.fillStyle = '#2d3748';
    ctx.beginPath();
    ctx.arc(12, 56, 4, 0, 2 * Math.PI);
    ctx.fill();

    return canvas;
};

/**
 * Icon mapping for Deck.gl IconLayer
 */
const ICON_MAPPING = {
    flag: {
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        anchorY: 56, // Anchor at the bottom of the pole
        anchorX: 12, // Anchor at the pole center
        mask: false
    }
};


export class DeckGlEditor extends Component {
    static template = 'web_view_google_map_drawing.DeckGlEditor';
    static props = {
        googleMap: Object,
        dataGeoJson: { type: Object, optional: true },
        record: Object,
        onSelectionChange: { type: Function, optional: true }, // Callback for selection changes
    };

    setup() {
        this.notificationService = useService('notification');
        this.editorRef = useRef('editor');
        this.googleMapBounds = null;
        this.deckglOverlay = null;

        // Selection state management - make reactive for template
        this.state = useState({
            selectedFeatures: new Set(), // Track selected feature IDs
            hoveredFeatureId: null, // Track hovered feature
        });
        
        // Drag state management
        this.isDragging = false;
        this.dragStartPosition = null;
        this.dragFeatureIds = new Set();
        
        // Icon atlas for flag markers
        this.iconAtlas = null;
        
        this.debounceRenderGeoJsonData = debounce(this.renderGeoJsonData.bind(this), 500);

        onWillStart(async () => {
            await this._loadDeckGLAssets();
            this._createIconAtlas();
        });

        useEffect(
            (editorRef, googleMap) => {
                if (editorRef.el && googleMap) {
                    this._initializeDeckGLOverlay();
                }
            },
            () => [this.editorRef, this.props.googleMap],
        );

        onWillDestroy(() => this._cleanUp());

        onWillUpdateProps(() => {
            if (this.props.dataGeoJson && this.deckglOverlay) {
                this.debounceRenderGeoJsonData();
            }
        });
    }


    /**
     * Load Deck.gl and Nebula GL assets and dependencies
     * @private
     */
    async _loadDeckGLAssets() {
        loadDeckGlAssets();
    }

    /**
     * Create icon atlas for flag markers
     * @private
     */
    _createIconAtlas() {
        try {
            this.iconAtlas = createIconAtlas();
        } catch (error) {
            console.error('Failed to create icon atlas:', error);
            this.iconAtlas = null;
        }
    }
    
    async _initializeDeckGLOverlay() {
        if (!window.deck || !this.props.googleMap) {
            throw new Error('Deck.gl or Google Maps not available');
        }

        if (this.deckglOverlay) {
            console.warn('Deck.gl overlay already initialized');
            return;
        }

        try {
            this.deckglOverlay = new window.deck.GoogleMapsOverlay({
                layers: [],
                controller: true,
                onClick: (info) => this._onFeatureClick(info),
            });

            this.deckglOverlay.setMap(this.props.googleMap);

            // Initial data load
            this.debounceRenderGeoJsonData();

        } catch (error) {
            console.error('Failed to initialize Deck.gl overlay:', error);
            this.notificationService.add(
                _t('Failed to initialize high-performance renderer. Please refresh the page.'),
                { type: 'danger' }
            );
        }
    }

    /**
     * Handle feature selection on click
     * Supports single and multi-selection with Ctrl/Cmd key
     */
    _onFeatureClick(info) {
        if (!info.object) {
            // Clicked on empty space - clear selection
            this.state.selectedFeatures.clear();
            this._updateLayerStyling();
            return;
        }

        const feature = info.object;
        const featureId = feature.properties?.id || feature.id || `feature_${Date.now()}`;
        
        // Add unique ID to feature if it doesn't have one
        if (!feature.properties) feature.properties = {};
        if (!feature.properties.id) feature.properties.id = featureId;

        // Check if Ctrl/Cmd is held for multi-selection
        const isMultiSelect = info.srcEvent && (info.srcEvent.ctrlKey || info.srcEvent.metaKey);
        
        if (isMultiSelect) {
            // Multi-selection: toggle the feature
            if (this.state.selectedFeatures.has(featureId)) {
                this.state.selectedFeatures.delete(featureId);
            } else {
                this.state.selectedFeatures.add(featureId);
            }
        } else {
            // Single selection: select only this feature
            this.state.selectedFeatures.clear();
            this.state.selectedFeatures.add(featureId);
        }
        // Update visual styling to reflect selection
        this._updateLayerStyling();
        
        // Emit selection change event (if needed by parent components)
        this._notifySelectionChange();
    }

    /**
     * Update layer styling based on selection and hover state
     */
    _updateLayerStyling() {
        if (!this.deckglOverlay) return;
        
        // Re-render with updated styling
        this.renderGeoJsonData();
    }

    /**
     * Notify parent components of selection changes
     */
    _notifySelectionChange() {
        const selectedFeatureIds = Array.from(this.state.selectedFeatures);
        
        // If parent needs to know about selection changes
        if (this.props.onSelectionChange) {
            this.props.onSelectionChange(selectedFeatureIds);
        }
    }

    /**
     * Translate (move) features by the specified delta
     */
    _translateFeatures(featureIds, deltaX, deltaY) {
        if (!this.props.dataGeoJson?.features) return;

        this.props.dataGeoJson.features.forEach(feature => {
            if (!featureIds.has(feature.properties?.id)) return;

            const geometry = feature.geometry;
            
            switch (geometry.type) {
                case 'Point':
                    geometry.coordinates[0] += deltaX;
                    geometry.coordinates[1] += deltaY;
                    break;

                case 'MultiPoint':
                case 'LineString':
                    geometry.coordinates.forEach(coord => {
                        coord[0] += deltaX;
                        coord[1] += deltaY;
                    });
                    break;

                case 'MultiLineString':
                case 'Polygon':
                    geometry.coordinates.forEach(ring => {
                        ring.forEach(coord => {
                            coord[0] += deltaX;
                            coord[1] += deltaY;
                        });
                    });
                    break;

                case 'MultiPolygon':
                    geometry.coordinates.forEach(polygon => {
                        polygon.forEach(ring => {
                            ring.forEach(coord => {
                                coord[0] += deltaX;
                                coord[1] += deltaY;
                            });
                        });
                    });
                    break;

                default:
                    console.warn('Unsupported geometry type for translation:', geometry.type);
            }
        });
    }

    renderGeoJsonData() {
        if (!this.deckglOverlay || !this.props.dataGeoJson || !this.props.dataGeoJson.features) {
            console.log('Deck.gl overlay or GeoJSON data not available');
            return;
        }
        
        // Ensure all features have unique IDs
        this.props.dataGeoJson.features.forEach((feature, index) => {
            if (!feature.properties) feature.properties = {};
            if (!feature.properties.id) {
                feature.properties.id = `feature_${index}`;
            }
        });

        const polygons = this.props.dataGeoJson.features.filter(f => ['Polygon', 'MultiPolygon'].includes(f.geometry.type));
        const points = this.props.dataGeoJson.features.filter(f => ['Point', 'MultiPoint'].includes(f.geometry.type));
        const lines = this.props.dataGeoJson.features.filter(f => ['LineString', 'MultiLineString'].includes(f.geometry.type));

        const color = generateColor();
        const normalFillColor = hexToRgba(color, 0.4, DECKGL_CONFIG.DEFAULT_COLORS.FILL);
        const normalStrokeColor = hexToRgba(color, 1.0, DECKGL_CONFIG.DEFAULT_COLORS.FILL);

        const layers = [
            // Polygon layer for filled shapes
            new window.deck.GeoJsonLayer({
                id: 'polygonsLayer',
                data: polygons,
                stroked: true,
                filled: true,
                lineWidthMinPixels: 2,
                opacity: 0.8,
                pickable: true,
                autoHighlight: false, // We handle highlighting manually
                
                // Dynamic styling based on selection/hover state
                getFillColor: d => this._getFeatureFillColor(d, normalFillColor),
                getLineColor: d => this._getFeatureStrokeColor(d, normalStrokeColor),
                getLineWidth: d => this._getFeatureLineWidth(d, 2),
                
                // Update triggers for re-rendering when selection changes
                updateTriggers: {
                    getFillColor: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                    getLineColor: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                    getLineWidth: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                }
            }),

            // Line layer for LineString geometries
            new window.deck.GeoJsonLayer({
                id: 'linesLayer',
                data: lines,
                filled: false,
                stroked: true,
                pickable: true,
                autoHighlight: false, // We handle highlighting manually
                lineWidthMinPixels: 2,
                
                // Dynamic styling
                getLineColor: d => this._getFeatureStrokeColor(d, normalStrokeColor),
                getLineWidth: d => this._getFeatureLineWidth(d, 3),
                
                // Update triggers
                updateTriggers: {
                    getLineColor: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                    getLineWidth: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                }
            }),

            // Try IconLayer for flags, fallback to ScatterplotLayer if it fails
            this._createPointLayer(points, normalFillColor, normalStrokeColor)
        ];

        this.deckglOverlay.setProps({ layers });
        this.centerMapToFeatures(this.props.dataGeoJson.features);
    }

    /**
     * Create point layer - try IconLayer first, fallback to ScatterplotLayer
     * @private
     */
    _createPointLayer(points, normalFillColor, normalStrokeColor) {
        // Check if IconLayer is available and atlas is ready
        if (window.deck.IconLayer && this.iconAtlas) {
            try {
                return new window.deck.IconLayer({
                    id: 'pointsLayer',
                    data: points.map(f => ({
                        ...f,
                        position: f.geometry.type === 'Point'
                            ? f.geometry.coordinates
                            : f.geometry.coordinates[0],
                        icon: 'flag'
                    })),
                    iconAtlas: this.iconAtlas,
                    iconMapping: ICON_MAPPING,
                    getPosition: d => d.position,
                    getIcon: d => d.icon,
                    sizeScale: 1,
                    sizeMinPixels: 24,
                    sizeMaxPixels: 80,
                    pickable: true,
                    autoHighlight: false,
                    billboard: true,
                    alphaCutoff: 0.05,
                    
                    // Dynamic sizing based on state
                    getSize: d => this._getFeatureIconSize(d, 48),
                    getColor: d => this._getFeatureIconColor(d),
                    
                    // Update triggers
                    updateTriggers: {
                        getSize: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                        getColor: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                    }
                });
            } catch (error) {
                console.error('Failed to create IconLayer, falling back to ScatterplotLayer:', error);
            }
        }

        // Fallback to ScatterplotLayer
        return new window.deck.ScatterplotLayer({
            id: 'pointsLayer',
            data: points.map(f => ({
                ...f,
                position: f.geometry.type === 'Point'
                    ? f.geometry.coordinates
                    : f.geometry.coordinates[0]
            })),
            getPosition: d => d.position,
            radiusMinPixels: 8,
            radiusMaxPixels: 50,
            pickable: true,
            autoHighlight: false,
            
            // Dynamic styling
            getRadius: d => this._getFeatureIconSize(d, 15), // Reuse the same sizing logic
            getFillColor: d => this._getFeatureIconColor(d), // Reuse the same coloring logic
            getLineColor: d => this._getFeatureStrokeColor(d, normalStrokeColor),
            getLineWidth: d => this._getFeatureLineWidth(d, 2),
            
            // Update triggers
            updateTriggers: {
                getRadius: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                getFillColor: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                getLineColor: [this.state.selectedFeatures, this.state.hoveredFeatureId],
                getLineWidth: [this.state.selectedFeatures, this.state.hoveredFeatureId],
            }
        });
    }

    /**
     * Get dynamic fill color based on feature state
     */
    _getFeatureFillColor(feature, normalColor) {
        const featureId = feature.properties?.id;
        
        if (featureId === this.state.hoveredFeatureId) {
            // Hover state - bright yellow/gold
            return [255, 255, 0, 100];
        }
        
        if (this.state.selectedFeatures.has(featureId)) {
            // Selected state - gold with higher opacity
            return DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_FILL;
        }
        
        // Normal state
        return normalColor;
    }

    /**
     * Get dynamic stroke color based on feature state  
     */
    _getFeatureStrokeColor(feature, normalColor) {
        const featureId = feature.properties?.id;
        
        if (featureId === this.state.hoveredFeatureId) {
            // Hover state - bright orange
            return [255, 165, 0, 255];
        }
        
        if (this.state.selectedFeatures.has(featureId)) {
            // Selected state - dark orange
            return DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_STROKE;
        }
        
        // Normal state
        return normalColor;
    }

    /**
     * Get dynamic line width based on feature state
     */
    _getFeatureLineWidth(feature, normalWidth) {
        const featureId = feature.properties?.id;
        
        if (featureId === this.state.hoveredFeatureId) {
            // Hover state - thicker line
            return normalWidth + 2;
        }
        
        if (this.state.selectedFeatures.has(featureId)) {
            // Selected state - slightly thicker
            return normalWidth + 1;
        }
        
        // Normal state
        return normalWidth;
    }

    /**
     * Get dynamic icon size based on feature state
     */
    _getFeatureIconSize(feature, normalSize) {
        const featureId = feature.properties?.id;
        
        if (featureId === this.state.hoveredFeatureId) {
            // Hover state - larger icon
            return normalSize * 1.5;
        }
        
        if (this.state.selectedFeatures.has(featureId)) {
            // Selected state - slightly larger
            return normalSize * 1.2;
        }
        
        // Normal state
        return normalSize;
    }

    /**
     * Get dynamic icon color based on feature state
     */
    _getFeatureIconColor(feature) {
        const featureId = feature.properties?.id;
        
        if (featureId === this.state.hoveredFeatureId) {
            // Hover state - bright yellow/gold
            return [255, 215, 0, 255];
        }
        
        if (this.state.selectedFeatures.has(featureId)) {
            // Selected state - orange
            return [255, 140, 0, 255];
        }
        
        // Normal state - red flag
        return [220, 53, 69, 255];
    }

    async centerMapToFeatures(features) {
        if (!features || features.length === 0 || !this.props.googleMap) return;
        
        const { LatLngBounds } = await this.env.apiLoader.importLibrary('core');
        const bounds = new LatLngBounds();
        features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            this._extendBounds(bounds, feature.geometry.type, coords);
        });
        this.props.googleMap.fitBounds(bounds);
    }

    _extendBounds(bounds, type, coords) {
        switch (type) {
            case 'Point':
                bounds.extend(new google.maps.LatLng(coords[1], coords[0]));
                break;
            case 'MultiPoint':
            case 'LineString':
                coords.forEach(coord => {
                    bounds.extend(new google.maps.LatLng(coord[1], coord[0]));
                });
                break;
            case 'MultiLineString':
            case 'Polygon':
                coords.forEach(ring => {
                    ring.forEach(coord => {
                        bounds.extend(new google.maps.LatLng(coord[1], coord[0]));
                    });
                });
                break;
            case 'MultiPolygon':
                coords.forEach(polygon => {
                    polygon.forEach(ring => {
                        ring.forEach(coord => {
                            bounds.extend(new google.maps.LatLng(coord[1], coord[0]));
                        });
                    });
                });
                break;
            default:
                console.warn('Unsupported geometry type for bounds extension:', type);
        }
    }

    /**
     * Public API methods for parent components
     */
    
    /**
     * Clear all selections
     */
    clearSelection() {
        this.state.selectedFeatures.clear();
        this.state.hoveredFeatureId = null;
        this._updateLayerStyling();
        this._notifySelectionChange();
    }

    _cleanUp() {
        // Clear drag state
        this.isDragging = false;
        this.dragStartPosition = null;
        this.dragFeatureIds.clear();

        // Reset cursor
        document.body.style.cursor = '';

        if (this.deckglOverlay) {
            try {
                // Detach overlay from map
                this.deckglOverlay.setMap(null);
                // Finalize to clean up WebGL resources
                this.deckglOverlay.finalize();
            } catch (error) {
                console.error('Error during Deck.gl overlay cleanup:', error);
            } finally {
                this.deckglOverlay = null;
            }
        }
    }

}