/**
 * @fileoverview Nebula.gl Configuration for High-Performance Map Editing
 * 
 * This module configures Nebula.gl (Deck.gl's editing extension) to replace Terra Draw
 * for drawing and editing geospatial features on Google Maps. Nebula.gl provides
 * GPU-accelerated editing capabilities that can handle complex geometries without
 * performance issues.
 * 
 * Key Features:
 * - GPU-accelerated editing with WebGL
 * - No vertex count limitations
 * - Smooth editing of complex geometries
 * - Built-in undo/redo support
 * - Multiple editing modes
 * 
 * @author Yopi Angi - https://github.com/gityopie
 * @version 1.0.0
 * @requires Nebula.gl Library
 * @requires Deck.gl Library
 */

/**
 * Nebula.gl configuration constants
 */
export const NEBULA_CONFIG = {
    // Editing modes
    MODES: {
        VIEW: 'ViewMode',
        DRAW_POINT: 'DrawPointMode',
        DRAW_LINE: 'DrawLineStringMode', 
        DRAW_POLYGON: 'DrawPolygonMode',
        DRAW_RECTANGLE: 'DrawRectangleMode',
        DRAW_CIRCLE: 'DrawCircleFromCenterMode',
        MODIFY: 'ModifyMode',
        TRANSLATE: 'TranslateMode',
        ROTATE: 'RotateMode',
        SCALE: 'ScaleMode',
        SELECT: 'SelectionMode'
    },
    
    // Layer configuration
    LAYER_CONFIG: {
        id: 'editable-geojson-layer',
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 0, 128], // Yellow highlight
        
        // Style configuration
        getFillColor: [0, 0, 255, 80],       // Blue fill with transparency
        getLineColor: [0, 0, 255, 255],      // Blue outline
        getLineWidth: 2,
        getPointRadius: 5,
        
        // Selection styling
        selectedFillColor: [255, 165, 0, 100], // Orange fill when selected
        selectedLineColor: [255, 165, 0, 255], // Orange outline when selected
        selectedLineWidth: 3,
        
        // Editing styling
        editingFillColor: [255, 0, 0, 80],    // Red fill while editing
        editingLineColor: [255, 0, 0, 255],   // Red outline while editing
        editingLineWidth: 2,
        
        // Tentative styling (while drawing)
        tentativeFillColor: [128, 128, 128, 60], // Gray fill for tentative features
        tentativeLineColor: [128, 128, 128, 255], // Gray outline for tentative features
        tentativeLineWidth: 1,
    },
    
    // Edit handles (control points)
    EDIT_HANDLES: {
        type: 'existing', // Use existing points as edit handles
        size: 8,
        color: [255, 255, 255, 255], // White handles
        outlineColor: [0, 0, 0, 255], // Black outline
        hoverColor: [255, 255, 0, 255], // Yellow on hover
    },
    
    // Snapping configuration
    SNAPPING: {
        enabled: true,
        threshold: 10, // pixels
        snapToVertices: true,
        snapToMidpoints: true,
        snapToIntersections: false, // Can be performance intensive
    },
    
    // Interaction settings
    INTERACTION: {
        doubleClickToFinish: true,
        escapeKeyToCancel: true,
        deleteKeyToDelete: true,
        enableKeyboardShortcuts: true,
    },
    
    // Performance settings
    PERFORMANCE: {
        maxFeatures: 50000,        // Maximum features in editing layer
        maxVerticesPerFeature: 10000, // No limit like Terra Draw had
        enableLOD: false,          // Level of detail not needed with GPU acceleration
        updateTrigger: 'onEdit',   // When to update the layer
    },
    
    // Measurement integration
    MEASUREMENTS: {
        enabled: true,
        showWhileDrawing: true,
        showOnHover: true,
        precision: 2, // Decimal places
        units: 'metric', // 'metric' or 'imperial'
    }
};

/**
 * Drawing tool button configuration
 * Maps drawing tools to Nebula.gl modes and UI elements
 */
export const DRAWING_TOOLS = {
    'select': {
        mode: NEBULA_CONFIG.MODES.VIEW,
        icon: 'fa-mouse-pointer',
        title: 'Select and Edit Features',
        cursor: 'default',
        allowsEditing: true
    },
    'point': {
        mode: NEBULA_CONFIG.MODES.DRAW_POINT,
        icon: 'fa-map-pin',
        title: 'Draw Point',
        cursor: 'crosshair',
        geometryType: 'Point'
    },
    'line': {
        mode: NEBULA_CONFIG.MODES.DRAW_LINE,
        icon: 'fa-minus',
        title: 'Draw Line',
        cursor: 'crosshair', 
        geometryType: 'LineString'
    },
    'polygon': {
        mode: NEBULA_CONFIG.MODES.DRAW_POLYGON,
        icon: 'fa-draw-polygon',
        title: 'Draw Polygon',
        cursor: 'crosshair',
        geometryType: 'Polygon'
    },
    'rectangle': {
        mode: NEBULA_CONFIG.MODES.DRAW_RECTANGLE,
        icon: 'fa-square-o',
        title: 'Draw Rectangle', 
        cursor: 'crosshair',
        geometryType: 'Polygon'
    },
    'circle': {
        mode: NEBULA_CONFIG.MODES.DRAW_CIRCLE,
        icon: 'fa-circle-o',
        title: 'Draw Circle',
        cursor: 'crosshair',
        geometryType: 'Polygon'
    }
};

/**
 * Editing mode configuration
 * Different modes for editing existing features
 */
export const EDITING_MODES = {
    'modify': {
        mode: NEBULA_CONFIG.MODES.MODIFY,
        icon: 'fa-edit',
        title: 'Modify Feature Shape',
        description: 'Add, move, or delete vertices'
    },
    'translate': {
        mode: NEBULA_CONFIG.MODES.TRANSLATE,
        icon: 'fa-arrows',
        title: 'Move Feature',
        description: 'Drag to move the entire feature'
    },
    'rotate': {
        mode: NEBULA_CONFIG.MODES.ROTATE,
        icon: 'fa-rotate-right',
        title: 'Rotate Feature',
        description: 'Rotate the feature around its center'
    },
    'scale': {
        mode: NEBULA_CONFIG.MODES.SCALE,
        icon: 'fa-expand-arrows-alt',
        title: 'Scale Feature', 
        description: 'Resize the feature proportionally'
    }
};

/**
 * Keyboard shortcuts configuration
 */
export const KEYBOARD_SHORTCUTS = {
    // Tool selection
    'KeyV': 'select',      // V for selection/view mode
    'KeyP': 'point',       // P for point
    'KeyL': 'line',        // L for line  
    'KeyO': 'polygon',     // O for polygon (P was taken)
    'KeyR': 'rectangle',   // R for rectangle
    'KeyC': 'circle',      // C for circle
    
    // Editing modes
    'KeyM': 'modify',      // M for modify
    'KeyT': 'translate',   // T for translate/move
    'KeyY': 'rotate',      // Y for rotate (R was taken)
    'KeyS': 'scale',       // S for scale
    
    // Actions
    'Escape': 'cancel',    // Cancel current operation
    'Enter': 'finish',     // Finish current drawing
    'Delete': 'delete',    // Delete selected features
    'Backspace': 'delete', // Alternative delete key
    
    // With modifiers
    'ctrl+KeyZ': 'undo',   // Undo
    'ctrl+KeyY': 'redo',   // Redo
    'ctrl+KeyA': 'selectAll', // Select all
    'ctrl+KeyC': 'copy',   // Copy
    'ctrl+KeyV': 'paste',  // Paste
};

/**
 * Default styling function for features based on their state
 */
export function getFeatureStyle(feature, isSelected = false, isEditing = false, isTentative = false) {
    if (isTentative) {
        return {
            getFillColor: NEBULA_CONFIG.LAYER_CONFIG.tentativeFillColor,
            getLineColor: NEBULA_CONFIG.LAYER_CONFIG.tentativeLineColor,
            getLineWidth: NEBULA_CONFIG.LAYER_CONFIG.tentativeLineWidth,
        };
    }
    
    if (isEditing) {
        return {
            getFillColor: NEBULA_CONFIG.LAYER_CONFIG.editingFillColor,
            getLineColor: NEBULA_CONFIG.LAYER_CONFIG.editingLineColor,
            getLineWidth: NEBULA_CONFIG.LAYER_CONFIG.editingLineWidth,
        };
    }
    
    if (isSelected) {
        return {
            getFillColor: NEBULA_CONFIG.LAYER_CONFIG.selectedFillColor,
            getLineColor: NEBULA_CONFIG.LAYER_CONFIG.selectedLineColor,
            getLineWidth: NEBULA_CONFIG.LAYER_CONFIG.selectedLineWidth,
        };
    }
    
    // Default styling
    const color = feature.properties?.color ? hexToRgb(feature.properties.color) : null;
    
    return {
        getFillColor: color ? [...color, 80] : NEBULA_CONFIG.LAYER_CONFIG.getFillColor,
        getLineColor: color ? [...color, 255] : NEBULA_CONFIG.LAYER_CONFIG.getLineColor,
        getLineWidth: NEBULA_CONFIG.LAYER_CONFIG.getLineWidth,
    };
}

/**
 * Convert hex color to RGB array
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
}

/**
 * Generate unique ID for new features
 */
export function generateFeatureId() {
    return 'nebula-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

/**
 * Validate if a mode is supported
 */
export function isSupportedMode(mode) {
    return Object.values(NEBULA_CONFIG.MODES).includes(mode);
}

/**
 * Get tool configuration by key
 */
export function getToolConfig(toolKey) {
    return DRAWING_TOOLS[toolKey] || EDITING_MODES[toolKey] || null;
}

/**
 * Export configuration object for easy importing
 */
export default {
    NEBULA_CONFIG,
    DRAWING_TOOLS,
    EDITING_MODES,
    KEYBOARD_SHORTCUTS,
    getFeatureStyle,
    generateFeatureId,
    isSupportedMode,
    getToolConfig
};