import { PolygonShape } from './shapes/polygon_shape';
import { CircleShape } from './shapes/circle_shape';
import { RectangleShape } from './shapes/rectangle_shape';

export class ShapeFactory {
    static createShape(type, overlay, id) {
        switch (type) {
            case google.maps.drawing.OverlayType.POLYGON:
                return new PolygonShape(overlay, id);
            case google.maps.drawing.OverlayType.CIRCLE:
                return new CircleShape(overlay, id);
            case google.maps.drawing.OverlayType.RECTANGLE:
                return new RectangleShape(overlay, id);
            default:
                throw new Error(`Unsupported shape type: ${type}`);
        }
    }

    static fromJSON(data, map, options = {}, id = null) {
        switch (data.type) {
            case google.maps.drawing.OverlayType.POLYGON:
                return PolygonShape.fromJSON(data, map, options, id);
            case google.maps.drawing.OverlayType.CIRCLE:
                return CircleShape.fromJSON(data, map, options, id);
            case google.maps.drawing.OverlayType.RECTANGLE:
                return RectangleShape.fromJSON(data, map, options, id);
            default:
                throw new Error(`Unsupported shape type: ${data.type}`);
        }
    }
}
