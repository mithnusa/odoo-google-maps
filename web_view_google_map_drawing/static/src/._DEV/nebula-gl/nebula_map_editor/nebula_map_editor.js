import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import {
    useRef,
    useSubEnv,
    useState,
    onMounted,
    onWillDestroy,
} from '@odoo/owl';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { useService } from '@web/core/utils/hooks';

import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';

import {
    calculatePolygonArea,
    calculateLineStringLength,
    formatMeasurement,
    getRandomColor
} from '../../utils/terra_draw_utils.js';

export class GoogleMapNebulaDrawField extends BaseGoogleMapComponent {
    static template = 'web_view_google_map_drawing.GoogleMapNebulaDrawField';
    static components = {
        Geolocate: GoogleMapGeolocate,
        InMapSearchPlaces: GoogleMapSearchPlaces,
    };
    static defaultProps = {
        dynamicPlaceholder: false,
        shouldTrim: true,
    };
    static props = {
        ...standardFieldProps,
        placeholder: { type: String, optional: true },
        dynamicPlaceholder: { type: Boolean, optional: true },
        options: { type: Object, optional: true },
    };

    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.googleMapBounds = null;
        this.notificationService = useService('notification');

        this.state = useState({
            ...this.state,
            // Nebula-specific state
            currentTool: 'select',
            isDrawing: false,
            features: [],
            selectedFeatureIds: new Set(),
            showMeasurements: true,
            measurementUnit: 'metric',
            featureCount: 0,
            totalVertices: 0,
            sidebarIsFolded: false,
        });

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        // Nebula.gl instances
        this.editableLayer = null;
        this.deckglOverlay = null;
        
        // Event handlers
        this.boundKeydownHandler = this._handleKeydown.bind(this);
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        
        onMounted(this._onMounted.bind(this));
        onWillDestroy(this._onWillDestroy.bind(this));
    }

    /**
     * @override
     */
    mapDivElement() {
        return this.mapRef.el;
    }

    /**
     * @override
     */
    _prepareMapOptions(options) {
        options.mapTypeId = google.maps.MapTypeId.HYBRID;
        return options;
    }

    /**
     * @override
     */
    async onMapReady(map) {
        await super.onMapReady(map);
        if (!this.googleMapBounds) {
            const { LatLngBounds } = await this.apiLoader.importLibrary('core');
            this.googleMapBounds = new LatLngBounds();
        }
        
        // Initialize Nebula editor after map is ready
        await this._initializeNebula();
    }

    async _onMounted() {
        // Nebula initialization will happen in onMapReady
    }

    async _initializeNebula() {
        try {
            await this._loadNebula();
            await this._createDeckGLOverlay();
            this._initializeEditor();
            this._setupEventListeners();
            this._loadInitialData();
            this._addToHistory();
            
            this.notificationService.add(
                _t('High-performance Nebula.gl editor ready'),
                { type: 'success' }
            );
        } catch (error) {
            console.error('Failed to initialize Nebula editor:', error);
            this.notificationService.add(
                _t('Failed to initialize editor: %s', error.message),
                { type: 'danger' }
            );
        }
    }

    _loadInitialData() {
        const geoJSON = this.geoJson;
        if (geoJSON && geoJSON.features) {
            this.state.features = [...geoJSON.features];
            this._updateStats();
        }
    }
    
    _onWillDestroy() {
        this._removeEventListeners();
    }
    
    /**
     * Load Nebula.gl library
     */
    async _loadNebula() {
        if (!window.nebula) {
            throw new Error('Nebula.gl library not found. Please include it in your assets.');
        }
        
        // Check required classes
        const required = ['EditableGeoJsonLayer', 'ViewMode', 'DrawPolygonMode', 'ModifyMode'];
        for (const cls of required) {
            if (!window.nebula[cls]) {
                throw new Error(`Nebula.gl class ${cls} not found`);
            }
        }
    }

    /**
     * Create Deck.gl overlay
     */
    async _createDeckGLOverlay() {
        if (!window.deck) {
            throw new Error('Deck.gl library not found. Please include it in your assets.');
        }
        
        const { GoogleMapsOverlay } = window.deck;
        
        this.deckglOverlay = new GoogleMapsOverlay({
            layers: []
        });
        
        this.deckglOverlay.setMap(this.googleMap);
    }
    
    /**
     * Initialize the editor
     */
    _initializeEditor() {
        const { EditableGeoJsonLayer } = window.nebula;
        
        this.editableLayer = new EditableGeoJsonLayer({
            id: 'nebula-editable-layer',
            data: this.state.features,
            mode: this._getMode('select'),
            selectedFeatureIndexes: [],
            
            onEdit: this._handleEdit.bind(this),
            
            // Styling
            getFillColor: [0, 150, 255, 100],
            getLineColor: [0, 150, 255, 255],
            getLineWidth: 2,
            getRadius: 5,
            
            pickable: true,
            autoHighlight: true,
        });
        
        this._updateDeckGLLayers();
    }
    
    /**
     * Get Nebula.gl mode instance
     */
    _getMode(tool) {
        const modes = {
            select: window.nebula.ViewMode,
            point: window.nebula.DrawPointMode,
            line: window.nebula.DrawLineStringMode,
            polygon: window.nebula.DrawPolygonMode,
            rectangle: window.nebula.DrawRectangleMode,
            circle: window.nebula.DrawCircleFromCenterMode,
            modify: window.nebula.ModifyMode,
        };
        
        const ModeClass = modes[tool] || window.nebula.ViewMode;
        return new ModeClass();
    }

    /**
     * Update Deck.gl layers
     */
    _updateDeckGLLayers() {
        if (!this.deckglOverlay || !this.editableLayer) return;
        
        const existingLayers = this.deckglOverlay.props.layers || [];
        const otherLayers = existingLayers.filter(layer => layer.id !== 'nebula-editable-layer');
        
        this.deckglOverlay.setProps({
            layers: [...otherLayers, this.editableLayer]
        });
    }
    
    /**
     * Handle edit events
     */
    _handleEdit({ updatedData, editType, editContext }) {
        console.log('Nebula edit:', { editType, featureCount: updatedData.length });
        
        this.state.features = updatedData;
        this._updateStats();
        
        // Handle specific edit types
        if (editType === 'addFeature') {
            const newFeature = updatedData[updatedData.length - 1];
            if (newFeature) {
                // Add properties
                newFeature.id = 'nebula-' + Date.now();
                newFeature.properties = {
                    ...newFeature.properties,
                    id: newFeature.id,
                    color: getRandomColor(),
                    createdAt: new Date().toISOString()
                };
                
                // Show measurement
                if (this.state.showMeasurements) {
                    this._showMeasurement(newFeature);
                }
                
                // Switch back to select
                setTimeout(() => this.setTool('select'), 100);
            }
        }
        
        // Update layer
        this._updateEditableLayer();
        
        // Add to history
        this._debouncedAddToHistory();
        
        // Save to record
        this.handleSave({
            type: 'FeatureCollection',
            features: this.state.features
        });
    }
    
    /**
     * Update the editable layer
     */
    _updateEditableLayer() {
        if (!this.editableLayer) return;
        
        this.editableLayer.setProps({
            data: this.state.features,
            mode: this._getMode(this.state.currentTool),
            selectedFeatureIndexes: Array.from(this.state.selectedFeatureIds),
        });
        
        this._updateDeckGLLayers();
    }
    
    /**
     * Set current tool
     */
    setTool(tool) {
        this.state.currentTool = tool;
        this.state.isDrawing = ['point', 'line', 'polygon', 'rectangle', 'circle'].includes(tool);
        
        this._updateEditableLayer();
        
        // Update cursor
        const cursors = {
            select: 'default',
            point: 'crosshair',
            line: 'crosshair',
            polygon: 'crosshair',
            rectangle: 'crosshair',
            circle: 'crosshair',
            modify: 'pointer'
        };
        
        if (this.googleMap) {
            this.googleMap.setOptions({
                draggableCursor: cursors[tool] || 'default'
            });
        }
    }
    
    /**
     * Setup event listeners
     */
    _setupEventListeners() {
        document.addEventListener('keydown', this.boundKeydownHandler);
    }
    
    _removeEventListeners() {
        document.removeEventListener('keydown', this.boundKeydownHandler);
    }
    
    /**
     * Handle keyboard shortcuts
     */
    _handleKeydown(event) {
        if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
        
        const shortcuts = {
            'KeyV': 'select',
            'KeyP': 'point', 
            'KeyL': 'line',
            'KeyO': 'polygon',
            'KeyR': 'rectangle',
            'KeyC': 'circle',
            'KeyM': 'modify',
            'Delete': 'delete',
            'Backspace': 'delete',
            'Escape': 'cancel'
        };
        
        const ctrlShortcuts = {
            'KeyZ': 'undo',
            'KeyY': 'redo'
        };
        
        const key = event.ctrlKey ? ctrlShortcuts[event.code] : shortcuts[event.code];
        
        if (key) {
            event.preventDefault();
            this._handleShortcut(key);
        }
    }
    
    /**
     * Handle shortcut actions
     */
    _handleShortcut(action) {
        switch (action) {
            case 'delete':
                this.deleteSelected();
                break;
            case 'cancel':
                this.setTool('select');
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            default:
                if (['select', 'point', 'line', 'polygon', 'rectangle', 'circle', 'modify'].includes(action)) {
                    this.setTool(action);
                }
        }
    }
    
    /**
     * Delete selected features
     */
    deleteSelected() {
        if (this.state.selectedFeatureIds.size === 0) return;
        
        const indices = Array.from(this.state.selectedFeatureIds);
        this.state.features = this.state.features.filter((_, i) => !indices.includes(i));
        this.state.selectedFeatureIds.clear();
        
        this._updateEditableLayer();
        this._addToHistory();
        this._updateStats();
        
        this.notificationService.add(
            _t('Deleted %s feature(s)', indices.length),
            { type: 'info' }
        );
    }
    
    /**
     * Clear all features
     */
    clear() {
        this.state.features = [];
        this.state.selectedFeatureIds.clear();
        this._updateEditableLayer();
        this._addToHistory();
        this._updateStats();
    }
    
    /**
     * History management
     */
    _addToHistory() {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(JSON.parse(JSON.stringify(this.state.features)));
        
        if (this.history.length > 50) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }
    
    _debouncedAddToHistory() {
        clearTimeout(this._historyTimeout);
        this._historyTimeout = setTimeout(() => this._addToHistory(), 1000);
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.state.features = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this._updateEditableLayer();
            this._updateStats();
            this.notificationService.add(_t('Undo'), { type: 'info' });
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.state.features = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this._updateEditableLayer();
            this._updateStats();
            this.notificationService.add(_t('Redo'), { type: 'info' });
        }
    }
    
    /**
     * Load GeoJSON data
     */
    loadGeoJSON(geoJSON) {
        if (geoJSON && geoJSON.features) {
            this.state.features = geoJSON.features.map(feature => ({
                ...feature,
                id: feature.id || 'nebula-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
            }));
            
            this._updateEditableLayer();
            this._addToHistory();
            this._updateStats();
            
            this.notificationService.add(
                _t('Loaded %s feature(s)', this.state.features.length),
                { type: 'success' }
            );
        }
    }
    
    /**
     * Export GeoJSON
     */
    exportGeoJSON() {
        return {
            type: 'FeatureCollection',
            features: this.state.features
        };
    }
    
    /**
     * Update statistics
     */
    _updateStats() {
        this.state.featureCount = this.state.features.length;
        this.state.totalVertices = this.state.features.reduce((total, feature) => {
            return total + this._countVertices(feature.geometry);
        }, 0);
    }
    
    _countVertices(geometry) {
        if (!geometry?.coordinates) return 0;
        
        switch (geometry.type) {
            case 'Point': return 1;
            case 'LineString': return geometry.coordinates.length;
            case 'Polygon': 
                return geometry.coordinates.reduce((count, ring) => count + ring.length, 0);
            default: return 0;
        }
    }
    
    /**
     * Show measurement notification
     */
    _showMeasurement(feature) {
        const measurement = this._calculateMeasurement(feature);
        if (measurement) {
            this.notificationService.add(
                measurement,
                { title: _t('Measurement'), type: 'info' }
            );
        }
    }
    
    _calculateMeasurement(feature) {
        if (!feature?.geometry) return null;
        
        const { type, coordinates } = feature.geometry;
        const unit = this.state.measurementUnit;
        
        try {
            switch (type) {
                case 'Point':
                    const [lng, lat] = coordinates;
                    return `Point: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                    
                case 'LineString':
                    const length = calculateLineStringLength(coordinates, unit);
                    return `Line: ${formatMeasurement(length, 'distance', unit)}`;
                    
                case 'Polygon':
                    const area = calculatePolygonArea(coordinates[0], unit);
                    const perimeter = calculateLineStringLength(coordinates[0], unit);
                    return `Polygon: ${formatMeasurement(area, 'area', unit)} | Perimeter: ${formatMeasurement(perimeter, 'distance', unit)}`;
                    
                default:
                    return null;
            }
        } catch (error) {
            console.error('Error calculating measurement:', error);
            return null;
        }
    }
    
    /**
     * Get current statistics
     */
    getStats() {
        return {
            featureCount: this.state.featureCount,
            totalVertices: this.state.totalVertices,
            selectedCount: this.state.selectedFeatureIds.size,
            canUndo: this.historyIndex > 0,
            canRedo: this.historyIndex < this.history.length - 1,
            currentTool: this.state.currentTool
        };
    }

    get geoJson() {
        const value = this.props.record.data[this.props.name];
        if (!value) return {};
        try {
            return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
            console.error('Invalid GeoJSON data:', error);
            return {};
        }
    }

    async handleSave(geoJSON) {
        if (geoJSON) {
            try {
                await this.props.record.update({[this.props.name]: geoJSON});
                this.notificationService.add(_t('Shape changes saved successfully'), {
                    type: 'success',
                    title: _t('Success'),
                });
            } catch (error) {
                console.error('Failed to save shape changes:', error);
                this.notificationService.add(_t('Failed to save shape changes'), {
                    type: 'danger',
                    title: _t('Error'),
                });
            }
        }
    }
}

export const googleMapNebulaDrawField = {
    component: GoogleMapNebulaDrawField,
    displayName: _t('Google Maps Nebula Draw'),
    supportedTypes: ['json'],
    extractProps: ({ attrs, options }) => ({
        placeholder: attrs.placeholder,
        dynamicPlaceholder: options?.dynamic_placeholder || false,
        options,
    }),
};

registry.category('fields').add('google_map_nebula_draw', googleMapNebulaDrawField);