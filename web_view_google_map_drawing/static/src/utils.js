export const MAP_CONFIG = {
    defaultCenter: { lat: 0, lng: 0 },
    defaultZoom: 4,
    minZoom: 2,
    maxZoom: 22,
    mapTypeId: 'roadmap',
    drawingModes: ['polygon', 'rectangle', 'circle'],
    colors: {
        display: '#006ee5',
        edit: '#ffa187',
        stroke: '#fc6c44',
    },
};

export const SHAPE_OPTIONS = {
    polygon: {
        strokeWeight: 2.0,
        fillOpacity: 0.35,
        editable: false,
        draggable: false,
    },
    circle: {
        strokeWeight: 2.0,
        fillOpacity: 0.35,
        editable: false,
        draggable: false,
    },
    rectangle: {
        strokeWeight: 2.0,
        fillOpacity: 0.35,
        editable: false,
        draggable: false,
    },
};

export class ShapeBase {
    constructor(map, options) {
        this.map = map;
        this.shape = null;
        this.options = options;
    }

    setMap(map) {
        this.shape.setMap(map);
    }

    getArea() {
        throw new Error('Must be implemented by subclass');
    }

    toJSON() {
        throw new Error('Must be implemented by subclass');
    }
}

export class Polygon extends ShapeBase {
    constructor(map, options) {
        super(map, options);
        this.shape = new google.maps.Polygon({
            ...options,
            map,
        });
    }

    getArea() {
        return google.maps.geometry.spherical.computeArea(this.shape.getPath());
    }

    computeLines(paths) {
        let stop;
        let start;
        let count = 0;

        const lines = {};
        paths.forEach((latLng) => {
            start = stop;
            stop = latLng;
            if (start) {
                lines[count] = { start, stop };
            }
            count += 1;
        });

        const lines_len = Object.keys(lines).length;
        lines[lines_len + 1] = {
            start: lines[1].start,
            stop: lines[lines_len].stop,
        };

        Object.keys(lines).forEach((line) => {
            lines[line].length = google.maps.geometry.spherical.computeLength([
                lines[line].start,
                lines[line].stop,
            ]);
        });
        return lines;
    }

    toJSON() {
        const paths = this.shape
            .getPath()
            .getArray()
            .map((point) => ({
                lat: point.lat(),
                lng: point.lng(),
            }));
        const lines = this.computeLines(paths);
        return {
            type: 'polygon',
            options: {
                paths,
            },
            lines,
        };
    }
}
