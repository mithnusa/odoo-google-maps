/**
 * @fileoverview Migration Utilities for Terra Draw to Nebula.gl
 * 
 * This module provides utilities to help migrate existing Terra Draw
 * implementations to the new Nebula.gl high-performance editing system.
 * It includes compatibility layers, data conversion utilities, and
 * migration helpers.
 * 
 * @author Yopi Angi - https://github.com/gityopie
 * @version 1.0.0
 */

/**
 * Migration utilities for converting Terra Draw workflows to Nebula.gl
 */
export class TerraDrawMigrationUtils {
    
    /**
     * Convert Terra Draw mode names to Nebula.gl modes
     */
    static TERRA_TO_NEBULA_MODE_MAP = {
        'select': 'ViewMode',
        'point': 'DrawPointMode', 
        'linestring': 'DrawLineStringMode',
        'polygon': 'DrawPolygonMode',
        'rectangle': 'DrawRectangleMode',
        'circle': 'DrawCircleFromCenterMode',
        'freehand': 'DrawPolygonMode', // Closest equivalent
        'great_circle': 'DrawLineStringMode', // Fallback to line
    };
    
    /**
     * Convert Terra Draw feature properties to Nebula.gl compatible format
     * @param {Object} terraDrawFeature - Feature from Terra Draw
     * @returns {Object} Nebula.gl compatible feature
     */
    static convertTerraDrawFeature(terraDrawFeature) {
        if (!terraDrawFeature) return null;
        
        const converted = {
            type: 'Feature',
            geometry: terraDrawFeature.geometry,
            properties: {
                ...terraDrawFeature.properties,
                // Preserve Terra Draw specific properties
                terraDrawId: terraDrawFeature.id,
                terraDrawMode: terraDrawFeature.properties?.mode,
                // Add Nebula.gl compatible properties
                id: terraDrawFeature.id,
                createdAt: terraDrawFeature.properties?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }
        };
        
        // Ensure feature has an ID
        if (!converted.id) {
            converted.id = this.generateCompatibleId();
        }
        
        // Convert Terra Draw styling to Nebula.gl format
        if (terraDrawFeature.properties) {
            this._convertStyling(terraDrawFeature.properties, converted.properties);
        }
        
        return converted;
    }
    
    /**
     * Convert Terra Draw feature collection to Nebula.gl format
     * @param {Object} terraDrawData - Terra Draw GeoJSON data
     * @returns {Object} Nebula.gl compatible GeoJSON
     */
    static convertTerraDrawData(terraDrawData) {
        if (!terraDrawData || !terraDrawData.features) {
            return { type: 'FeatureCollection', features: [] };
        }
        
        return {
            type: 'FeatureCollection',
            features: terraDrawData.features
                .map(feature => this.convertTerraDrawFeature(feature))
                .filter(feature => feature !== null),
            // Preserve metadata
            metadata: {
                convertedFrom: 'terra-draw',
                convertedAt: new Date().toISOString(),
                originalFeatureCount: terraDrawData.features.length
            }
        };
    }
    
    /**
     * Convert Terra Draw mode to Nebula.gl mode
     * @param {string} terraDrawMode - Terra Draw mode name
     * @returns {string} Nebula.gl mode name
     */
    static convertMode(terraDrawMode) {
        return this.TERRA_TO_NEBULA_MODE_MAP[terraDrawMode] || 'ViewMode';
    }
    
    /**
     * Convert Terra Draw styling properties to Nebula.gl format
     * @param {Object} terraDrawProps - Terra Draw properties
     * @param {Object} nebulaProps - Nebula.gl properties to modify
     * @private
     */
    static _convertStyling(terraDrawProps, nebulaProps) {
        // Color conversions
        if (terraDrawProps.color) {
            nebulaProps.color = terraDrawProps.color;
        }
        
        if (terraDrawProps.fillColor) {
            nebulaProps.fillColor = terraDrawProps.fillColor;
        }
        
        if (terraDrawProps.strokeColor) {
            nebulaProps.lineColor = terraDrawProps.strokeColor;
        }
        
        // Style properties
        if (terraDrawProps.fillOpacity !== undefined) {
            nebulaProps.fillOpacity = terraDrawProps.fillOpacity;
        }
        
        if (terraDrawProps.strokeWidth !== undefined) {
            nebulaProps.lineWidth = terraDrawProps.strokeWidth;
        }
        
        // Preserve custom properties
        Object.keys(terraDrawProps).forEach(key => {
            if (key.startsWith('custom_') || key.startsWith('user_')) {
                nebulaProps[key] = terraDrawProps[key];
            }
        });
    }
    
    /**
     * Generate a compatible feature ID
     * @returns {string} Unique ID
     */
    static generateCompatibleId() {
        return 'migrated-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
    }
    
    /**
     * Analyze Terra Draw data and provide migration recommendations
     * @param {Object} terraDrawData - Terra Draw GeoJSON data
     * @returns {Object} Migration analysis and recommendations
     */
    static analyzeMigration(terraDrawData) {
        if (!terraDrawData || !terraDrawData.features) {
            return {
                canMigrate: false,
                reason: 'No data to migrate',
                recommendations: []
            };
        }
        
        const features = terraDrawData.features;
        const analysis = {
            totalFeatures: features.length,
            featureTypes: {},
            modes: new Set(),
            totalVertices: 0,
            complexFeatures: 0,
            issues: [],
            recommendations: []
        };
        
        // Analyze features
        features.forEach((feature, index) => {
            // Count feature types
            const type = feature.geometry?.type;
            analysis.featureTypes[type] = (analysis.featureTypes[type] || 0) + 1;
            
            // Count modes
            if (feature.properties?.mode) {
                analysis.modes.add(feature.properties.mode);
            }
            
            // Count vertices
            const vertices = this._countVertices(feature.geometry);
            analysis.totalVertices += vertices;
            
            // Check for complex features
            if (vertices > 500) {
                analysis.complexFeatures++;
            }
            
            // Check for potential issues
            if (!feature.id) {
                analysis.issues.push(`Feature ${index}: Missing ID`);
            }
            
            if (!feature.geometry) {
                analysis.issues.push(`Feature ${index}: Missing geometry`);
            }
            
            // Check for unsupported Terra Draw modes
            const mode = feature.properties?.mode;
            if (mode && !this.TERRA_TO_NEBULA_MODE_MAP[mode]) {
                analysis.issues.push(`Feature ${index}: Unsupported mode '${mode}'`);
            }
        });
        
        // Generate recommendations
        this._generateMigrationRecommendations(analysis);
        
        return {
            canMigrate: analysis.issues.length === 0 || analysis.issues.every(issue => issue.includes('Missing ID')),
            analysis,
            recommendations: analysis.recommendations,
            performanceGain: this._estimatePerformanceGain(analysis)
        };
    }
    
    /**
     * Generate migration recommendations based on analysis
     * @param {Object} analysis - Migration analysis
     * @private
     */
    static _generateMigrationRecommendations(analysis) {
        // Performance recommendations
        if (analysis.totalVertices > 10000) {
            analysis.recommendations.push({
                type: 'performance',
                priority: 'high',
                message: `Large dataset detected (${analysis.totalVertices.toLocaleString()} vertices). Nebula.gl will provide significant performance improvement.`
            });
        }
        
        if (analysis.complexFeatures > 0) {
            analysis.recommendations.push({
                type: 'performance', 
                priority: 'high',
                message: `${analysis.complexFeatures} complex features detected. These would likely freeze Terra Draw during editing.`
            });
        }
        
        // Feature recommendations
        if (analysis.featureTypes['MultiPolygon']) {
            analysis.recommendations.push({
                type: 'feature',
                priority: 'medium',
                message: `MultiPolygon features detected. Nebula.gl handles these more efficiently than Terra Draw.`
            });
        }
        
        // Migration recommendations
        if (analysis.issues.length > 0) {
            analysis.recommendations.push({
                type: 'migration',
                priority: 'medium',
                message: `${analysis.issues.length} issues found that will be automatically fixed during migration.`
            });
        }
        
        // Mode recommendations
        const unsupportedModes = Array.from(analysis.modes).filter(mode => 
            !this.TERRA_TO_NEBULA_MODE_MAP[mode]
        );
        
        if (unsupportedModes.length > 0) {
            analysis.recommendations.push({
                type: 'feature',
                priority: 'low',
                message: `Some Terra Draw modes (${unsupportedModes.join(', ')}) will be converted to nearest Nebula.gl equivalents.`
            });
        }
    }
    
    /**
     * Estimate performance gain from migration
     * @param {Object} analysis - Migration analysis
     * @returns {Object} Performance gain estimate
     * @private
     */
    static _estimatePerformanceGain(analysis) {
        let gain = {
            rendering: 'significant', // Always better with GPU
            editing: 'moderate',
            memory: 'moderate'
        };
        
        if (analysis.totalVertices > 1000) {
            gain.editing = 'significant';
            gain.memory = 'significant';
        }
        
        if (analysis.complexFeatures > 0) {
            gain.editing = 'critical'; // Terra Draw would freeze
        }
        
        if (analysis.totalVertices > 10000) {
            gain.rendering = 'critical';
            gain.editing = 'critical';
            gain.memory = 'critical';
        }
        
        return gain;
    }
    
    /**
     * Count vertices in a geometry
     * @param {Object} geometry - GeoJSON geometry
     * @returns {number} Vertex count
     * @private
     */
    static _countVertices(geometry) {
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
     * Create a migration report for display to users
     * @param {Object} terraDrawData - Original Terra Draw data
     * @returns {Object} User-friendly migration report
     */
    static createMigrationReport(terraDrawData) {
        const analysis = this.analyzeMigration(terraDrawData);
        
        return {
            title: 'Terra Draw to Nebula.gl Migration Report',
            summary: {
                canMigrate: analysis.canMigrate,
                featuresCount: analysis.analysis.totalFeatures,
                verticesCount: analysis.analysis.totalVertices,
                issuesCount: analysis.analysis.issues.length
            },
            benefits: [
                'GPU-accelerated rendering for smooth 60fps performance',
                'No vertex count limitations (Terra Draw froze with complex features)',
                'Built-in undo/redo functionality',
                'Better memory management for large datasets',
                'Consistent performance regardless of feature complexity'
            ],
            warnings: analysis.analysis.issues,
            recommendations: analysis.recommendations,
            performanceGain: analysis.performanceGain,
            migrationSteps: [
                'Backup existing Terra Draw data',
                'Run migration converter on GeoJSON data', 
                'Initialize Nebula.gl editor with converted data',
                'Test all drawing and editing functionality',
                'Update any custom event handlers for Nebula.gl API'
            ]
        };
    }
    
    /**
     * Perform the actual migration
     * @param {Object} terraDrawData - Original Terra Draw data
     * @param {Object} options - Migration options
     * @returns {Object} Migration result
     */
    static performMigration(terraDrawData, options = {}) {
        const startTime = Date.now();
        
        try {
            // Analyze data
            const analysis = this.analyzeMigration(terraDrawData);
            
            if (!analysis.canMigrate) {
                throw new Error(`Cannot migrate: ${analysis.reason}`);
            }
            
            // Convert data
            const convertedData = this.convertTerraDrawData(terraDrawData);
            
            // Generate report
            const report = this.createMigrationReport(terraDrawData);
            
            const migrationTime = Date.now() - startTime;
            
            return {
                success: true,
                data: convertedData,
                report,
                metadata: {
                    migrationTime,
                    originalFeatures: terraDrawData.features?.length || 0,
                    convertedFeatures: convertedData.features.length,
                    issues: analysis.analysis.issues.length
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                metadata: {
                    migrationTime: Date.now() - startTime
                }
            };
        }
    }
}

/**
 * Compatibility layer for existing Terra Draw code
 */
export class TerraDrawCompatibility {
    
    /**
     * Create a compatibility wrapper for Terra Draw API calls
     * @param {Object} nebulaEditor - Nebula.gl editor instance
     * @returns {Object} Terra Draw compatible API
     */
    static createCompatibilityLayer(nebulaEditor) {
        return {
            // Terra Draw methods that can be mapped to Nebula.gl
            getSnapshot: () => {
                const geoJSON = nebulaEditor.exportGeoJSON();
                return geoJSON.features || [];
            },
            
            addFeatures: (features) => {
                nebulaEditor.loadGeoJSON({
                    type: 'FeatureCollection',
                    features: features
                });
            },
            
            clear: () => {
                nebulaEditor.clear();
            },
            
            setMode: (mode) => {
                const nebulaMode = TerraDrawMigrationUtils.convertMode(mode);
                nebulaEditor.setMode(nebulaMode);
            },
            
            start: () => {
                // Nebula.gl doesn't need explicit start
                console.log('Terra Draw compatibility: start() called - Nebula.gl is always ready');
            },
            
            stop: () => {
                // Handled by component lifecycle
                console.log('Terra Draw compatibility: stop() called - handled by component destruction');
            },
            
            // Event emitter compatibility
            on: (event, handler) => {
                console.warn(`Terra Draw compatibility: event '${event}' not directly supported. Use component props for callbacks.`);
            },
            
            off: (event, handler) => {
                console.warn(`Terra Draw compatibility: off() not supported in Nebula.gl compatibility layer`);
            }
        };
    }
}

// Export utilities
export default {
    TerraDrawMigrationUtils,
    TerraDrawCompatibility
};