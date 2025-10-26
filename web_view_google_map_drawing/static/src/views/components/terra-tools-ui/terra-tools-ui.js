import { _t } from '@web/core/l10n/translation';
import { sprintf } from '@web/core/utils/strings';
import { useService } from '@web/core/utils/hooks';
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import {
    Component,
    useEffect,
    useState,
    useRef,
    onWillStart,
    onWillDestroy,
    onWillUpdateProps,
} from '@odoo/owl';
import {
    loadTerraDrawAssets,
    loadTurfJS,
    generateUUID, 
    normalizeCoordinates,
    TERRA_DRAW_CONFIG,
    getRandomColor,
} from '../../../utils/terra_draw_utils';
import { analyzeFeaturePerformance, createEditableFeature } from '../../../utils/geometry_performance_utils';


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

/**
 * Terra Draw Tools UI Component
 * 
 * Provides an interactive drawing interface using Terra Draw library integrated with Google Maps.
 * 
 * Core Features:
 * - Drawing tools: Point, LineString, Polygon, Rectangle, Circle, Freehand
 * - Feature selection and editing with performance optimization
 * - Undo/redo functionality with history management
 * - Keyboard shortcuts for efficient operation
 * - Asynchronous feature processing to prevent UI blocking
 * - Complex geometry handling with simplification options
 * 
 * Performance Enhancements:
 * - Chunked processing of large feature sets (50 features per chunk)
 * - Feature complexity analysis and performance warnings
 * - Automatic simplification for extremely complex features
 * - Memory-efficient cleanup on component destruction
 * 
 * @extends Component
 */
export class TerraDrawToolsUI extends Component {
    static template = 'web_view_google_map_drawing.TerraToolsUI';
    static props = {
        googleMap: Object,
        saveFeatures: Function,
        dataGeoJson: { type: Object, optional: true, default: null },
        record: Object,
    };

    setup() {
        this.notificationService = useService('notification');
        this.dialogService = useService('dialog');
        this.uiService = useService('ui');
        this.toolsUiRef = useRef('toolUiRef');
        this.state = useState({
            currentMode: null,
            activeButton: null,
            selectedFeatureId: null,
            isRestoring: null,
            resizingEnabled: null,
            isSaving: null,
        });

        this.history = [];
        this.redoHistory = [];
        this.terraDrawInstance = null;
        this.debounceTimeout = null;
        this.latLngBounds = null;
        this.eventProjectionChanges = null;
        this.initTimeout = null;

        useEffect(() => {
            this.handleKeydown = this._handleKeyboardShortcuts.bind(this);
            document.addEventListener('keydown', this.handleKeydown);

            return () => {
                if (this.handleKeydown) {
                    document.removeEventListener('keydown', this.handleKeydown);
                }
            };
        });

        onWillStart(async () => {
            try {
                await loadTerraDrawAssets();
                await loadTurfJS();
            } catch (error) {
                console.error('Failed to load Terra Draw assets:', error);
                this.notificationService.add(
                    _t('Failed to load Terra Draw assets. Please check javascript console for more information'),
                    { type: 'danger', title: _t('Error'), }
                );
            }
        });

        onWillDestroy(() => this._cleanUp());

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
                            { type: 'danger' }
                        );
                    });
                }
            },
            () => [this.props.googleMap, this.toolsUiRef]
        );
    }

    /**
     * Load existing GeoJSON features into the Terra Draw instance with performance optimization
     * @param {Object} geoJson - GeoJSON object containing features to load
     * @param {Array} geoJson.features - Array of GeoJSON features
     * @returns {Promise<void>}
     * @private
     */
    async loadRecordData(geoJson) {
        if (this._loadingData) {
            console.warn('loadRecordData already in progress, skipping...');
            return;
        }
        if (!geoJson?.features || !Array.isArray(geoJson.features)) {
            console.warn('Invalid GeoJSON data provided', { geoJson });
            return; // nothing to load
        }

        if (!this.terraDrawInstance) {
            console.warn('TerraDraw instance not initialized yet');
            return;
        }

        this._loadingData = true;

        try {
            // Clear existing features before loading new ones
            if (this.terraDrawInstance.hasFeature()) {
                this.terraDrawInstance.clear();
            }
            this.state.isRestoring = true;

            const geometryToMode = {
                'Point': 'point',
                'LineString': 'linestring',
                'Polygon': 'polygon',
                'MultiPolygon': 'polygon'
            };

            // Process features asynchronously to prevent UI blocking
            const features = await this._processGeoJsonFeaturesAsync(geoJson.features, geometryToMode);

            // Add features to Terra Draw
            if (features.length > 0) {
                this.terraDrawInstance.addFeatures(features);
            }

            this.setSelectedFeatureId(null);
            await new Promise(resolve => setTimeout(resolve, TERRA_DRAW_CONFIG.RESTORE_DELAY));

            // Fit map to bounds of loaded features
            this._fitMapToBounds(geoJson.features);
        } catch (error) {
            console.error('Failed to load existing features:', error);
            this.notificationService.add(_t('Failed to load existing features'), { type: 'danger' });
        } finally {
            this.state.isRestoring = false;
            this._loadingData = false;
        }
    }

    /**
     * Process GeoJSON features asynchronously to prevent UI blocking
     * @param {Array} geoJsonFeatures - Array of GeoJSON features to process
     * @param {Object} geometryToMode - Mapping of geometry types to Terra Draw modes
     * @returns {Promise<Array>} Promise resolving to processed features array
     * @private
     */
    async _processGeoJsonFeaturesAsync(geoJsonFeatures, geometryToMode) {
        const CHUNK_SIZE = 50; // Process 50 features at a time
        const processedFeatures = [];
        
        for (let i = 0; i < geoJsonFeatures.length; i += CHUNK_SIZE) {
            const chunk = geoJsonFeatures.slice(i, i + CHUNK_SIZE);
            
            const chunkResults = chunk.map((feature) => {
                const plainFeature = JSON.parse(JSON.stringify(feature));

                // Terra Draw doesn't support polygons with holes (interior rings)
                const isPolygonWithHoles = plainFeature.geometry.type === 'Polygon' &&
                                          plainFeature.geometry.coordinates.length > 1;
                const isMultiPolygon = plainFeature.geometry.type === 'MultiPolygon';

                if (isPolygonWithHoles) {
                    return null; // Skip - will be rendered by DeckGL
                }

                if (isMultiPolygon) {
                    const multiPolygonFeatures = [];
                    plainFeature.geometry.coordinates.forEach((_polygonCoords) => {
                        if (_polygonCoords.length > 1) return; // Skip parts with holes

                        const polygonCoords = normalizeCoordinates(_polygonCoords, TERRA_DRAW_CONFIG.COORDINATE_PRECISION);
                        multiPolygonFeatures.push({
                            type: 'Feature',
                            id: generateUUID(),
                            geometry: { type: 'Polygon', coordinates: polygonCoords },
                            properties: { mode: 'polygon' }
                        });
                    });
                    return multiPolygonFeatures;
                } else {
                    if (!plainFeature.id || typeof plainFeature.id !== 'string') {
                        plainFeature.id = generateUUID();
                    }

                    plainFeature.geometry.coordinates = normalizeCoordinates(
                        plainFeature.geometry.coordinates,
                        TERRA_DRAW_CONFIG.COORDINATE_PRECISION
                    );

                    plainFeature.properties = { mode: geometryToMode[plainFeature.geometry.type] };
                    return plainFeature;
                }
            }).filter(Boolean); // Remove null values
            
            // Flatten array in case of MultiPolygon features
            const flattenedChunk = chunkResults.flat();
            processedFeatures.push(...flattenedChunk);
            
            // Yield control to prevent UI blocking (only if more chunks to process)
            if (i + CHUNK_SIZE < geoJsonFeatures.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        return processedFeatures;
    }

    /**
     * Analyze a set of features for performance characteristics
     * @param {Array} features - Array of GeoJSON features
     * @returns {Object} Performance analysis report
     * @private
     */
    /**
     * Check if feature can be safely edited and show warning if complex
     * @param {Object} feature - Feature to check
     * @returns {boolean} True if editing should proceed
     * @private
     */
    _checkEditingPerformance(feature) {
        const analysis = analyzeFeaturePerformance(feature);

        // Show warning for very complex and extremely complex features
        if (analysis.complexity === 'very_complex' || analysis.complexity === 'extremely_complex') {
            this.notificationService.add(
                _t('⚠️ Complex feature detected (%s vertices). Click the simplify button to improve editing performance.', analysis.vertexCount),
                { type: 'warning' }
            );
        } else if (analysis.complexity === 'complex') {
            this.notificationService.add(
                _t('Complex feature (%s vertices). Use the simplify button if editing is slow.', analysis.vertexCount),
                { type: 'info' }
            );
        }

        return analysis.canEdit;
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
                    this._actionSaveManually();
                    break;
                
                case 'e':
                    // Ctrl+E or Cmd+E - Simplify selected feature for editing
                    event.preventDefault();
                    this.simplifySelectedFeature();
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
                _t('Terra Draw is not initialized properly'),
                { type: 'danger' }
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
                _t('Terra Draw is not initialized properly'),
                { type: 'danger' }
            );
            return;
        }
        const action = ev.currentTarget.id;
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
        } else if (action === 'simplify-feature-button') {
            this.simplifySelectedFeature();
        } else if (action === 'save-button') {
            this._actionSaveManually();
        }
    }

    /**
     * Manually save changes to features
     * Triggers immediate save without debounce
     * @private
     */
    async _actionSaveManually() {
        try {
            await this._saveChanges();
        } catch (error) {
            console.error('Manual save failed:', error);
            this.notificationService.add(
                sprintf(_t('Failed to save changes: %s'), error.message),
                { title: _t('Error'), type: 'danger' }
            );
        }
    }

    calculateArea(feature) {
        if (!feature || !feature.geometry || !window.turf) return 0;

        const { coordinates } = feature.geometry;
        try {
            const polygon = turf.polygon(coordinates);
            return turf.area(polygon); // in square meters
        } catch (error) {
            console.error('turf.area failed', error);
        }
    }

    calculateFeaturesTotalArea(features) {
        let totalArea = 0;
        if (!features || !Array.isArray(features) || features.length === 0) {
            return totalArea;
        }
        features.forEach(feature => {
            if (['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
                const area = this.calculateArea(feature);
                if (!isNaN(area)) {
                    totalArea += area;
                }
            }
        });
        return totalArea; // in square meters
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
            } else {
                // Delete last feature as fallback
                const features = this.terraDrawInstance.getSnapshot();
                const nonSystemFeatures = features.filter(f => 
                    !f.properties?.midPoint && !f.properties?.selectionPoint
                );
                
                if (nonSystemFeatures.length > 0) {
                    const lastFeature = nonSystemFeatures[nonSystemFeatures.length - 1];
                    this.terraDrawInstance.removeFeatures([lastFeature.id]);
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
                if (this.props.dataGeoJson && this.props.dataGeoJson.features && this.props.dataGeoJson.features.length > 0) {
                    this.loadRecordData(this.props.dataGeoJson);
                } else {
                    console.warn('⚠️ No dataGeoJson available on Terra Draw ready event');
                }
                this.setActiveMode('select-mode');
                this.terraDrawInstance.on('select', this.onDrawSelect.bind(this));
                this.terraDrawInstance.on('deselect', this.onDrawDeselect.bind(this));
                this.history.push(
                    this._actionProcessSnapshotForUndo(this.terraDrawInstance.getSnapshot())
                ); // push initial empty state
                this.terraDrawInstance.on('change', this.onDrawChange.bind(this));
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
     * Simplify the currently selected feature for better performance
     * @public
     */
    async simplifySelectedFeature() {
        if (!this.state.selectedFeatureId || !this.terraDrawInstance) {
            this.notificationService.add(
                _t('No feature selected for simplification'),
                { type: 'warning' }
            );
            return;
        }

        try {
            const features = this.terraDrawInstance.getSnapshot();
            const selectedFeature = features.find(f => f.id === this.state.selectedFeatureId);

            if (!selectedFeature) {
                this.notificationService.add(
                    _t('Selected feature not found'),
                    { type: 'error' }
                );
                return;
            }

            const analysis = analyzeFeaturePerformance(selectedFeature);
            const originalVertexCount = analysis.vertexCount;
            const complexity = analysis.complexity;

            // Check if simplification is needed based on complexity
            if (complexity === 'simple' || complexity === 'moderate') {
                this.notificationService.add(
                    sprintf(_t('Feature is already simple enough for editing (%s vertices, complexity: %s)'), originalVertexCount, complexity),
                    { type: 'info' }
                );
                return;
            }

            // Show different messages based on complexity level
            const complexityMessages = {
                'complex': _t('Simplifying complex feature with %s vertices...', originalVertexCount),
                'very_complex': _t('Simplifying very complex feature with %s vertices. This may take a moment...', originalVertexCount),
                'extremely_complex': _t('Simplifying extremely complex feature with %s vertices. Please wait...', originalVertexCount)
            };

            this.notificationService.add(
                complexityMessages[complexity] || _t('Simplifying feature...'),
                { title: 'Processing', type: 'info' }
            );

            const editableResult = createEditableFeature(selectedFeature);

            if (editableResult && editableResult.isSimplified) {
                const simplifiedFeature = editableResult.feature;

                // Replace the original feature with the simplified version
                this.terraDrawInstance.removeFeatures([this.state.selectedFeatureId]);
                this.terraDrawInstance.addFeatures([simplifiedFeature]);

                // Update selection to the new feature
                setTimeout(() => {
                    if (simplifiedFeature.id) {
                        this.terraDrawInstance.selectFeature(simplifiedFeature.id);
                        this.setSelectedFeatureId(simplifiedFeature.id);
                    }
                }, 100);

                const iterationsInfo = editableResult.iterations ? ` in ${editableResult.iterations} iteration(s)` : '';
                const successMessage = sprintf(_t('Feature simplified successfully %s! Complexity: %s. Vertex reduction: %s % (%s → %s vertices)'),
                    iterationsInfo,
                    complexity,
                    editableResult.reductionRatio.toFixed(1),
                    editableResult.originalVertexCount,
                    editableResult.simplifiedVertexCount
                );

                this.notificationService.add(successMessage, { type: 'success' });
            } else {
                this.notificationService.add(
                    sprintf(_t('Could not simplify feature. Complexity: %s (%s vertices). Feature may already be at minimum complexity.'), complexity, originalVertexCount),
                    { type: 'info' }
                );
            }

        } catch (error) {
            console.error('Error simplifying feature:', error);
            this.notificationService.add(
                sprintf(_t('Failed to simplify feature: %s'), error.message),
                { title: 'Error', type: 'danger' }
            );
        }
    }

    /**
     * Handle Terra Draw feature selection events with performance checking and gating
     * @param {string} id - ID of the selected feature
     * @private
     */
    async onDrawSelect(id) {
        try {
            this.uiService.block();
            // STEP 1: Get feature data BEFORE selection
            const features = this.terraDrawInstance.getSnapshot();
            const targetFeature = features.find(f => f.id === id);
            
            if (!targetFeature) {
                console.warn('Feature not found for selection:', id);
                return;
            }
            
            // STEP 2: Analyze performance BEFORE selecting with error handling
            let analysis;
            try {
                analysis = analyzeFeaturePerformance(targetFeature);
                
                // Validate that analysis has required properties
                if (!analysis || typeof analysis.vertexCount !== 'number') {
                    console.warn('Invalid analysis result, using fallback:', analysis);
                    analysis = {
                        vertexCount: 0,
                        complexity: 'simple',
                        canEdit: true,
                        isVeryComplex: false,
                        recommendedAction: 'normal_operation'
                    };
                }
            } catch (analysisError) {
                console.error('Error analyzing feature performance:', analysisError);
                // Use safe fallback analysis
                analysis = {
                    vertexCount: 0,
                    complexity: 'simple',
                    canEdit: true,
                    isVeryComplex: false,
                    recommendedAction: 'normal_operation'
                };
            }

            // STEP 3: Prevent selection of features that would crash the browser
            if (analysis.isVeryComplex && this.state.selectedFeatureId !== id) {
                setTimeout(() => {
                    this.manuallyDeselectFeature();
                }, 10);
                this._handleComplexFeatureSelection(id, analysis);
            } else {
                // STEP 4: Proceed with normal selection
                this.setSelectedFeatureId(id);
                
                // STEP 5: Show performance feedback to user
                this._checkEditingPerformance(targetFeature);
            }

        } catch (error) {
            this.setSelectedFeatureId(null);
            this.setActiveMode('select-mode');
            console.error('Error in onDrawSelect:', error);
            this.notificationService.add(
                _t('Failed to select feature due to complexity'),
                { type: 'danger' }
            );
        } finally {
            this.uiService.unblock();
        }
    }

    /**
     * Handle selection of extremely complex features with performance safeguards
     * @private
     * @param {string} id - Feature ID
     * @param {Object} feature - GeoJSON feature
     * @param {Object} analysis - Feature complexity analysis
     */
    async _handleComplexFeatureSelection(id, analysis) {
        this.dialogService.add(ConfirmationDialog, {
            title: _t("⚠️ Very Complex Feature"),
            body: sprintf(_t('This feature has %s vertices and may cause performance issues.\nWould you like to simplify it for better editing performance?'), analysis.vertexCount),
            confirmLabel: _t("Yes, simplify the feature"),
            cancelLabel: _t("No, keep original"),
            confirm: async () => {
                this.setSelectedFeatureId(id);
                this.simplifySelectedFeature();
            },
            cancel: () => {
                this.setSelectedFeatureId(id);
                this.terraDrawInstance.selectFeature(id);
            },
            dismiss: () => {
                this.setSelectedFeatureId(id);
                this.terraDrawInstance.selectFeature(id);
            }
        });
    }

    /**
     * Handle Terra Draw feature deselection events
     * @private
     */
    onDrawDeselect() {
        this.setSelectedFeatureId(null);
    }

    manuallyDeselectFeature(id) {
        if (this.terraDrawInstance) {
            this.setActiveMode('select-mode');
            this.terraDrawInstance.deselectFeature(id);
            this.setSelectedFeatureId(null);
        }
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

    async _saveChanges() {
        try {
            this.state.isSaving = true;

            this.uiService.block();
            this.setActiveMode('select-mode'); // Switch to select mode before saving

            const snapshot = this.terraDrawInstance.getSnapshot();
            const geoJson = {
                type: 'FeatureCollection',
                features: snapshot,
            };

            const totalArea = this.calculateFeaturesTotalArea(snapshot);
            await this.props.saveFeatures(geoJson, totalArea);
            this._fitMapToBounds(snapshot);
        } catch (error) {
            console.error('Save failed:', error);
            this.notificationService.add(
                sprintf(_t('Failed to save changes: %s'), error.message), 
                { type: 'danger' }
            );
        } finally {
            this.state.isSaving = false;
            this.uiService.unblock();
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
                allowSelfIntersections: true, // Allow drawing polygons with overlapping/crossing lines
                styles: {
                    fillColor: color,
                    outlineColor: color,
                    outLineWidth: 0.1,
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
     * 
     * Performs comprehensive cleanup of manually managed resources:
     * - Clears pending timeouts to prevent execution after component destruction
     * - Removes document and Google Maps event listeners to prevent memory leaks
     * - Stops Terra Draw instance and removes all its event listeners
     * - Clears history arrays and object references
     * 
     * Note: OWL useState and component refs are automatically managed by the framework
     * and do not require manual cleanup.
     * 
     * @private
     */
    _cleanUp() {
        // Clear any pending timeouts first
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }
        
        if (this.initTimeout) {
            clearTimeout(this.initTimeout);
            this.initTimeout = null;
        }
        
        // Remove keyboard event listener
        if (this.handleKeydown) {
            document.removeEventListener('keydown', this.handleKeydown);
            this.handleKeydown = null;
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
                
                // Clear all features and stop the instance
                this.terraDrawInstance.clear();
                this.terraDrawInstance.stop();
            } catch (error) {
                console.warn('Error cleaning up TerraDraw instance:', error);
            }
            this.terraDrawInstance = null;
        }
        
        // Clear history arrays
        if (this.history) {
            this.history.length = 0;
        }
        if (this.redoHistory) {
            this.redoHistory.length = 0;
        }
        
        // Clear bounds
        this.latLngBounds = null;
    }
}
