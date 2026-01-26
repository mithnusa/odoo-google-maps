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
import { loadDeckGlAssets, validateGeoJson, calculateFeaturesTotalArea, hasGeoJsonChanged } from '../../../utils/utils';
import { DECKGL_CONFIG, STROKE_CONFIG } from '../../../utils/map_config';
import { UploadGeoJsonFileDialog } from '../upload_geojson_dialog/upload_geojson_dialog';


export class DeckGlEditor extends Component {
    static template = 'web_view_google_map_drawing.DeckGlEditor';
    static props = {
        readonly: Boolean,
        renderingMode: String,
        googleMap: Object,
        dataGeoJson: { type: Object, optional: true },
        saveFeatures: Function,
        record: Object,
        onSelectionChange: { type: Function, optional: true }, // Callback for selection changes
    };

    setup() {
        this.notificationService = useService('notification');
        this.dialogService = useService('dialog');
        this.uiService = useService('ui');
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

        this.debounceRenderGeoJsonData = debounce(this.renderGeoJsonData.bind(this), 500);

        onWillStart(async () => {
            await loadDeckGlAssets();
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

        onWillUpdateProps((nextProps) => {
            if (nextProps.dataGeoJson && this.deckglOverlay) {
                if (nextProps.renderingMode !== 'deckgl') {
                    console.debug('Rendering mode changed, skipping Deck.gl data render');
                    return;
                }
                const isGeoJsonChanged = hasGeoJsonChanged(this.props.dataGeoJson, nextProps.dataGeoJson);
                if (isGeoJsonChanged) {
                    this.debounceRenderGeoJsonData(nextProps.dataGeoJson);
                }
            }
        });
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

    renderGeoJsonData(geojson) {
        if (this.props.renderingMode !== 'deckgl') {
            console.warn('Rendering mode is not deckgl, skipping renderGeoJsonData');
            return;
        }
        this.uiService.block();
        try {
            const dataGeoJson = geojson || this.props.dataGeoJson;
            if (!this.deckglOverlay || !dataGeoJson || !dataGeoJson.features) {
                console.debug('Deck.gl overlay or GeoJSON data not available');
                this.uiService.unblock();
                return;
            }

            // Ensure all features have unique IDs
            dataGeoJson.features.forEach((feature, index) => {
                if (!feature.properties) feature.properties = {};
                if (!feature.properties.id) {
                    feature.properties.id = `feature_${index}`;
                }
            });

            const polygons = dataGeoJson.features.filter(f => ['Polygon', 'MultiPolygon'].includes(f.geometry.type));
            const points = dataGeoJson.features.filter(f => ['Point', 'MultiPoint'].includes(f.geometry.type));
            const lines = dataGeoJson.features.filter(f => ['LineString', 'MultiLineString'].includes(f.geometry.type));

            const color = generateColor();
            const normalFillColor = hexToRgba(color, 0.4, DECKGL_CONFIG.DEFAULT_COLORS.FILL);
            const normalStrokeColor = hexToRgba(color, 1.0, DECKGL_CONFIG.DEFAULT_COLORS.FILL);

            const layers = [
                // Polygon layer for filled shapes
                new window.deck.GeoJsonLayer({
                    id: 'polygonsLayer',
                    data: polygons,
                    filled: true,
                    stroked: true,
                    wrapLongitude: true,
                    getFillColor: () => DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_FILL,
                    getLineColor: () => DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_STROKE,
                    getLineWidth: () => STROKE_CONFIG.DEFAULT_WIDTH,
                    lineWidthMinPixels: STROKE_CONFIG.DEFAULT_WIDTH,
                    lineWidthMaxPixels: STROKE_CONFIG.HOVER_WIDTH,
                    pickable: true,
                    autoHighlight: true,
                    highlightColor: DECKGL_CONFIG.DEFAULT_COLORS.HOVERED_FILL,
                }),

                // Line layer for LineString geometries
                new window.deck.GeoJsonLayer({
                    id: 'linesLayer',
                    data: lines,
                    filled: false,
                    stroked: true,
                    wrapLongitude: true,
                    getLineColor: () => DECKGL_CONFIG.DEFAULT_COLORS.SELECTED_STROKE,
                    getLineWidth: () => 3,
                    lineWidthUnits: 'pixels',
                    lineWidthMinPixels: 3,
                    lineWidthMaxPixels: 8,
                    pickable: true,
                    autoHighlight: true,
                    highlightColor: DECKGL_CONFIG.DEFAULT_COLORS.HOVERED_STROKE,
                }),

                // ScatterplotLayer for point features
                new window.deck.ScatterplotLayer({
                    id: 'pointsLayer',
                    data: points.map(f => ({
                        ...f,
                        position: f.geometry.type === 'Point'
                            ? f.geometry.coordinates
                            : f.geometry.coordinates[0]
                    })),
                    getPosition: d => d.position,
                    getRadius: 6,
                    radiusUnits: 'pixels',
                    radiusMinPixels: 6,
                    radiusMaxPixels: 20,
                    stroked: true,
                    filled: true,
                    getFillColor: normalFillColor,
                    getLineColor: normalStrokeColor,
                    lineWidthMinPixels: 2,
                    lineWidthMaxPixels: 4,
                    pickable: true,
                    autoHighlight: true,
                    highlightColor: DECKGL_CONFIG.DEFAULT_COLORS.HOVERED_FILL,
                })
            ];

            this.deckglOverlay.setProps({ layers });
            this.centerMapToFeatures(dataGeoJson.features);
        } catch (error) {
            console.error('Error rendering GeoJSON data in Deck.gl overlay:', error);
        } finally {
            this.uiService.unblock();
        }
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

    /**
     * Computed property to check if there is data to export
     * @returns {boolean}
     */
    get hasDataToExport() {
        return this.props.dataGeoJson?.features?.length > 0;
    }

    /**
     * Handle Import button click - opens file upload dialog
     */
    onClickImport() {
        this.dialogService.add(UploadGeoJsonFileDialog, {
            confirm: (file) => this._processImportedFile(file),
            cancel: () => {},
        });
    }

    /**
     * Process the imported GeoJSON file
     * @param {File} file - The uploaded file
     * @returns {Promise<boolean>} - Success status
     * @private
     */
    async _processImportedFile(file) {
        if (!file) {
            this.notificationService.add(_t('No file was uploaded.'), { type: 'danger' });
            return false;
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const geojson = JSON.parse(e.target.result);
                    const isValid = validateGeoJson(geojson, {
                        requireFeatures: true,
                        validateGeometry: true,
                        strict: false,
                    });
                    if (!isValid) {
                        this.notificationService.add(
                            _t('The imported file is not a valid GeoJSON.'),
                            { type: 'danger' }
                        );
                        resolve(false);
                        return;
                    }
                    // Update the data and re-render
                    this.notificationService.add(
                        _t('GeoJSON file imported successfully.'),
                        { type: 'success' }
                    );
                    const totalArea = calculateFeaturesTotalArea(geojson.features);
                    await this.props.saveFeatures(geojson, totalArea);
                    resolve(true);
                } catch (error) {
                    console.error('Error parsing imported GeoJSON file:', error);
                    this.notificationService.add(
                        _t('Failed to parse the imported GeoJSON file.'),
                        { type: 'danger' }
                    );
                    resolve(false);
                }
            };
            reader.onerror = () => {
                this.notificationService.add(
                    _t('Failed to read the imported GeoJSON file.'),
                    { type: 'danger' }
                );
                resolve(false);
            };
            reader.readAsText(file);
        });
    }

    /**
     * Handle Export button click - downloads current GeoJSON data
     */
    onClickExport() {
        if (!this.hasDataToExport) {
            this.notificationService.add(_t('No data available to export.'), { type: 'warning' });
            return;
        }

        try {
            // Create clean GeoJSON export
            const exportData = {
                type: 'FeatureCollection',
                features: this.props.dataGeoJson.features.map((feature) => ({
                    type: 'Feature',
                    geometry: feature.geometry,
                    properties: this._cleanPropertiesForExport(feature.properties || {}),
                })),
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/geo+json' });
            const url = URL.createObjectURL(blob);

            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `geojson_export_${timestamp}.geojson`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.notificationService.add(_t('GeoJSON exported successfully.'), { type: 'success' });
        } catch (error) {
            console.error('Error exporting GeoJSON:', error);
            this.notificationService.add(_t('Failed to export GeoJSON file.'), { type: 'danger' });
        }
    }

    /**
     * Clean properties for export - remove internal/transient properties
     * @param {Object} properties - Feature properties
     * @returns {Object} Cleaned properties
     * @private
     */
    _cleanPropertiesForExport(properties) {
        const cleanProps = { ...properties };
        // Remove internal properties that should not be exported
        const internalProps = ['mode', 'midPoint', 'selectionPoint', '_metadata'];
        internalProps.forEach((prop) => delete cleanProps[prop]);
        return cleanProps;
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