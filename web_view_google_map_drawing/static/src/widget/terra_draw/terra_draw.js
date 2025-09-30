import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import {
    useRef,
    useSubEnv,
    useState,
    onRendered,
    onWillUpdateProps,
} from '@odoo/owl';
import { standardFieldProps } from '@web/views/fields/standard_field_props';

import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';

import { TerraDrawToolsUI } from '../../views/components/terra-tools-ui/terra-tools-ui';
import { DeckGlEditor } from '../../views/components/deck-gl-editor/deck-gl-editor';

import { MapConfig } from '../../utils/map_config';
import { 
    analyzeFeaturePerformance,
    GEOMETRY_PERFORMANCE_CONFIG 
} from '../../utils/geometry_performance_utils';


export class GoogleMapTerraDrawField extends BaseGoogleMapComponent {
    static template = 'web_view_google_map_drawing.GoogleMapTerraDrawField';
    static components = {
        Geolocate: GoogleMapGeolocate,
        InMapSearchPlaces: GoogleMapSearchPlaces,
        TerraDrawToolsUI,
        DeckGlEditor,
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

        this.state = useState({
            ...this.state,
            sidebarIsFolded: false,
            renderingMode: null, // 'terra-draw' or 'deckgl' or null (not determined)
            complexityAnalysis: null,
        });

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        // Setup lifecycle hooks
        onWillUpdateProps((nextProps) => {
            this.state.renderingMode = null; // Reset rendering mode on record change
            this.state.complexityAnalysis = null;
            this.determineRenderingMode(nextProps.record.data[nextProps.name] || {});
        });
    }

    _handleRendered() {
        if (this.isMapLoaded()) {
            this.renderMap();
        }
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
        
        // Determine the appropriate rendering mode based on feature complexity
        this.determineRenderingMode();
    }

    renderMap() {
        if (!this.isMapLoaded()) return;
        // this._loadExistingShape();
    }

    get geoJson() {
        const value = this.props.record.data[this.props.name];
        if (!value) return {};
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            
            // If we have new data and rendering mode hasn't been determined, trigger analysis
            if (parsed?.features?.length > 0 && this.state.renderingMode === null && this.state.isMapReady) {
                setTimeout(() => this.determineRenderingMode(), 100);
            }
            
            return parsed;
        } catch (error) {
            console.error('Invalid GeoJSON data:', error);
            return {};
        }
    }

    async handleSave(features) {
        if (features) {
            try {
                await this.props.record.update({[this.props.name]: features});
                // Add notification for successful save
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

    getMapOptions() {
        return MapConfig.MAP_OPTIONS;
    }

    /**
     * Analyze GeoJSON features and determine optimal rendering approach
     * @returns {Object} Analysis result with rendering recommendation
     */
    analyzeFeatureComplexity(geojson) {
        const geoJson = typeof geojson === 'undefined' ? this.geoJson : geojson;
        
        if (!geoJson?.features || !Array.isArray(geoJson.features) || geoJson.features.length === 0) {
            return {
                shouldUseDeckGL: false,
                reason: 'no_features',
                totalFeatures: 0,
                complexFeatures: 0,
                maxVertices: 0,
                recommendation: 'terra-draw'
            };
        }

        let complexFeatures = 0;
        let maxVertices = 0;
        let totalVertices = 0;
        const featureAnalysis = [];

        // Analyze each feature
        geoJson.features.forEach((feature) => {
            const analysis = analyzeFeaturePerformance(feature);
            featureAnalysis.push(analysis);
            
            maxVertices = Math.max(maxVertices, analysis.vertexCount);
            totalVertices += analysis.vertexCount;
            
            // Count features that would be problematic for Terra Draw
            if (analysis.vertexCount > GEOMETRY_PERFORMANCE_CONFIG.MAX_VERTICES_FOR_EDITING || 
                analysis.recommendedAction === 'use_deckgl_only') {
                complexFeatures++;
            }
        });

        const shouldUseDeckGL = 
            // Use DeckGL if any feature would freeze Terra Draw
            maxVertices > GEOMETRY_PERFORMANCE_CONFIG.TERRA_DRAW_FREEZE_THRESHOLD ||
            // Use DeckGL if too many complex features
            complexFeatures > Math.ceil(geoJson.features.length * 0.3) || // More than 30% complex
            // Use DeckGL if total vertex count is very high
            totalVertices > GEOMETRY_PERFORMANCE_CONFIG.MAX_VERTICES_FOR_DISPLAY;

        const analysisResult = {
            shouldUseDeckGL,
            reason: shouldUseDeckGL ? this._getComplexityReason(maxVertices, complexFeatures, totalVertices, geoJson.features.length) : 'terra_draw_suitable',
            totalFeatures: geoJson.features.length,
            complexFeatures,
            maxVertices,
            totalVertices,
            averageVertices: Math.round(totalVertices / geoJson.features.length),
            recommendation: shouldUseDeckGL ? 'deckgl' : 'terra-draw',
            featureAnalysis
        };
        
        return analysisResult;
    }

    /**
     * Get human-readable reason for complexity decision
     */
    _getComplexityReason(maxVertices, complexFeatures, totalVertices, totalFeatures) {
        if (maxVertices > GEOMETRY_PERFORMANCE_CONFIG.TERRA_DRAW_FREEZE_THRESHOLD) {
            return `feature_too_complex_${maxVertices}_vertices`;
        }
        if (complexFeatures > Math.ceil(totalFeatures * 0.3)) {
            return `too_many_complex_features_${complexFeatures}_of_${totalFeatures}`;
        }
        if (totalVertices > GEOMETRY_PERFORMANCE_CONFIG.MAX_VERTICES_FOR_DISPLAY) {
            return `total_vertices_too_high_${totalVertices}`;
        }
        return 'unknown';
    }

    /**
     * Determine and set the appropriate rendering mode based on feature complexity
     */
    determineRenderingMode(geoJson) {
        const analysis = this.analyzeFeatureComplexity(geoJson);
        
        this.state.complexityAnalysis = analysis;
        this.state.renderingMode = analysis.recommendation;
    }

}

export const googleMapTerraDrawField = {
    component: GoogleMapTerraDrawField,
    displayName: _t('Google Maps Terra Draw'),
    supportedTypes: ['json'],
    extractProps: ({ attrs, options }) => ({
        placeholder: attrs.placeholder,
        dynamicPlaceholder: options?.dynamic_placeholder || false,
        options,
    }),
};

registry.category('fields').add('google_map_terra_draw', googleMapTerraDrawField);
