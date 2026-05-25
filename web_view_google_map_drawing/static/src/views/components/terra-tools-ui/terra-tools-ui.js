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
import { generateUUID } from '@web_view_google_map/views/google_map/utils';
import {
    loadTerraDrawAssets,
    loadTurfJSAssets,
    normalizeCoordinates,
    TERRA_DRAW_CONFIG,
    getRandomColor,
    validateGeoJson,
    calculateFeaturesTotalArea,
    hasGeoJsonChanged,
} from '../../../utils/utils';
import { analyzeFeaturePerformance, createEditableFeature } from '../../../utils/geometry_performance_utils';
import { UploadGeoJsonFileDialog } from '../upload_geojson_dialog/upload_geojson_dialog';


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
        renderingMode: String,
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
            // Capture the bound handler in the closure so the cleanup removes
            // exactly this listener, not whatever this.handleKeydown points to
            // at cleanup time (which would be a different render's binding).
            const handler = this._handleKeyboardShortcuts.bind(this);
            this.handleKeydown = handler;
            document.addEventListener('keydown', handler);
            return () => document.removeEventListener('keydown', handler);
        }, () => []);

        onWillStart(async () => {
            try {
                await loadTerraDrawAssets();
                await loadTurfJSAssets();
            } catch (error) {
                console.error('Failed to load Terra Draw assets:', error);
                this.notificationService.add(
                    _t('Failed to load Terra Draw assets. Please check javascript console for more information'),
                    { type: 'danger' }
                );
            }
        });

        onWillDestroy(() => this._cleanUp());

        onWillUpdateProps((nextProps) => {
            if (!nextProps.googleMap || !this.terraDrawInstance || nextProps.renderingMode !== 'terra-draw') return;

            if (this.state.isRestoring || this.state.isSaving) return;

            const isGeoJsonChanged = hasGeoJsonChanged(this.props.dataGeoJson, nextProps.dataGeoJson);
            if (isGeoJsonChanged) {
                this.terraDrawInstance.clear();
                this.latLngBounds = null; // reset latLngBounds to recalculate
                this.loadRecordData(nextProps.dataGeoJson);
            }
        });

        useEffect(
            () => {
                if (this.props.googleMap && this.toolsUiRef.el && window.terraDraw && this.props.renderingMode === 'terra-draw') {
                    this.initTerraDraw().catch((error) => {
                        console.error('Failed to initialize Terra Draw:', error);
                        this.notificationService.add(
                            _t('Failed to initialize Terra Draw. Please check javascript console for more information'),
                            { type: 'danger' }
                        );
                    });
                }
            },
            () => [this.props.googleMap, this.toolsUiRef.el, this.props.renderingMode]
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

        if (this.props.renderingMode !== 'terra-draw') {
            console.warn('Current mode is not terra-draw, skipping loadRecordData');
            return;
        }

        if (!this.terraDrawInstance) {
            console.warn('TerraDraw instance not initialized yet');
            return;
        }

        this.uiService.block();

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

            // Build the history baseline from what Terra Draw actually stored.
            // getSnapshot() is preferred because Terra Draw may normalise IDs or
            // properties during addFeatures. If it returns empty (Terra Draw has
            // not yet processed the features, or silently rejected some), fall
            // back to the features array we already have — this guarantees the
            // baseline is never empty when features were loaded, which prevents
            // the first undo from wiping the map.
            const snapshot = this.terraDrawInstance.getSnapshot().filter(
                f => !f.properties?.midPoint && !f.properties?.selectionPoint
            );
            const baseline = snapshot.length > 0 ? snapshot : features;
            const getSnapshotForUndo = this._actionProcessSnapshotForUndo(baseline);
            this.history = [getSnapshotForUndo];
            this.redoHistory = [];
        } catch (error) {
            console.error('Failed to load existing features:', error);
            this.notificationService.add(_t('Failed to load existing features'), { type: 'danger' });
        } finally {
            this.state.isRestoring = false;
            this._loadingData = false;
            this.uiService.unblock();
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
                            properties: {
                                mode: 'polygon',
                                ...plainFeature.properties,
                            }
                        });
                    });
                    return multiPolygonFeatures;
                } else {
                    // Always generate a fresh UUID — the Google Maps adapter batches
                    // renders via RAF, so reusing an ID that was just deleted by
                    // clear() in the same RAF batch suppresses the create silently.
                    plainFeature.id = generateUUID();

                    plainFeature.geometry.coordinates = normalizeCoordinates(
                        plainFeature.geometry.coordinates,
                        TERRA_DRAW_CONFIG.COORDINATE_PRECISION
                    );

                    plainFeature.properties = {
                        mode: geometryToMode[plainFeature.geometry.type],
                        ...plainFeature.properties,
                    };
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
                sprintf(_t('⚠️ Complex feature detected (%s vertices). Click the simplify button to improve editing performance.'), analysis.vertexCount),
                { type: 'warning' }
            );
        } else if (analysis.complexity === 'complex') {
            this.notificationService.add(
                sprintf(_t('Complex feature (%s vertices). Use the simplify button if editing is slow.'), analysis.vertexCount),
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
                        state: metadata.state || metadata.name || _t('Unknown Region'),
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
            // Calculate bounds using simple min/max (much faster than creating LatLng objects)
            let minLat = Infinity, maxLat = -Infinity;
            let minLng = Infinity, maxLng = -Infinity;

            for (const feature of features) {
                this._updateBoundsFromCoordinates(feature.geometry, (lng, lat) => {
                    if (lat < minLat) minLat = lat;
                    if (lat > maxLat) maxLat = lat;
                    if (lng < minLng) minLng = lng;
                    if (lng > maxLng) maxLng = lng;
                });
            }

            // Only create LatLngBounds once with the final values
            if (minLat !== Infinity) {
                const { LatLngBounds } = await this.env.apiLoader.importLibrary('core');
                const bounds = new LatLngBounds(
                    { lat: minLat, lng: minLng },  // SW corner
                    { lat: maxLat, lng: maxLng }   // NE corner
                );
                this.props.googleMap.fitBounds(bounds);
            }
        } catch (error) {
            console.warn('Failed to fit map bounds:', error);
        }
    }

    /**
     * Iterate through all coordinates in a geometry and call callback
     * Optimized for large datasets - avoids creating intermediate objects
     * @param {Object} geometry - GeoJSON geometry object
     * @param {Function} callback - Function to call with (lng, lat) for each coordinate
     * @private
     */
    _updateBoundsFromCoordinates(geometry, callback) {
        const { type, coordinates } = geometry;

        switch (type) {
            case 'Point':
                callback(coordinates[0], coordinates[1]);
                break;
            case 'LineString':
            case 'MultiPoint':
                for (const coord of coordinates) {
                    callback(coord[0], coord[1]);
                }
                break;
            case 'Polygon':
            case 'MultiLineString':
                for (const ring of coordinates) {
                    for (const coord of ring) {
                        callback(coord[0], coord[1]);
                    }
                }
                break;
            case 'MultiPolygon':
                for (const polygon of coordinates) {
                    for (const ring of polygon) {
                        for (const coord of ring) {
                            callback(coord[0], coord[1]);
                        }
                    }
                }
                break;
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
        } else if (action === 'upload-button') {
            this._actionUploadGeoJSON();
        } else if (action === 'download-button') {
            this._actionDownloadGeoJSON();
        }
    }

    /**
     * Import GeoJSON data from a file
     * Opens a file dialog to select and upload a GeoJSON file
     * @private
     */
    _actionUploadGeoJSON() {
        this.dialogService.add(UploadGeoJsonFileDialog, {
            confirm: (file) => {
                if (!file) {
                    this.notificationService.add(
                        _t('No file was uploaded.'),
                        { type: 'danger' }
                    );
                    return false;
                }
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        try {
                            const geojson = JSON.parse(e.target.result);
                            const isValid = validateGeoJson(geojson, { requireFeatures: true, validateGeometry: true, strict: false });
                            if (!isValid) {
                                this.notificationService.add(
                                    _t('The imported file is not a valid GeoJSON.'),
                                    { type: 'danger' }
                                );
                                resolve(false);
                                return;
                            }
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
                    reader.onerror = (e) => {
                        console.error('Error reading imported GeoJSON file: ', e);
                        this.notificationService.add(
                            _t('Failed to read the imported GeoJSON file.'),
                            { type: 'danger' }
                        );
                        resolve(false);
                    };
                    reader.readAsText(file);
                });
            },
            cancel: () => {},
        });
    }

    /**
     * Download GeoJSON data as a file
     * Exports current Terra Draw features to a downloadable GeoJSON file
     * @private
     */
    _actionDownloadGeoJSON() {
        if (!this.terraDrawInstance) {
            this.notificationService.add(
                _t('Terra Draw is not initialized properly'),
                { type: 'danger' }
            );
            return;
        }

        const features = this.terraDrawInstance.getSnapshot();

        // Filter out system features (midpoints, selection points)
        const exportFeatures = features.filter(
            (f) => !f.properties?.midPoint && !f.properties?.selectionPoint
        );

        if (exportFeatures.length === 0) {
            this.notificationService.add(
                _t('No data available to export.'),
                { type: 'warning' }
            );
            return;
        }

        try {
            // Create clean GeoJSON export
            const exportData = {
                type: 'FeatureCollection',
                features: exportFeatures.map((feature) => ({
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

            this.notificationService.add(
                _t('GeoJSON exported successfully.'),
                { type: 'success' }
            );
        } catch (error) {
            console.error('Error exporting GeoJSON:', error);
            this.notificationService.add(
                _t('Failed to export GeoJSON file.'),
                { type: 'danger' }
            );
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
                { type: 'danger' }
            );
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
    async _actionUndo() {
        if (this.history.length <= 1) {
            this.notificationService.add(_t('Nothing to undo'), { type: 'info' });
            return;
        }

        // Cancel any pending debounce so it cannot push a stale pre-undo
        // snapshot after isRestoring resets, which would corrupt the redo stack.
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }

        try {
            this.redoHistory.push(this.history.pop());
            const snapshotToRestore = this.history[this.history.length - 1];

            await this._restoreSnapshot(snapshotToRestore);
            this.notificationService.add(_t('Undo completed'), { type: 'success' });
        } catch (error) {
            console.error('Error during undo:', error);
            this.notificationService.add(_t('Undo failed'), { type: 'danger' });
        }
    }

    /**
     * Redo the last undone action by restoring from redo history
     * Provides user feedback and moves state back to main history
     * @private
     */
    async _actionRedo() {
        if (this.redoHistory.length === 0) {
            this.notificationService.add(_t('Nothing to redo'), { type: 'info' });
            return;
        }

        // Same debounce cancellation as _actionUndo — prevents a stale pending
        // push from overwriting history after the restore settles.
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
            this.debounceTimeout = null;
        }

        try {
            const snapshotToRestore = this.redoHistory.pop();
            this.history.push(snapshotToRestore);

            await this._restoreSnapshot(snapshotToRestore);
            this.notificationService.add(_t('Redo completed'), { type: 'success' });
        } catch (error) {
            console.error('Error during redo:', error);
            this.notificationService.add(_t('Redo failed'), { type: 'danger' });
        }
    }

    /**
     * Restore Terra Draw to a previous state snapshot
     * @param {Array} snapshot - Array of GeoJSON features representing the state to restore
     * @returns {Promise<void>}
     * @private
     */
    async _restoreSnapshot(snapshot) {
        this.state.isRestoring = true;
        this.setSelectedFeatureId(null);

        try {
            this.terraDrawInstance.clear();
            if (snapshot.length > 0) {
                // The Google Maps adapter batches renders via requestAnimationFrame.
                // When clear() queues IDs for deletion and addFeatures() tries to
                // create features with the SAME IDs in the same RAF batch, the adapter
                // detects the duplicate in deletedSet and suppresses the create —
                // leaving the map empty. Regenerating IDs ensures no ID collision.
                const freshFeatures = snapshot.map((f) => {
                    const clone = JSON.parse(JSON.stringify(f));
                    clone.id = generateUUID();
                    return clone;
                });
                this.terraDrawInstance.addFeatures(freshFeatures);
            }
            await new Promise(resolve => setTimeout(resolve, TERRA_DRAW_CONFIG.UNDO_RESTORE_DELAY));
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
            // Terra Draw stores rectangle and circle features internally as
            // Polygon geometries — normalise the geometry type without touching
            // the mode property so addFeatures restores the correct editing
            // behaviour (resize handles, coordinate constraints, etc.).
            if (newFeature.properties.mode === 'rectangle' || newFeature.properties.mode === 'circle') {
                newFeature.geometry.type = 'Polygon';
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
        this.state.activeButton = modeId;
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
        if (this.terraDrawInstance || !this.props.googleMap || this.props.renderingMode !== 'terra-draw') {
            return;
        }

        // Function to create and start Terra Draw instance
        const createTerraDrawInstance = () => {
            const adapterOptions = {
                map: this.props.googleMap,
                lib: window.google.maps,
                coordinatePrecision: TERRA_DRAW_CONFIG.COORDINATE_PRECISION,
            };
            const adapter = new window.terraDrawGoogleMapsAdapter.TerraDrawGoogleMapsAdapter(adapterOptions);
            this.terraDrawInstance = new window.terraDraw.TerraDraw({
                adapter: adapter,
                modes: this._createTerraDrawModes(),
            });

            this.terraDrawInstance.start();
            this.terraDrawInstance.on('ready', () => {
                const isGeoJsonValid = validateGeoJson(this.props.dataGeoJson, { requireFeatures: true, validateGeometry: true, strict: true });
                if (isGeoJsonValid) {
                    // loadRecordData sets this.history = [baseline] after addFeatures
                    this.loadRecordData(this.props.dataGeoJson);
                } else {
                    // No existing data — seed an empty undo floor so the first
                    // drawn feature can be undone (guards require history.length > 1)
                    this.history = [[]];
                    this.redoHistory = [];
                    console.warn('⚠️ No dataGeoJson available on Terra Draw ready event');
                }
                this.setActiveMode('select-mode');
                this.terraDrawInstance.on('select', this.onDrawSelect.bind(this));
                this.terraDrawInstance.on('deselect', this.onDrawDeselect.bind(this));
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

            if (this.initTimeout) {
                clearTimeout(this.initTimeout);
                this.initTimeout = null;
            }

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
                'complex': sprintf(_t('Simplifying complex feature with %s vertices...'), originalVertexCount),
                'very_complex': sprintf(_t('Simplifying very complex feature with %s vertices. This may take a moment...'), originalVertexCount),
                'extremely_complex': sprintf(_t('Simplifying extremely complex feature with %s vertices. Please wait...'), originalVertexCount)
            };

            this.notificationService.add(
                complexityMessages[complexity] || _t('Simplifying feature...'),
                { type: 'info' }
            );

            const editableResult = createEditableFeature(selectedFeature);

            if (editableResult && editableResult.isSimplified) {
                const simplifiedFeature = editableResult.feature;

                // Generate a new ID for the simplified feature to avoid conflicts
                // Terra Draw's Google Maps adapter may have issues when removing and
                // adding a feature with the same ID in quick succession
                const newFeatureId = generateUUID();
                simplifiedFeature.id = newFeatureId;

                // Replace the original feature with the simplified version
                this.terraDrawInstance.removeFeatures([this.state.selectedFeatureId]);
                this.terraDrawInstance.addFeatures([simplifiedFeature]);

                // Update selection to the new feature
                setTimeout(() => {
                    this.terraDrawInstance.selectFeature(newFeatureId);
                    this.setSelectedFeatureId(newFeatureId);
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
                { type: 'danger' }
            );
        }
    }

    /**
     * Handle Terra Draw feature selection events with performance checking and gating
     * @param {string} id - ID of the selected feature
     * @private
     */
    async onDrawSelect(id) {
        this.uiService.block();
        try {
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
            if (this.history.length > 50) {
                this.history.shift();
            }
            this.redoHistory = [];
        }, 500);
    }

    async _saveChanges() {
        try {
            this.state.isSaving = true;

            this.uiService.block();
            this.setActiveMode('select-mode'); // Switch to select mode before saving

            const features = this.terraDrawInstance.getSnapshot();
            const geoJson = {
                type: 'FeatureCollection',
                features,
            };
            const totalArea = calculateFeaturesTotalArea(features);
            await this.props.saveFeatures(geoJson, totalArea);
            this._fitMapToBounds(features);
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
                    sprintf(_t('Failed to initialize drawing mode %s'), name),
                    { type: 'warning' }
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
                    pointWidth: 6,
                    pointOutlineColor: '#ffffff',
                    pointOutlineWidth: 2,
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
                    lineStringWidth: 2,
                    closingPointColor: color,
                    closingPointWidth: 4,
                    closingPointOutlineColor: '#ffffff',
                    closingPointOutlineWidth: 2,
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
                    fillOpacity: 0.3,
                    outlineColor: color,
                    outlineWidth: 2,
                    closingPointColor: color,
                    closingPointWidth: 4,
                    closingPointOutlineColor: '#ffffff',
                    closingPointOutlineWidth: 2,
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
                    fillOpacity: 0.3,
                    outlineColor: color,
                    outlineWidth: 2,
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
                    fillOpacity: 0.3,
                    outlineColor: color,
                    outlineWidth: 2,
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
                    fillOpacity: 0.3,
                    outlineColor: color,
                    outlineWidth: 2,
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
            } finally {
                this.terraDrawInstance = null;
            }
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
