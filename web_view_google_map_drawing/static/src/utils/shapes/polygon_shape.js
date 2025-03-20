import { BaseShape } from './base_shape';
import { MapConfig } from '../map_config';
import { MapUtils } from '../map_utils';

export class PolygonShape extends BaseShape {
    constructor(overlay, id) {
        super(overlay, id);
        this.shape.type = 'polygon';
    }

    getType() {
        return 'polygon';
    }

    getArea() {
        return google.maps.geometry.spherical.computeArea(this.shape.getPath());
    }

    getDimensions() {
        return {
            gshape_radius: 0.0,
            gshape_width: 0.0,
            gshape_height: 0.0,
        };
    }

    getBounds() {
        const bounds = new google.maps.LatLngBounds();
        this.shape.getPath().forEach((point) => bounds.extend(point));
        return bounds;
    }

    toJSON() {
        const paths = this.shape
            .getPath()
            .getArray()
            .map((point) => ({
                lat: point.lat(),
                lng: point.lng(),
            }));

        const lines = this._computeLines(paths);

        return {
            type: this.getType(),
            options: { paths },
            lines,
        };
    }

    _computeLines(paths) {
        let lines = {};
        let count = 0;
        let start, stop;

        paths.forEach((latLng) => {
            start = stop;
            stop = latLng;
            if (start) {
                lines[count] = {
                    start,
                    stop,
                    length: this._calculateDistance(start, stop),
                };
                count++;
            }
        });

        // Add closing line (last point to first point)
        if (paths.length > 2) {
            lines[count] = {
                start: paths[paths.length - 1],
                stop: paths[0],
                length: this._calculateDistance(paths[paths.length - 1], paths[0]),
            };
        }

        return lines;
    }

    _calculateDistance(point1, point2) {
        const start = new google.maps.LatLng(point1.lat, point1.lng);
        const end = new google.maps.LatLng(point2.lat, point2.lng);
        return MapUtils.calculateDistance(start, end);
    }

    setEditable(editable) {
        super.setEditable(editable);
        this.shape.setOptions({
            draggable: editable,
            editable: editable,
        });
    }

    static fromJSON(data, map, options = {}, id = null) {
        const shapeOptions = Object.assign(
            {},
            MapConfig.DEFAULT_SHAPE_OPTIONS.polygonOptions,
            options
        );
        const polygon = new google.maps.Polygon({
            map: map,
            paths: data.options.paths,
            ...shapeOptions,
        });
        return new PolygonShape(polygon, id);
    }
}
