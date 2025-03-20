import { BaseShape } from './base_shape';
import { MapConfig } from '../map_config';
import { MapUtils } from '../map_utils';

export class RectangleShape extends BaseShape {
    constructor(overlay, id) {
        super(overlay, id);
        this.shape.type = 'rectangle';
    }

    getType() {
        return 'rectangle';
    }

    getArea() {
        return MapUtils.calculateRectangleArea(this.shape);
    }

    getDimensions() {
        const { width, height } = MapUtils.calculateRectangleDimentions(this.shape);
        return {
            gshape_radius: 0.0,
            gshape_width: width,
            gshape_height: height,
        };
    }

    toJSON() {
        return {
            type: this.getType(),
            options: {
                bounds: this.getBounds().toJSON(),
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
        const shapeOptions = Object.assign({}, MapConfig.DEFAULT_SHAPE_OPTIONS.rectangleOptions, options);
        const rectangle = new google.maps.Rectangle({
            map: map,
            bounds: data.options.bounds,
            ...shapeOptions,
        });
        return new RectangleShape(rectangle, id);
    }
}
