

/**
 * Deck.gl configuration constants
 */
export const DECKGL_CONFIG = {
    // Visual styling
    DEFAULT_COLORS: {
        FILL: [70, 130, 180, 80], // Steel blue with 80% opacity
        STROKE: [25, 25, 112, 255], // Midnight blue
        SELECTED_FILL: [0, 123, 255, 120], // Bright blue with transparency
        SELECTED_STROKE: [0, 86, 179, 255], // Deep blue
        HOVERED_FILL: [255, 165, 0, 120], // Gold with transparency
        HOVERED_STROKE: [255, 140, 0, 255], // Dark orange
    },
};

/** 
 * Stroke configuration constants
 */
export const STROKE_CONFIG = { 
    DEFAULT_WIDTH: 2, // Default stroke width in pixels
    HOVER_WIDTH: 4,   // Stroke width on hover in pixels
};

/**
 * Google Maps configuration constants
 */
export const MAP_OPTIONS = {
    mapTypeId: 'satellite',
    center: { lat: 0, lng: 0 },
    zoom: 4,
    minZoom: 2,
    maxZoom: 22,
    fullscreenControl: true,
    mapTypeControl: true,
    gestureHandling: 'cooperative',
};
