/**
 * @fileoverview Geometry Performance Utilities for Terra Draw
 * 
 * This module provides utilities to handle performance issues when dealing with
 * large or complex geometry features in Terra Draw. It includes functions for
 * vertex counting, geometry simplification, and performance checks.
 * 
 * @author Yopi Angi - https://github.com/gityopie
 * @version 1.0.0
 */
import { _t } from '@web/core/l10n/translation';
import { sprintf } from '@web/core/utils/strings';

/**
 * Performance configuration constants
 * Note: These values are tuned for Terra Draw performance
 * and may need adjustment based on real-world usage.
 */
export const GEOMETRY_PERFORMANCE_CONFIG = {
    MAX_VERTICES_FOR_EDITING: 150,      // Safe editing threshold for Terra Draw
    MAX_VERTICES_FOR_DISPLAY: 1000,     // Maximum vertices for display
    TERRA_DRAW_FREEZE_THRESHOLD: 195,   // Features with 195+ vertices may cause performance issues
    SIMPLIFICATION_TOLERANCE: 0.005,    // Normal simplification for geographic data
    AGGRESSIVE_SIMPLIFICATION_TOLERANCE: 0.015, // Aggressive simplification to get below 150 vertices
    CHUNK_SIZE: 500,                    // Chunk size for processing large geometries
    PROCESSING_DELAY: 100,              // Delay between processing chunks (ms)

    // Special handling for geographic boundary data
    GEOGRAPHIC_BOUNDARY_THRESHOLD: 150, // Specific threshold for province/country boundaries
    GEOGRAPHIC_SIMPLIFICATION_TOLERANCE: 0.008, // Optimized for coastlines and borders

    // Dataset-level limits for automatic DeckGL routing
    MAX_FEATURES_FOR_TERRA_DRAW: 3000,          // Total feature count limit
    MAX_TOTAL_VERTICES_FOR_TERRA_DRAW: 5000,    // Sum of all vertices across features
    MAX_POINTS_FOR_TERRA_DRAW: 5000,            // Specifically for Point geometries (lightweight)
};

/**
 * Count the total number of vertices in a geometry
 * @param {Object} geometry - GeoJSON geometry object
 * @returns {number} Total vertex count
 */
export function getVertexCount(geometry) {
    if (!geometry || !geometry.coordinates) return 0;
    
    try {
        switch (geometry.type) {
            case 'Point':
                return 1;
                
            case 'LineString':
                return geometry.coordinates.length;
                
            case 'Polygon':
                return geometry.coordinates.reduce((count, ring) => count + ring.length, 0);
                
            case 'MultiPoint':
                return geometry.coordinates.length;
                
            case 'MultiLineString':
                return geometry.coordinates.reduce((count, line) => 
                    count + line.length, 0);
                
            case 'MultiPolygon':
                return geometry.coordinates.reduce((count, polygon) => 
                    count + polygon.reduce((ringCount, ring) => 
                        ringCount + ring.length, 0), 0);
                
            default:
                console.warn(`Unknown geometry type: ${geometry.type}`);
                return 0;
        }
    } catch (error) {
        console.error('Error counting vertices:', error);
        return 0;
    }
}

/**
 * Check if a feature can be safely edited in Terra Draw
 * @param {Object} feature - GeoJSON feature
 * @param {number} [maxVertices] - Maximum allowed vertices
 * @returns {boolean} True if feature can be edited
 */
export function canEditFeature(feature, maxVertices = GEOMETRY_PERFORMANCE_CONFIG.MAX_VERTICES_FOR_EDITING) {
    if (!feature || !feature.geometry) return false;
    
    const vertexCount = getVertexCount(feature.geometry);
    return vertexCount <= maxVertices;
}

/**
 * Get performance analysis for a feature
 * @param {Object} feature - GeoJSON feature
 * @returns {Object} Performance analysis object
 */
export function analyzeFeaturePerformance(feature) {
    if (!feature || !feature.geometry) {
        return {
            canEdit: false,
            canDisplay: false,
            vertexCount: 0,
            complexity: 'invalid',
            recommendedAction: 'invalid_feature',
            isVeryComplex: false,
        };
    }
    
    const vertexCount = getVertexCount(feature.geometry);
    const canEdit = vertexCount <= GEOMETRY_PERFORMANCE_CONFIG.MAX_VERTICES_FOR_EDITING;
    const canDisplay = vertexCount <= GEOMETRY_PERFORMANCE_CONFIG.MAX_VERTICES_FOR_DISPLAY;
    
    let complexity, recommendedAction;
    let isVeryComplex = false;
    
    if (vertexCount <= 50) {
        complexity = 'simple';
        recommendedAction = 'edit_directly';
    } else if (vertexCount <= 150) {
        complexity = 'moderate';
        recommendedAction = canEdit ? 'edit_directly' : 'simplify_then_edit';
    } else if (vertexCount <= 300) {
        complexity = 'complex';
        recommendedAction = 'simplify_then_edit';
    } else if (vertexCount <= 1000) {
        complexity = 'very_complex';
        recommendedAction = 'use_deckgl_or_simplify';
    } else {
        complexity = 'extremely_complex';
        recommendedAction = 'use_deckgl_only';
        isVeryComplex = true;
    }
    
    return {
        canEdit,
        canDisplay,
        vertexCount,
        complexity,
        isVeryComplex,
        recommendedAction,
        estimatedProcessingTime: Math.ceil(vertexCount / 1000) * 100, // Rough estimate in ms
    };
}

/**
 * Analyze an entire dataset to determine if it should use DeckGL instead of Terra Draw
 * This checks total feature count, total vertices, and point-specific limits
 * @param {Array} features - Array of GeoJSON features
 * @returns {Object} Dataset analysis with recommendation
 */
export function analyzeDatasetPerformance(features) {
    if (!features || !Array.isArray(features)) {
        return {
            totalFeatures: 0,
            totalVertices: 0,
            pointCount: 0,
            shouldUseDeckGL: false,
            reason: null,
        };
    }

    let totalVertices = 0;
    let pointCount = 0;

    for (const feature of features) {
        if (!feature?.geometry) continue;

        const vertexCount = getVertexCount(feature.geometry);
        totalVertices += vertexCount;

        if (feature.geometry.type === 'Point') {
            pointCount += 1;
        } else if (feature.geometry.type === 'MultiPoint') {
            pointCount += feature.geometry.coordinates.length;
        }
    }

    const totalFeatures = features.length;
    let shouldUseDeckGL = false;
    let reason = null;

    if (totalFeatures > GEOMETRY_PERFORMANCE_CONFIG.MAX_FEATURES_FOR_TERRA_DRAW) {
        shouldUseDeckGL = true;
        reason = sprintf(
            _t('%s features exceeds limit of %s'),
            totalFeatures,
            GEOMETRY_PERFORMANCE_CONFIG.MAX_FEATURES_FOR_TERRA_DRAW
        );
    } else if (totalVertices > GEOMETRY_PERFORMANCE_CONFIG.MAX_TOTAL_VERTICES_FOR_TERRA_DRAW) {
        shouldUseDeckGL = true;
        reason = sprintf(
            _t('%s total vertices exceeds limit of %s'),
            totalVertices,
            GEOMETRY_PERFORMANCE_CONFIG.MAX_TOTAL_VERTICES_FOR_TERRA_DRAW
        );
    } else if (pointCount > GEOMETRY_PERFORMANCE_CONFIG.MAX_POINTS_FOR_TERRA_DRAW) {
        shouldUseDeckGL = true;
        reason = sprintf(
            _t('%s points exceeds limit of %s'),
            pointCount,
            GEOMETRY_PERFORMANCE_CONFIG.MAX_POINTS_FOR_TERRA_DRAW
        );
    }

    return {
        totalFeatures,
        totalVertices,
        pointCount,
        shouldUseDeckGL,
        reason,
    };
}

/**
 * Simplify geometry coordinates using Douglas-Peucker algorithm
 * @param {Array} coordinates - Coordinate array to simplify
 * @param {number} tolerance - Simplification tolerance
 * @returns {Array} Simplified coordinate array
 */
export function simplifyCoordinates(coordinates, tolerance = GEOMETRY_PERFORMANCE_CONFIG.SIMPLIFICATION_TOLERANCE, minPoints = 2) {
    if (!Array.isArray(coordinates) || coordinates.length <= minPoints) {
        return coordinates;
    }
    
    // Simple implementation of Douglas-Peucker algorithm with minimum point constraint
    function douglasPeucker(points, tolerance, minPoints) {
        if (points.length <= minPoints) return points;
        
        let maxDistance = 0;
        let maxIndex = 0;
        const start = points[0];
        const end = points[points.length - 1];
        
        // Find the point with maximum distance from the line
        for (let i = 1; i < points.length - 1; i++) {
            const distance = perpendicularDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }
        
        // If max distance is greater than tolerance, recursively simplify
        if (maxDistance > tolerance) {
            const leftSegment = douglasPeucker(points.slice(0, maxIndex + 1), tolerance, Math.ceil(minPoints / 2));
            const rightSegment = douglasPeucker(points.slice(maxIndex), tolerance, Math.ceil(minPoints / 2));
            
            // Combine segments, removing duplicate point
            const combined = leftSegment.slice(0, -1).concat(rightSegment);
            
            // Ensure we don't go below minimum points
            if (combined.length >= minPoints) {
                return combined;
            }
        }
        
        // If we would go below minimum points, keep more points
        if (points.length <= minPoints) {
            return points;
        }
        
        // Return start, end, and at least one intermediate point for polygons
        if (minPoints >= 3 && maxIndex > 0) {
            return [start, points[maxIndex], end];
        }
        
        // For lines, return start and end points
        return [start, end];
    }
    
    return douglasPeucker(coordinates, tolerance, minPoints);
}

/**
 * Calculate perpendicular distance from a point to a line
 * @param {Array} point - Point coordinates [x, y]
 * @param {Array} lineStart - Line start coordinates [x, y]
 * @param {Array} lineEnd - Line end coordinates [x, y]
 * @returns {number} Perpendicular distance
 */
function perpendicularDistance(point, lineStart, lineEnd) {
    const [px, py] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    
    if (dx === 0 && dy === 0) {
        // Line start and end are the same point
        return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }
    
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    const clampedT = Math.max(0, Math.min(1, t));
    
    const projectionX = x1 + clampedT * dx;
    const projectionY = y1 + clampedT * dy;
    
    return Math.sqrt((px - projectionX) ** 2 + (py - projectionY) ** 2);
}

/**
 * Simplify a GeoJSON geometry
 * @param {Object} geometry - GeoJSON geometry to simplify
 * @param {number} tolerance - Simplification tolerance
 * @returns {Object} Simplified geometry
 */
export function simplifyGeometry(geometry, tolerance = GEOMETRY_PERFORMANCE_CONFIG.SIMPLIFICATION_TOLERANCE) {
    if (!geometry || !geometry.coordinates) return geometry;
    
    try {
        const simplifiedGeometry = { ...geometry };
        
        switch (geometry.type) {
            case 'Point':
                // Points don't need simplification
                return geometry;
                
            case 'LineString':
                simplifiedGeometry.coordinates = simplifyCoordinates(geometry.coordinates, tolerance, 2);
                break;
                
            case 'Polygon':
                simplifiedGeometry.coordinates = geometry.coordinates.map(ring => {
                    const simplified = simplifyCoordinates(ring, tolerance, 4); // Minimum 4 points for closed polygon
                    // Ensure the polygon is closed (first and last points are the same)
                    if (simplified.length >= 4 && 
                        (simplified[0][0] !== simplified[simplified.length - 1][0] || 
                         simplified[0][1] !== simplified[simplified.length - 1][1])) {
                        simplified.push([...simplified[0]]); // Close the polygon
                    }
                    return simplified;
                });
                break;
                
            case 'MultiPoint':
                // MultiPoints don't need coordinate simplification, but we can thin them
                const step = Math.max(1, Math.floor(geometry.coordinates.length / 1000));
                simplifiedGeometry.coordinates = geometry.coordinates.filter((_, i) => i % step === 0);
                break;
                
            case 'MultiLineString':
                simplifiedGeometry.coordinates = geometry.coordinates.map(line => 
                    simplifyCoordinates(line, tolerance, 2)
                );
                break;
                
            case 'MultiPolygon':
                simplifiedGeometry.coordinates = geometry.coordinates.map(polygon =>
                    polygon.map(ring => {
                        const simplified = simplifyCoordinates(ring, tolerance, 4); // Minimum 4 points for closed polygon
                        // Ensure the polygon is closed
                        if (simplified.length >= 4 && 
                            (simplified[0][0] !== simplified[simplified.length - 1][0] || 
                             simplified[0][1] !== simplified[simplified.length - 1][1])) {
                            simplified.push([...simplified[0]]); // Close the polygon
                        }
                        return simplified;
                    })
                );
                break;
                
            default:
                console.warn(`Cannot simplify geometry type: ${geometry.type}`);
                return geometry;
        }
        
        return simplifiedGeometry;
    } catch (error) {
        console.error('Error simplifying geometry:', error);
        return geometry;
    }
}

/**
 * Create an ultra-simplified version for extremely complex features
 * @param {Object} feature - Original GeoJSON feature
 * @returns {Object} Ultra-simplified feature
 */
export function createUltraSimplifiedFeature(feature) {
    if (!feature) return null;
    
    const analysis = analyzeFeaturePerformance(feature);
    
    // SIMPLE FIX: Instead of bounding box, just return original feature with warning
    // Terra Draw can handle complex features, it just might be slow
    if (analysis.vertexCount > GEOMETRY_PERFORMANCE_CONFIG.TERRA_DRAW_FREEZE_THRESHOLD) {
        console.warn(`⚠️ Complex feature detected with ${analysis.vertexCount} vertices. Proceeding without simplification - Terra Draw may be slow.`);
        
        // Return original feature with metadata indicating it's complex
        return {
            ...feature,
            properties: {
                ...feature.properties,
                _complexFeature: true,
                _originalVertexCount: analysis.vertexCount,
                _warningMessage: sprintf(_t('Complex feature with %s vertices - editing may be slow'), analysis.vertexCount),
            }
        };
    }
    
    return feature;
}

/**
 * Validate if a geometry is valid for rendering
 * @param {Object} geometry - GeoJSON geometry to validate
 * @returns {boolean} True if geometry is valid
 */
export function isValidGeometry(geometry) {
    if (!geometry || !geometry.coordinates || !geometry.type) {
        return false;
    }
    
    try {
        switch (geometry.type) {
            case 'Point':
                return Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2;
                
            case 'LineString':
                return Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2;
                
            case 'Polygon':
                if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return false;
                // Check each ring has at least 4 points (including closing point)
                return geometry.coordinates.every(ring => 
                    Array.isArray(ring) && ring.length >= 4
                );
                
            case 'MultiPoint':
                return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0;
                
            case 'MultiLineString':
                if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return false;
                return geometry.coordinates.every(line => 
                    Array.isArray(line) && line.length >= 2
                );
                
            case 'MultiPolygon':
                if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return false;
                return geometry.coordinates.every(polygon =>
                    Array.isArray(polygon) && polygon.length > 0 &&
                    polygon.every(ring => Array.isArray(ring) && ring.length >= 4)
                );
                
            default:
                return false;
        }
    } catch (error) {
        console.error('Error validating geometry:', error);
        return false;
    }
}

/**
 * Calculate bounding box of a geometry
 * @param {Object} geometry - GeoJSON geometry
 * @returns {Object|null} Bounding box {minX, maxX, minY, maxY}
 */
function calculateGeometryBounds(geometry) {
    if (!geometry || !geometry.coordinates) return null;
    
    const bounds = {
        minX: Infinity, maxX: -Infinity,
        minY: Infinity, maxY: -Infinity
    };
    
    const processCoordinates = (coords) => {
        if (typeof coords[0] === 'number') {
            // Single coordinate pair
            bounds.minX = Math.min(bounds.minX, coords[0]);
            bounds.maxX = Math.max(bounds.maxX, coords[0]);
            bounds.minY = Math.min(bounds.minY, coords[1]);
            bounds.maxY = Math.max(bounds.maxY, coords[1]);
        } else {
            // Nested coordinates
            coords.forEach(processCoordinates);
        }
    };
    
    try {
        processCoordinates(geometry.coordinates);
        return bounds;
    } catch (error) {
        console.error('Error calculating geometry bounds:', error);
        return null;
    }
}

/**
 * Create a simplified version of a feature for editing
 * @param {Object} feature - Original GeoJSON feature
 * @param {number} tolerance - Simplification tolerance
 * @returns {Object} Simplified feature with metadata
 */
export function createEditableFeature(feature, tolerance = GEOMETRY_PERFORMANCE_CONFIG.SIMPLIFICATION_TOLERANCE) {
    if (!feature) return null;

    const analysis = analyzeFeaturePerformance(feature);

    if (analysis.canEdit) {
        // Feature is already editable, return as-is
        return {
            feature,
            isSimplified: false,
            originalVertexCount: analysis.vertexCount,
            simplifiedVertexCount: analysis.vertexCount,
            analysis
        };
    }

    // Iterative simplification - keep simplifying until we reach target vertex count
    const targetVertexCount = GEOMETRY_PERFORMANCE_CONFIG.MAX_VERTICES_FOR_EDITING;
    const maxIterations = 10;
    let currentFeature = feature;
    let currentVertexCount = analysis.vertexCount;
    let usedTolerance = tolerance;
    let iterations = 0;

    // Start with aggressive tolerance for very complex features
    if (currentVertexCount > GEOMETRY_PERFORMANCE_CONFIG.TERRA_DRAW_FREEZE_THRESHOLD) {
        usedTolerance = GEOMETRY_PERFORMANCE_CONFIG.AGGRESSIVE_SIMPLIFICATION_TOLERANCE;
        console.log(`⚠️ Extremely complex feature with ${currentVertexCount} vertices - starting with aggressive simplification`);
    }

    let lastValidFeature = null;
    let lastValidVertexCount = currentVertexCount;

    while (currentVertexCount > targetVertexCount && iterations < maxIterations) {
        iterations++;

        // Try simplification with current tolerance
        const simplifiedFeature = {
            ...currentFeature,
            geometry: simplifyGeometry(currentFeature.geometry, usedTolerance),
            properties: {
                ...currentFeature.properties,
                _simplified: true,
                _originalVertexCount: analysis.vertexCount,
                _simplificationTolerance: usedTolerance,
                _iterations: iterations
            }
        };

        // Validate the simplified feature
        if (!isValidGeometry(simplifiedFeature.geometry)) {
            console.warn(`⚠️ Iteration ${iterations}: Simplification with tolerance ${usedTolerance.toFixed(4)} produced invalid geometry`);

            // If we have a valid previous result, use it
            if (lastValidFeature) {
                console.log(`✓ Using last valid simplification: ${lastValidVertexCount} vertices`);
                break;
            }

            // Otherwise, try with smaller tolerance increase
            usedTolerance = usedTolerance * 0.9;
            continue;
        }

        const newVertexCount = getVertexCount(simplifiedFeature.geometry);
        console.log(`Iteration ${iterations}: ${currentVertexCount} → ${newVertexCount} vertices (tolerance: ${usedTolerance.toFixed(4)})`);

        // Save this valid result
        lastValidFeature = simplifiedFeature;
        lastValidVertexCount = newVertexCount;
        currentFeature = simplifiedFeature;
        currentVertexCount = newVertexCount;

        // If we've reached the target, we're done
        if (currentVertexCount <= targetVertexCount) {
            console.log(`✓ Target reached: ${currentVertexCount} vertices`);
            break;
        }

        // Check if we're making progress
        const oldVertexCount = lastValidVertexCount;
        lastValidVertexCount = newVertexCount;
        const reductionRatio = oldVertexCount > 0 ? (1 - newVertexCount / oldVertexCount) * 100 : 0;

        if (reductionRatio < 5 && iterations > 1) {
            // Less than 5% reduction, need more aggressive tolerance
            usedTolerance = usedTolerance * 1.5;
            console.log(`⚠️ Low reduction (${reductionRatio.toFixed(1)}%), increasing tolerance to ${usedTolerance.toFixed(4)}`);
        } else {
            // Good progress, increase tolerance moderately
            usedTolerance = usedTolerance * 1.2;
        }
    }

    // Use the best result we achieved
    const finalFeature = lastValidFeature || currentFeature;
    const finalVertexCount = lastValidVertexCount;
    const simplifiedAnalysis = analyzeFeaturePerformance(finalFeature);

    if (finalVertexCount > targetVertexCount) {
        console.warn(`⚠️ Could not reach target vertex count after ${iterations} iterations. Final: ${finalVertexCount} (target: ${targetVertexCount})`);
    }

    return {
        feature: finalFeature,
        isSimplified: finalVertexCount !== analysis.vertexCount,
        isAggressivelySimplified: usedTolerance >= GEOMETRY_PERFORMANCE_CONFIG.AGGRESSIVE_SIMPLIFICATION_TOLERANCE,
        originalVertexCount: analysis.vertexCount,
        simplifiedVertexCount: finalVertexCount,
        reductionRatio: (1 - finalVertexCount / analysis.vertexCount) * 100,
        analysis: simplifiedAnalysis,
        originalAnalysis: analysis,
        tolerance: usedTolerance,
        iterations: iterations
    };
}

/**
 * Process large geometries in chunks to avoid blocking the UI
 * @param {Array} features - Array of features to process
 * @param {Function} processor - Processing function for each feature
 * @param {Function} onProgress - Progress callback
 * @returns {Promise} Promise that resolves when all features are processed
 */
export async function processLargeGeometriesAsync(features, processor, onProgress) {
    const results = [];
    const chunkSize = GEOMETRY_PERFORMANCE_CONFIG.CHUNK_SIZE;
    
    for (let i = 0; i < features.length; i += chunkSize) {
        const chunk = features.slice(i, i + chunkSize);
        const chunkResults = [];
        
        // Process chunk
        for (const feature of chunk) {
            try {
                const result = await processor(feature);
                chunkResults.push(result);
            } catch (error) {
                console.error('Error processing feature:', error);
                chunkResults.push(null);
            }
        }
        
        results.push(...chunkResults);
        
        // Update progress
        if (onProgress) {
            const progress = Math.min(100, Math.round(((i + chunkSize) / features.length) * 100));
            onProgress(progress, i + chunkSize, features.length);
        }
        
        // Yield control to prevent UI blocking
        if (i + chunkSize < features.length) {
            await new Promise(resolve => setTimeout(resolve, GEOMETRY_PERFORMANCE_CONFIG.PROCESSING_DELAY));
        }
    }
    
    return results;
}

/**
 * Create adaptive simplified geometry that targets a specific vertex count
 * Uses uniform sampling to preserve shape while hitting target complexity
 * @param {Object} geometry - GeoJSON geometry to simplify
 * @param {number} targetVertexCount - Target number of vertices
 * @returns {Object} Adaptively simplified geometry
 */
export function createAdaptiveSimplifiedGeometry(geometry, targetVertexCount) {
    if (!geometry || !geometry.coordinates) return geometry;
    
    const currentVertexCount = getVertexCount(geometry);
    if (currentVertexCount <= targetVertexCount) return geometry;
    
    const samplingRatio = targetVertexCount / currentVertexCount;
    
    try {
        const simplifiedGeometry = { ...geometry };
        
        switch (geometry.type) {
            case 'Point':
                return geometry; // Points can't be simplified
                
            case 'LineString':
                simplifiedGeometry.coordinates = sampleCoordinatesUniformly(geometry.coordinates, samplingRatio);
                break;
                
            case 'Polygon':
                simplifiedGeometry.coordinates = geometry.coordinates.map(ring => 
                    sampleCoordinatesUniformly(ring, samplingRatio)
                );
                break;
                
            case 'MultiLineString':
                simplifiedGeometry.coordinates = geometry.coordinates.map(line => 
                    sampleCoordinatesUniformly(line, samplingRatio)
                );
                break;
                
            case 'MultiPolygon':
                simplifiedGeometry.coordinates = geometry.coordinates.map(polygon =>
                    polygon.map(ring => sampleCoordinatesUniformly(ring, samplingRatio))
                );
                break;
                
            default:
                return geometry;
        }
        
        return simplifiedGeometry;
    } catch (error) {
        console.error('Error in adaptive simplification:', error);
        return geometry;
    }
}

/**
 * Sample coordinates uniformly to achieve target sampling ratio
 * @param {Array} coordinates - Original coordinates
 * @param {number} samplingRatio - Ratio of points to keep (0-1)
 * @returns {Array} Sampled coordinates
 */
function sampleCoordinatesUniformly(coordinates, samplingRatio) {
    if (!Array.isArray(coordinates) || coordinates.length <= 2) {
        return coordinates;
    }
    
    const targetCount = Math.max(2, Math.floor(coordinates.length * samplingRatio));
    const step = coordinates.length / targetCount;
    const sampled = [];
    
    // Always include first point
    sampled.push(coordinates[0]);
    
    // Sample intermediate points uniformly
    for (let i = 1; i < targetCount - 1; i++) {
        const index = Math.floor(i * step);
        if (index < coordinates.length && index !== 0 && index !== coordinates.length - 1) {
            sampled.push(coordinates[index]);
        }
    }
    
    // Always include last point (important for closed polygons)
    if (coordinates.length > 1) {
        sampled.push(coordinates[coordinates.length - 1]);
    }
    
    return sampled;
}

/**
 * Estimate memory usage for a geometry
 * @param {Object} geometry - GeoJSON geometry
 * @returns {number} Estimated memory usage in bytes
 */
export function estimateGeometryMemoryUsage(geometry) {
    if (!geometry || !geometry.coordinates) return 0;
    
    const vertexCount = getVertexCount(geometry);
    const bytesPerVertex = 16; // Rough estimate: 2 doubles (8 bytes each)
    const overheadBytes = 100; // Object overhead
    
    return (vertexCount * bytesPerVertex) + overheadBytes;
}

/**
 * Generate performance warning messages
 * @param {Object} analysis - Performance analysis object
 * @returns {Object} Warning message object
 */
export function getPerformanceWarning(analysis) {
    if (!analysis) return null;
    
    const messages = {
        simple: null,
        moderate: null,
        complex: {
            title: _t('Complex Feature Detected'),
            message: sprintf(_t('This feature has %s vertices. Editing may be slow.'), analysis.vertexCount),
            suggestion: _t('Consider simplifying the feature for better performance.'),
        },
        very_complex: {
            title: _t('Very Complex Feature'),
            message: sprintf(_t('This feature has %s vertices. Terra Draw may freeze during editing.'), analysis.vertexCount),
            suggestion: _t('Strongly recommend simplifying or using the high-performance Deck.gl renderer for editing.'),
        },
        extremely_complex: {
            title: _t('Extremely Complex Feature'),
            message: sprintf(_t('This feature has %s vertices. It will be automatically simplified to preserve shape while maintaining Terra Draw performance.'), analysis.vertexCount),
            suggestion: _t('The feature will be simplified while preserving its essential shape. Use Deck.gl renderer for full detail visualization.'),
        }
    };
    
    return messages[analysis.complexity];
}