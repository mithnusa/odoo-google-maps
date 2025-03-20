import { BaseShape } from './base_shape';
import { MapConfig } from '../map_config';
import { MapUtils } from '../map_utils';

export class CircleShape extends BaseShape {
    constructor(overlay, id) {
        super(overlay, id);
        this.shape.type = 'circle';
    }

    getType() {
        return 'circle';
    }

    getArea() {
        const radius = this.shape.getRadius();
        return Math.PI * radius * radius;
    }

    getDimensions() {
        return {
            gshape_radius: this.shape.getRadius(),
            gshape_width: 0.0,
            gshape_height: 0.0,
        };
    }

    toJSON() {
        const center = MapUtils.calculateCenterPointOfCircle(this.shape);
        return {
            type: this.getType(),
            options: {
                radius: this.shape.getRadius(),
                center,
            },
        };
    }

    getBounds() {
        return this.shape.getBounds();
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
            MapConfig.DEFAULT_SHAPE_OPTIONS.circleOptions,
            options
        );
        const circle = new google.maps.Circle({
            map: map,
            center: data.options.center,
            radius: data.options.radius,
            ...shapeOptions,
        });
        return new CircleShape(circle, id);
    }
}
