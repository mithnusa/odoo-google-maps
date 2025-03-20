
const COLORS = {
    DISPLAY: '#006ee5',
    EDIT: '#ffa187',
    STROKE: '#fc6c44',
};

export const MapConfig = {
    DRAWING_MODES: [
        'circle',
        'polygon',
        'rectangle',
    ],

    COLORS: COLORS,

    DEFAULT_SHAPE_OPTIONS: {
        polygonOptions: {
            strokeWeight: 2.0,
            fillOpacity: 0.35,
            editable: false,
            strokeColor: COLORS.DISPLAY,
            fillColor: COLORS.DISPLAY,
        },
        circleOptions: {
            strokeWeight: 2.0,
            fillOpacity: 0.35,
            editable: false,
            strokeColor: COLORS.DISPLAY,
            fillColor: COLORS.DISPLAY,
        },
        rectangleOptions: {
            strokeWeight: 2.0,
            fillOpacity: 0.35,
            editable: false,
            strokeColor: COLORS.DISPLAY,
            fillColor: COLORS.DISPLAY,
        },
    },

    SHAPE_EDITING_OPTIONS: {
        strokeColor: '#ffa187',
        fillColor: '#ffa187',
        strokeWeight: 2.0,
        fillOpacity: 0.45,
        editable: true
    },

    DEBOUNCE_DELAY: 500,

    MAP_OPTIONS: {
        mapTypeId: 'satellite',
        center: { lat: 0, lng: 0 },
        zoom: 4,
        minZoom: 2,
        maxZoom: 22,
        fullscreenControl: true,
        mapTypeControl: true,
        gestureHandling: 'cooperative',
    },
};
