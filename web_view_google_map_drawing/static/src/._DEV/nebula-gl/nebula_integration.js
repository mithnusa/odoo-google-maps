/**
 * @fileoverview Nebula.gl Integration Component
 * 
 * This component integrates the existing GoogleMapDeckGLRenderer with the new
 * NebulaGLEditor to provide a complete replacement for Terra Draw. It manages
 * the interaction between viewing (Deck.gl) and editing (Nebula.gl) modes.
 * 
 * Key Features:
 * - Seamless integration with existing Deck.gl renderer
 * - Automatic mode switching between viewing and editing
 * - Performance optimization for large datasets
 * - Backward compatibility with existing Terra Draw workflows
 * 
 * @author Yopi Angi - https://github.com/gityopie
 * @version 1.0.0
 */

import { Component, onWillStart, onMounted, onWillDestroy, useState } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { _t } from '@web/core/l10n/translation';

// Import existing components
import { GoogleMapDeckGLRenderer } from '../google_map_drawing/google_map_deckgl_renderer.js';
import { NebulaGLEditor } from './nebula_editor.js';

// Import utilities
import { 
    analyzeFeaturePerformance,
    GEOMETRY_PERFORMANCE_CONFIG 
} from '../../utils/geometry_performance_utils.js';

/**
 * Nebula.gl Integration Component
 * 
 * Manages the integration between Deck.gl rendering and Nebula.gl editing
 * to provide a complete Terra Draw replacement.
 */
export class NebulaGLIntegration extends Component {
    static template = 'nebula_integration_template';
    static components = {
        GoogleMapDeckGLRenderer,
        NebulaGLEditor
    };
    
    static props = {
        // Core props
        googleMap: { type: Object, optional: false },
        archInfo: { type: Object, optional: false },
        list: { type: Object, optional: false },
        
        // Callbacks
        openRecord: { type: Function, optional: false },
        showRecord: { type: Function, optional: false },
        showRecordsByDomain: { type: Function, optional: false },
        
        // Configuration
        readonly: { type: Boolean, optional: true },
        allowSelectors: { type: Boolean, optional: true },
        activeActions: { type: Object, optional: true },
        onAdd: { type: Function, optional: true },
        
        // Data
        initialGeoJSON: { type: Object, optional: true },
        measurementUnit: { type: String, optional: true },
        enableMeasurements: { type: Boolean, optional: true }
    };

    setup() {
        // Services
        this.notificationService = useService('notification');
        
        // Component state
        this.state = useState({
            // Mode management
            mode: 'viewing', // 'viewing' or 'editing'
            canEdit: true,
            
            // Feature data
            features: [],
            selectedFeatures: new Set(),
            
            // Performance analysis
            performanceReport: null,
            useNebulaForAll: false,
            
            // UI state
            showPerformanceWarning: false,
            isTransitioning: false,
        });
        
        // Component instances
        this.deckglRenderer = null;
        this.nebulaEditor = null;
        
        // Performance thresholds
        this.PERFORMANCE_THRESHOLDS = {
            PREFER_NEBULA: 1000,      // Prefer Nebula.gl for datasets with 1000+ total vertices
            FORCE_NEBULA: 5000,       // Force Nebula.gl for datasets with 5000+ total vertices  
            COMPLEX_FEATURE: 150,     // Individual features with 150+ vertices
        };
        
        // Lifecycle hooks
        onWillStart(this._onWillStart.bind(this));
        onMounted(this._onMounted.bind(this));
        onWillDestroy(this._onWillDestroy.bind(this));
    }
    
    /**
     * Initialize component before mounting
     */
    async _onWillStart() {
        // Load initial data
        if (this.props.initialGeoJSON && this.props.initialGeoJSON.features) {
            this.state.features = [...this.props.initialGeoJSON.features];
            await this._analyzePerformance();
        }
        
        // Determine initial mode based on performance analysis
        this._determineOptimalMode();
    }
    
    /**
     * Initialize components after mounting
     */
    async _onMounted() {
        try {
            // Always initialize Deck.gl renderer for viewing
            await this._initializeDeckGLRenderer();
            
            // Initialize Nebula.gl editor if needed
            if (this.state.mode === 'editing' || this.state.useNebulaForAll) {
                await this._initializeNebulaEditor();
            }
            
            this._showInitializationStatus();
            
        } catch (error) {
            console.error('Failed to initialize Nebula.gl Integration:', error);
            this.notificationService.add(
                _t('Failed to initialize map editor: %s', error.message),
                { type: 'danger' }
            );
        }
    }
    
    /**
     * Clean up resources
     */
    _onWillDestroy() {
        // Cleanup will be handled by individual components
    }
    
    /**
     * Analyze performance characteristics of the dataset
     */
    async _analyzePerformance() {
        if (!this.state.features.length) return;
        
        let totalVertices = 0;
        let complexFeatures = 0;
        let veryComplexFeatures = 0;
        const problematicFeatures = [];
        
        this.state.features.forEach((feature, index) => {
            const analysis = analyzeFeaturePerformance(feature);
            totalVertices += analysis.vertexCount;
            
            if (analysis.complexity === 'complex') {
                complexFeatures++;
            } else if (analysis.complexity === 'very_complex' || analysis.complexity === 'extremely_complex') {
                veryComplexFeatures++;
                problematicFeatures.push({ index, feature, analysis });
            }
            
            // Check for individual complex features
            if (analysis.vertexCount > this.PERFORMANCE_THRESHOLDS.COMPLEX_FEATURE) {
                problematicFeatures.push({ index, feature, analysis });
            }
        });
        
        this.state.performanceReport = {
            totalFeatures: this.state.features.length,
            totalVertices,
            complexFeatures,
            veryComplexFeatures,
            problematicFeatures,
            recommendedRenderer: this._getRecommendedRenderer(totalVertices, veryComplexFeatures)
        };
        
        console.log('Performance Analysis:', this.state.performanceReport);
    }
    
    /**
     * Get recommended renderer based on performance analysis
     */
    _getRecommendedRenderer(totalVertices, veryComplexFeatures) {
        if (totalVertices > this.PERFORMANCE_THRESHOLDS.FORCE_NEBULA || veryComplexFeatures > 0) {
            return 'nebula_only';
        } else if (totalVertices > this.PERFORMANCE_THRESHOLDS.PREFER_NEBULA) {
            return 'nebula_preferred';
        } else {
            return 'hybrid';
        }
    }
    
    /**
     * Determine optimal mode based on performance analysis
     */
    _determineOptimalMode() {
        if (!this.state.performanceReport) {
            this.state.mode = 'viewing';
            return;
        }
        
        const { recommendedRenderer, totalVertices } = this.state.performanceReport;
        
        switch (recommendedRenderer) {
            case 'nebula_only':
                this.state.useNebulaForAll = true;
                this.state.mode = 'editing';
                this.state.showPerformanceWarning = true;
                break;
                
            case 'nebula_preferred':
                this.state.useNebulaForAll = false;
                this.state.mode = 'viewing'; // Start with viewing, allow user to switch
                this.state.showPerformanceWarning = true;
                break;
                
            case 'hybrid':
            default:
                this.state.useNebulaForAll = false;
                this.state.mode = 'viewing';
                this.state.showPerformanceWarning = totalVertices > 500;
                break;
        }
    }
    
    /**
     * Initialize Deck.gl renderer
     */
    async _initializeDeckGLRenderer() {
        // This will be handled by the GoogleMapDeckGLRenderer component
        console.log('Deck.gl renderer will be initialized by the component');
    }
    
    /**
     * Initialize Nebula.gl editor
     */
    async _initializeNebulaEditor() {
        // This will be handled by the NebulaGLEditor component
        console.log('Nebula.gl editor will be initialized by the component');
    }
    
    /**
     * Switch between viewing and editing modes
     */
    async switchMode(newMode) {
        if (this.state.mode === newMode || this.state.isTransitioning) return;
        
        this.state.isTransitioning = true;
        
        try {
            console.log(`Switching from ${this.state.mode} to ${newMode}`);
            
            if (newMode === 'editing') {
                // Check if we can safely edit with current dataset
                if (this.state.performanceReport && 
                    this.state.performanceReport.recommendedRenderer === 'nebula_only') {
                    
                    this.notificationService.add(
                        _t('Switching to high-performance editing mode due to complex dataset'),
                        { type: 'info' }
                    );
                }
                
                // Initialize Nebula.gl if not already done
                if (!this.nebulaEditor) {
                    await this._initializeNebulaEditor();
                }
            }
            
            this.state.mode = newMode;
            
        } catch (error) {
            console.error('Error switching modes:', error);
            this.notificationService.add(
                _t('Failed to switch editing mode: %s', error.message),
                { type: 'danger' }
            );
        } finally {
            this.state.isTransitioning = false;
        }
    }
    
    /**
     * Handle data changes from either renderer
     */
    _handleDataChange(data, source) {
        console.log(`Data changed from ${source}:`, data);
        
        // Update features
        this.state.features = data.features || [];
        
        // Re-analyze performance if significant changes
        if (data.features && data.features.length !== this.state.performanceReport?.totalFeatures) {
            this._analyzePerformance().then(() => {
                this._determineOptimalMode();
            });
        }
        
        // Sync data between renderers if both are active
        this._syncRenderers(data, source);
    }
    
    /**
     * Sync data between Deck.gl and Nebula.gl renderers
     */
    _syncRenderers(data, source) {
        // Only sync if both renderers are initialized and source is different
        if (source === 'deckgl' && this.nebulaEditor) {
            // Update Nebula.gl with Deck.gl data
            this.nebulaEditor.loadGeoJSON({ type: 'FeatureCollection', features: data.features });
        } else if (source === 'nebula' && this.deckglRenderer) {
            // Update Deck.gl with Nebula.gl data
            // This will be handled through props update
        }
    }
    
    /**
     * Show initialization status to user
     */
    _showInitializationStatus() {
        const report = this.state.performanceReport;
        
        if (!report) {
            this.notificationService.add(
                _t('Map editor initialized successfully'),
                { type: 'success' }
            );
            return;
        }
        
        const { totalVertices, recommendedRenderer } = report;
        
        let message, type;
        
        switch (recommendedRenderer) {
            case 'nebula_only':
                message = _t('High-performance mode activated: %s vertices detected. Using Nebula.gl for optimal performance.', totalVertices.toLocaleString());
                type = 'warning';
                break;
                
            case 'nebula_preferred':
                message = _t('Large dataset detected: %s vertices. Nebula.gl recommended for editing complex features.', totalVertices.toLocaleString());
                type = 'info';
                break;
                
            case 'hybrid':
                message = _t('Map editor ready: %s features loaded. Both viewing and editing modes available.', report.totalFeatures);
                type = 'success';
                break;
                
            default:
                message = _t('Map editor initialized');
                type = 'success';
        }
        
        this.notificationService.add(message, { type, sticky: type === 'warning' });
    }
    
    /**
     * Get current renderer statistics
     */
    getStats() {
        const baseStats = {
            mode: this.state.mode,
            featureCount: this.state.features.length,
            canEdit: this.state.canEdit,
            useNebulaForAll: this.state.useNebulaForAll
        };
        
        // Add performance report if available
        if (this.state.performanceReport) {
            return {
                ...baseStats,
                ...this.state.performanceReport
            };
        }
        
        return baseStats;
    }
    
    /**
     * Force switch to Nebula.gl mode
     */
    forceNebulaMode() {
        this.state.useNebulaForAll = true;
        this.switchMode('editing');
        
        this.notificationService.add(
            _t('Switched to high-performance Nebula.gl mode'),
            { type: 'success' }
        );
    }
    
    /**
     * Export current data
     */
    exportGeoJSON() {
        return {
            type: 'FeatureCollection',
            features: this.state.features
        };
    }
    
    /**
     * Load new GeoJSON data
     */
    async loadGeoJSON(geoJSON) {
        if (geoJSON && geoJSON.features) {
            this.state.features = [...geoJSON.features];
            await this._analyzePerformance();
            this._determineOptimalMode();
            
            // Notify both renderers
            this._handleDataChange(geoJSON, 'external');
        }
    }
    
    /**
     * Get component props for Deck.gl renderer
     */
    get deckglRendererProps() {
        return {
            ...this.props,
            onDataChange: (data) => this._handleDataChange(data, 'deckgl'),
            initialData: { type: 'FeatureCollection', features: this.state.features },
            readonly: this.state.mode !== 'viewing' || this.props.readonly
        };
    }
    
    /**
     * Get component props for Nebula.gl editor
     */
    get nebulaEditorProps() {
        return {
            googleMap: this.props.googleMap,
            deckglOverlay: null, // Will be set by ref
            initialData: { type: 'FeatureCollection', features: this.state.features },
            onEdit: (data) => this._handleDataChange(data, 'nebula'),
            readonly: this.props.readonly,
            enableMeasurements: this.props.enableMeasurements,
            measurementUnit: this.props.measurementUnit
        };
    }
}