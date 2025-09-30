/**
 * @fileoverview Nebula.gl High-Performance Editor Component
 * 
 * This component provides a complete replacement for Terra Draw using Nebula.gl
 * for GPU-accelerated editing of geospatial features. It integrates with the
 * existing Deck.gl renderer to provide seamless editing capabilities without
 * the performance limitations of Terra Draw.
 * 
 * Key Features:
 * - GPU-accelerated editing with no vertex limits
 * - Built-in undo/redo functionality
 * - Multiple drawing and editing modes
 * - Real-time measurements during drawing
 * - Keyboard shortcuts support
 * - Performance optimized for large datasets
 * 
 * @author Yopi Angi - https://github.com/gityopie
 * @version 1.0.0
 */

import { Component, onWillStart, onMounted, onWillDestroy, useState, useRef } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { _t } from '@web/core/l10n/translation';

// Import Nebula.gl configuration
import {
    NEBULA_CONFIG,
    DRAWING_TOOLS,
    EDITING_MODES,
    KEYBOARD_SHORTCUTS,
    getFeatureStyle,
    generateFeatureId,
    isSupportedMode,
    getToolConfig
} from './nebula_config.js';

// Import measurement utilities
import {
    calculatePolygonArea,
    calculateLineStringLength,
    formatMeasurement,
    MEASUREMENT_CONFIG,
    getRandomColor
} from '../../utils/terra_draw_utils.js';

/**
 * Nebula.gl Editor Component
 * 
 * Provides high-performance editing capabilities using Deck.gl and Nebula.gl
 * to replace Terra Draw functionality without performance limitations.
 */
export class NebulaGLEditor extends Component {
    static template = 'nebula_gl_editor_template';
    static props = {
        googleMap: { type: Object, optional: false },
        deckglOverlay: { type: Object, optional: false },
        initialData: { type: Object, optional: true },
        onEdit: { type: Function, optional: true },
        onSelectionChange: { type: Function, optional: true },
        readonly: { type: Boolean, optional: true },
        enableMeasurements: { type: Boolean, optional: true },
        measurementUnit: { type: String, optional: true }
    };

    setup() {
        // Services
        this.notificationService = useService('notification');
        
        // Component state
        this.state = useState({
            // Current editing mode
            currentMode: NEBULA_CONFIG.MODES.VIEW,
            currentTool: 'select',
            
            // Feature data
            features: [],
            selectedFeatureIds: new Set(),
            editingFeatureId: null,
            
            // UI state
            isDrawing: false,
            isDirty: false,
            
            // Measurements
            showMeasurements: true,
            measurementUnit: 'metric',
            currentMeasurement: null,
            
            // Performance stats
            featureCount: 0,
            totalVertices: 0,
        });
        
        // Component refs
        this.editorRef = useRef('nebula-editor');
        
        // Nebula.gl instances
        this.editableLayer = null;
        this.currentMode = null;
        
        // Event handlers
        this.boundKeydownHandler = this._handleKeydown.bind(this);
        
        // History management
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Lifecycle hooks
        onWillStart(this._onWillStart.bind(this));
        onMounted(this._onMounted.bind(this));
        onWillDestroy(this._onWillDestroy.bind(this));
    }
    
    /**
     * Initialize the component before mounting
     */
    async _onWillStart() {
        // Load initial data if provided
        if (this.props.initialData && this.props.initialData.features) {
            this.state.features = [...this.props.initialData.features];
            this._updateStats();
        }
        
        // Set initial measurement settings
        if (this.props.measurementUnit) {
            this.state.measurementUnit = this.props.measurementUnit;
        }
        
        if (typeof this.props.enableMeasurements === 'boolean') {
            this.state.showMeasurements = this.props.enableMeasurements;
        }
    }
    
    /**
     * Initialize Nebula.gl after component is mounted
     */
    async _onMounted() {
        try {
            await this._loadNebulaGL();
            this._initializeEditableLayer();
            this._setupEventListeners();
            
            // Add initial snapshot to history
            this._pushToHistory();
            
            this.notificationService.add(
                _t('Nebula.gl Editor initialized successfully'),
                { type: 'success' }
            );
        } catch (error) {
            console.error('Failed to initialize Nebula.gl Editor:', error);
            this.notificationService.add(
                _t('Failed to initialize drawing editor: %s', error.message),
                { type: 'danger' }
            );
        }
    }
    
    /**
     * Clean up resources when component is destroyed
     */
    _onWillDestroy() {
        this._removeEventListeners();
        this._cleanupNebulaGL();
    }
    
    /**
     * Load Nebula.gl library
     */
    async _loadNebulaGL() {
        if (!window.nebula) {
            throw new Error('Nebula.gl library not loaded. Please include Nebula.gl in your assets.');
        }
        
        // Verify required classes are available
        const requiredClasses = [
            'EditableGeoJsonLayer',
            'ViewMode',
            'DrawPointMode', 
            'DrawLineStringMode',
            'DrawPolygonMode',
            'DrawRectangleMode',
            'DrawCircleFromCenterMode',
            'ModifyMode',
            'TranslateMode'
        ];
        
        for (const className of requiredClasses) {
            if (!window.nebula[className]) {
                throw new Error(`Nebula.gl class ${className} not available`);
            }
        }
    }
    
    /**
     * Initialize the editable GeoJSON layer
     */
    _initializeEditableLayer() {
        const { EditableGeoJsonLayer } = window.nebula;
        
        this.editableLayer = new EditableGeoJsonLayer({
            id: NEBULA_CONFIG.LAYER_CONFIG.id,
            data: this.state.features,
            mode: this._getModeInstance(this.state.currentMode),
            selectedFeatureIndexes: [],
            
            // Event handlers
            onEdit: this._handleEdit.bind(this),
            
            // Styling
            getFillColor: this._getFeatureFillColor.bind(this),
            getLineColor: this._getFeatureLineColor.bind(this),
            getLineWidth: this._getFeatureLineWidth.bind(this),
            getRadius: this._getFeatureRadius.bind(this),
            
            // Interaction
            pickable: true,
            autoHighlight: true,
            highlightColor: NEBULA_CONFIG.LAYER_CONFIG.highlightColor,
            
            // Performance
            updateTriggers: {
                getFillColor: [this.state.selectedFeatureIds, this.state.editingFeatureId],
                getLineColor: [this.state.selectedFeatureIds, this.state.editingFeatureId],
                getLineWidth: [this.state.selectedFeatureIds, this.state.editingFeatureId],
            }
        });
        
        // Add layer to Deck.gl overlay
        this._updateDeckGLLayers();
    }
    
    /**
     * Get mode instance from mode name
     */
    _getModeInstance(modeName) {
        const modeMap = {
            [NEBULA_CONFIG.MODES.VIEW]: window.nebula.ViewMode,
            [NEBULA_CONFIG.MODES.DRAW_POINT]: window.nebula.DrawPointMode,
            [NEBULA_CONFIG.MODES.DRAW_LINE]: window.nebula.DrawLineStringMode,
            [NEBULA_CONFIG.MODES.DRAW_POLYGON]: window.nebula.DrawPolygonMode,
            [NEBULA_CONFIG.MODES.DRAW_RECTANGLE]: window.nebula.DrawRectangleMode,
            [NEBULA_CONFIG.MODES.DRAW_CIRCLE]: window.nebula.DrawCircleFromCenterMode,
            [NEBULA_CONFIG.MODES.MODIFY]: window.nebula.ModifyMode,
            [NEBULA_CONFIG.MODES.TRANSLATE]: window.nebula.TranslateMode,
            [NEBULA_CONFIG.MODES.ROTATE]: window.nebula.RotateMode,
            [NEBULA_CONFIG.MODES.SCALE]: window.nebula.ScaleMode,
        };
        
        const ModeClass = modeMap[modeName];
        return ModeClass ? new ModeClass() : new window.nebula.ViewMode();
    }
    
    /**
     * Update Deck.gl layers with current editable layer
     */
    _updateDeckGLLayers() {
        if (!this.props.deckglOverlay || !this.editableLayer) return;
        
        const existingLayers = this.props.deckglOverlay.props.layers || [];
        const otherLayers = existingLayers.filter(layer => layer.id !== NEBULA_CONFIG.LAYER_CONFIG.id);
        
        this.props.deckglOverlay.setProps({
            layers: [...otherLayers, this.editableLayer]
        });
    }
    
    /**
     * Handle edit events from Nebula.gl
     */
    _handleEdit({ updatedData, editType, editContext }) {
        console.log('Nebula.gl edit event:', { editType, editContext, featureCount: updatedData.length });
        
        // Update features
        this.state.features = updatedData;
        this.state.isDirty = true;
        this._updateStats();
        
        // Handle different edit types
        switch (editType) {
            case 'addFeature':
                this._handleFeatureAdded(editContext);
                break;
            case 'finishMovePosition':
                this._handleFeatureModified(editContext);
                break;
            case 'removePosition':
            case 'addPosition':
                this._handleFeatureModified(editContext);
                break;
            case 'movePosition':
                this._handleFeatureMoving(editContext);
                break;
        }
        
        // Update layer with new data
        this._updateEditableLayer();
        
        // Add to history (debounced for performance)
        this._debouncedPushToHistory();
        
        // Notify parent component
        if (this.props.onEdit) {
            this.props.onEdit({
                features: this.state.features,
                editType,
                editContext
            });
        }
    }
    
    /**
     * Handle feature addition
     */
    _handleFeatureAdded(editContext) {
        const newFeature = this.state.features[this.state.features.length - 1];
        
        if (newFeature) {
            // Add metadata
            newFeature.id = newFeature.id || generateFeatureId();
            newFeature.properties = {
                ...newFeature.properties,
                id: newFeature.id,
                createdAt: new Date().toISOString(),
                color: getRandomColor(),
                mode: this.state.currentTool,
            };
            
            // Calculate measurements
            if (this.state.showMeasurements) {
                const measurements = this._calculateFeatureMeasurement(newFeature);
                if (measurements) {
                    this._showMeasurementNotification(measurements);
                }
            }
            
            // Switch back to select mode after drawing
            setTimeout(() => this.setMode('select'), 100);
        }
    }
    
    /**
     * Handle feature modification
     */
    _handleFeatureModified(editContext) {
        const { featureIndex } = editContext;
        const modifiedFeature = this.state.features[featureIndex];
        
        if (modifiedFeature) {
            // Update modification timestamp
            modifiedFeature.properties = {
                ...modifiedFeature.properties,
                modifiedAt: new Date().toISOString(),
            };
            
            // Show updated measurements
            if (this.state.showMeasurements) {
                const measurements = this._calculateFeatureMeasurement(modifiedFeature);
                if (measurements) {
                    this._showMeasurementNotification(measurements);
                }
            }
        }
    }
    
    /**
     * Handle feature moving (real-time updates)
     */
    _handleFeatureMoving(editContext) {
        // Show live measurements while dragging
        if (this.state.showMeasurements && editContext.featureIndex !== undefined) {
            const movingFeature = this.state.features[editContext.featureIndex];
            if (movingFeature) {
                const measurements = this._calculateFeatureMeasurement(movingFeature);
                this.state.currentMeasurement = measurements;
            }
        }
    }
    
    /**
     * Update the editable layer with current data
     */
    _updateEditableLayer() {
        if (!this.editableLayer) return;
        
        this.editableLayer.setProps({
            data: this.state.features,
            mode: this._getModeInstance(this.state.currentMode),
            selectedFeatureIndexes: Array.from(this.state.selectedFeatureIds),
        });
        
        this._updateDeckGLLayers();
    }
    
    /**
     * Set current editing mode
     */
    setMode(toolKey) {
        const toolConfig = getToolConfig(toolKey);
        
        if (!toolConfig) {
            console.warn(`Unknown tool: ${toolKey}`);
            return;
        }
        
        if (!isSupportedMode(toolConfig.mode)) {
            console.warn(`Unsupported mode: ${toolConfig.mode}`);
            return;
        }
        
        this.state.currentMode = toolConfig.mode;
        this.state.currentTool = toolKey;
        this.state.isDrawing = toolConfig.geometryType ? true : false;
        
        // Clear current measurement when switching modes
        this.state.currentMeasurement = null;
        
        // Update layer with new mode
        this._updateEditableLayer();
        
        // Update cursor
        if (this.props.googleMap && toolConfig.cursor) {
            this.props.googleMap.setOptions({
                draggableCursor: toolConfig.cursor,
                draggingCursor: toolConfig.cursor
            });
        }
        
        console.log(`Switched to mode: ${toolKey} (${toolConfig.mode})`);
    }
    
    /**
     * Setup event listeners
     */
    _setupEventListeners() {
        document.addEventListener('keydown', this.boundKeydownHandler);
    }
    
    /**
     * Remove event listeners
     */
    _removeEventListeners() {
        document.removeEventListener('keydown', this.boundKeydownHandler);
    }
    
    /**
     * Handle keyboard shortcuts
     */
    _handleKeydown(event) {
        if (this.props.readonly) return;
        
        // Don't handle shortcuts if user is typing in an input
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        
        const keyCombo = (event.ctrlKey ? 'ctrl+' : '') + event.code;
        const shortcut = KEYBOARD_SHORTCUTS[keyCombo] || KEYBOARD_SHORTCUTS[event.code];
        
        if (shortcut) {
            event.preventDefault();
            this._handleShortcut(shortcut);
        }
    }
    
    /**
     * Handle keyboard shortcut actions
     */
    _handleShortcut(action) {
        switch (action) {
            case 'cancel':
                this.cancelCurrentOperation();
                break;
            case 'finish':
                this.finishCurrentOperation();
                break;
            case 'delete':
                this.deleteSelectedFeatures();
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'selectAll':
                this.selectAllFeatures();
                break;
            default:
                // Check if it's a tool switch
                if (DRAWING_TOOLS[action] || EDITING_MODES[action]) {
                    this.setMode(action);
                }
                break;
        }
    }
    
    /**
     * Cancel current drawing/editing operation
     */
    cancelCurrentOperation() {
        this.setMode('select');
        this.state.currentMeasurement = null;
    }
    
    /**
     * Finish current drawing operation
     */
    finishCurrentOperation() {
        // Nebula.gl handles this automatically on double-click or Enter
        this.state.currentMeasurement = null;
    }
    
    /**
     * Delete selected features
     */
    deleteSelectedFeatures() {
        if (this.state.selectedFeatureIds.size === 0) return;
        
        const selectedIndices = Array.from(this.state.selectedFeatureIds);
        const remainingFeatures = this.state.features.filter((_, index) => 
            !selectedIndices.includes(index)
        );
        
        this.state.features = remainingFeatures;
        this.state.selectedFeatureIds.clear();
        
        this._updateEditableLayer();
        this._pushToHistory();
        this._updateStats();
        
        this.notificationService.add(
            _t('Deleted %s feature(s)', selectedIndices.length),
            { type: 'info' }
        );
        
        if (this.props.onEdit) {
            this.props.onEdit({
                features: this.state.features,
                editType: 'deleteFeature',
                editContext: { deletedIndices: selectedIndices }
            });
        }
    }
    
    /**
     * Select all features
     */
    selectAllFeatures() {
        this.state.selectedFeatureIds.clear();
        for (let i = 0; i < this.state.features.length; i++) {
            this.state.selectedFeatureIds.add(i);
        }
        this._updateEditableLayer();
    }
    
    /**
     * History management - add current state to history
     */
    _pushToHistory() {
        // Remove any history after current index (when undoing then making changes)
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add current state
        this.history.push({
            features: JSON.parse(JSON.stringify(this.state.features)),
            timestamp: Date.now()
        });
        
        // Keep history within limits
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }
    
    /**
     * Debounced version of _pushToHistory for performance
     */
    _debouncedPushToHistory() {
        clearTimeout(this._historyTimeout);
        this._historyTimeout = setTimeout(() => {
            this._pushToHistory();
        }, 1000);
    }
    
    /**
     * Undo last change
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const historyState = this.history[this.historyIndex];
            this.state.features = JSON.parse(JSON.stringify(historyState.features));
            this._updateEditableLayer();
            this._updateStats();
            
            this.notificationService.add(_t('Undo'), { type: 'info' });
            
            if (this.props.onEdit) {
                this.props.onEdit({
                    features: this.state.features,
                    editType: 'undo',
                    editContext: {}
                });
            }
        }
    }
    
    /**
     * Redo last undone change
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const historyState = this.history[this.historyIndex];
            this.state.features = JSON.parse(JSON.stringify(historyState.features));
            this._updateEditableLayer();
            this._updateStats();
            
            this.notificationService.add(_t('Redo'), { type: 'info' });
            
            if (this.props.onEdit) {
                this.props.onEdit({
                    features: this.state.features,
                    editType: 'redo', 
                    editContext: {}
                });
            }
        }
    }
    
    /**
     * Clear all features
     */
    clear() {
        this.state.features = [];
        this.state.selectedFeatureIds.clear();
        this._updateEditableLayer();
        this._pushToHistory();
        this._updateStats();
        
        if (this.props.onEdit) {
            this.props.onEdit({
                features: this.state.features,
                editType: 'clear',
                editContext: {}
            });
        }
    }
    
    /**
     * Load features from GeoJSON
     */
    loadGeoJSON(geoJSON) {
        if (geoJSON && geoJSON.features) {
            this.state.features = geoJSON.features.map(feature => ({
                ...feature,
                id: feature.id || generateFeatureId(),
                properties: {
                    ...feature.properties,
                    id: feature.id || generateFeatureId(),
                }
            }));
            
            this._updateEditableLayer();
            this._pushToHistory();
            this._updateStats();
            
            this.notificationService.add(
                _t('Loaded %s feature(s)', this.state.features.length),
                { type: 'success' }
            );
        }
    }
    
    /**
     * Export features as GeoJSON
     */
    exportGeoJSON() {
        return {
            type: 'FeatureCollection',
            features: this.state.features
        };
    }
    
    /**
     * Get current feature statistics
     */
    getStats() {
        return {
            featureCount: this.state.featureCount,
            totalVertices: this.state.totalVertices,
            selectedCount: this.state.selectedFeatureIds.size,
            isDirty: this.state.isDirty,
            canUndo: this.historyIndex > 0,
            canRedo: this.historyIndex < this.history.length - 1,
        };
    }
    
    /**
     * Update performance statistics
     */
    _updateStats() {
        this.state.featureCount = this.state.features.length;
        this.state.totalVertices = this.state.features.reduce((total, feature) => {
            return total + this._getVertexCount(feature.geometry);
        }, 0);
    }
    
    /**
     * Count vertices in geometry
     */
    _getVertexCount(geometry) {
        if (!geometry || !geometry.coordinates) return 0;
        
        switch (geometry.type) {
            case 'Point': return 1;
            case 'LineString': return geometry.coordinates.length;
            case 'Polygon': 
                return geometry.coordinates.reduce((count, ring) => count + ring.length, 0);
            case 'MultiPolygon':
                return geometry.coordinates.reduce((count, polygon) => 
                    count + polygon.reduce((ringCount, ring) => ringCount + ring.length, 0), 0);
            default: return 0;
        }
    }
    
    /**
     * Calculate feature measurements
     */
    _calculateFeatureMeasurement(feature) {
        if (!feature || !feature.geometry) return null;
        
        const { type, coordinates } = feature.geometry;
        const unit = this.state.measurementUnit;
        const measurements = { type };
        
        try {
            switch (type) {
                case 'Point':
                    const [lng, lat] = coordinates;
                    measurements.coordinates = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                    measurements.display = `Point: ${measurements.coordinates}`;
                    break;
                    
                case 'LineString':
                    const length = calculateLineStringLength(coordinates, unit);
                    measurements.length = formatMeasurement(length, 'distance', unit);
                    measurements.points = coordinates.length;
                    measurements.display = `Line: ${measurements.length} | Points: ${measurements.points}`;
                    break;
                    
                case 'Polygon':
                    const area = calculatePolygonArea(coordinates[0], unit);
                    const perimeter = calculateLineStringLength(coordinates[0], unit);
                    measurements.area = formatMeasurement(area, 'area', unit);
                    measurements.perimeter = formatMeasurement(perimeter, 'distance', unit);
                    measurements.points = coordinates[0].length - 1;
                    measurements.display = `Polygon: ${measurements.area} | Perimeter: ${measurements.perimeter}`;
                    break;
            }
            
            return measurements;
        } catch (error) {
            console.error('Error calculating measurements:', error);
            return null;
        }
    }
    
    /**
     * Show measurement notification
     */
    _showMeasurementNotification(measurements) {
        if (measurements && measurements.display) {
            this.notificationService.add(
                measurements.display,
                { title: _t('Measurement'), type: 'info' }
            );
        }
    }
    
    /**
     * Feature styling functions
     */
    _getFeatureFillColor(feature, { index }) {
        const isSelected = this.state.selectedFeatureIds.has(index);
        const isEditing = this.state.editingFeatureId === feature.id;
        
        const style = getFeatureStyle(feature, isSelected, isEditing);
        return style.getFillColor;
    }
    
    _getFeatureLineColor(feature, { index }) {
        const isSelected = this.state.selectedFeatureIds.has(index);
        const isEditing = this.state.editingFeatureId === feature.id;
        
        const style = getFeatureStyle(feature, isSelected, isEditing);
        return style.getLineColor;
    }
    
    _getFeatureLineWidth(feature, { index }) {
        const isSelected = this.state.selectedFeatureIds.has(index);
        const isEditing = this.state.editingFeatureId === feature.id;
        
        const style = getFeatureStyle(feature, isSelected, isEditing);
        return style.getLineWidth;
    }
    
    _getFeatureRadius() {
        return NEBULA_CONFIG.LAYER_CONFIG.getPointRadius;
    }
    
    /**
     * Clean up Nebula.gl resources
     */
    _cleanupNebulaGL() {
        if (this._historyTimeout) {
            clearTimeout(this._historyTimeout);
        }
        
        // Reset Google Maps cursor
        if (this.props.googleMap) {
            this.props.googleMap.setOptions({
                draggableCursor: null,
                draggingCursor: null
            });
        }
    }
}