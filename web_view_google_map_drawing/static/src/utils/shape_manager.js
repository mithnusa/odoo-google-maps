import { MapUtils } from './map_utils';

export class ShapeManager {
    constructor() {
        this.shapes = new Map();
        this.selectedShape = null;
    }

    addShape(shape) {
        // Remove any existing shapes first
        this.cleanup();

        this.shapes.set(shape.getId(), shape);
        this.selectShape(shape);
    }

    removeShape(shapeId) {
        if (this.shapes.has(shapeId)) {
            const shape = this.shapes.get(shapeId);
            if (this.selectedShape === shape) {
                this.selectedShape = null;
            }
            shape.remove();
            this.shapes.delete(shapeId);
        }
    }

    selectShape(shape) {
        if (this.selectedShape) {
            this.selectedShape.setEditable(false);
        }
        this.selectedShape = shape;
        shape.setEditable(true);
    }

    clearSelection() {
        if (this.selectedShape) {
            this.selectedShape.setEditable(false);
            this.selectedShape = null;
        }
    }

    hasSelectedShape() {
        return this.selectedShape !== null;
    }

    getSelectedShape() {
        return this.selectedShape;
    }

    getShape(shapeId) {
        return this.shapes.get(shapeId);
    }

    getAllShapes() {
        return Array.from(this.shapes.values());
    }

    cleanup() {
        this.getAllShapes().forEach((shape) => {
            if (shape.measurementLabels) {
                shape.measurementLabels.forEach((label) => {
                    if (label && label.setMap) {
                        label.setMap(null);
                    }
                });
            }
            shape.measurementLabels = [];
            shape.remove();
        });
        this.shapes.clear();
        this.shapes = new Map();
        this.selectedShape = null;
    }

    // Method to check if a shape exists
    hasShape(shapeId) {
        return this.shapes.has(shapeId);
    }

    // Method to get the count of shapes
    getShapeCount() {
        return this.shapes.size;
    }

    // Method to update a shape's properties
    updateShape(shapeId, properties) {
        const shape = this.shapes.get(shapeId);
        if (shape) {
            shape.getShape().setOptions(properties);
        }
    }
    // Add this method to your ShapeManager class
    calculatePerimeter(shape) {
        const type = shape.getType();
        switch (type) {
            case 'polygon':
                return this.calculatePolygonPerimeter(shape);
            case 'rectangle':
                return this.calculateRectanglePerimeter(shape);
            case 'circle':
                return this.calculateCirclePerimeter(shape);
            default:
                return 0;
        }
    }
    calculatePolygonPerimeter(shape) {
        const path = shape.getShape().getPath();
        let perimeter = 0;
        for (let i = 0; i < path.getLength(); i++) {
            const point1 = path.getAt(i);
            const point2 = path.getAt((i + 1) % path.getLength());
            perimeter += google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
        }
        return perimeter;
    }

    calculateRectanglePerimeter(shape) {
        const bounds = shape.getShape().getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const width = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(ne.lat(), sw.lng()),
            new google.maps.LatLng(ne.lat(), ne.lng())
        );
        const height = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(ne.lat(), sw.lng()),
            new google.maps.LatLng(sw.lat(), sw.lng())
        );
        return 2 * (width + height);
    }

    calculateCirclePerimeter(shape) {
        const radius = shape.getShape().getRadius();
        return 2 * Math.PI * radius;
    }

    // Add this helper method to properly remove labels
    removeMeasurementLabels(shape) {
        if (shape) {
            if (shape.measurementLabels) {
                shape.measurementLabels.forEach((label) => {
                    if (label) {
                        if (label.div && label.div.parentNode) {
                            label.div.parentNode.removeChild(label.div);
                        }
                        label.setMap(null);
                        delete label.div;
                        delete label.map;
                    }
                });
            }
            shape.measurementLabels = [];
        }
    }

    updateMeasurementLabel(shape, googleMap) {
        if (!shape) return;

        // Remove existing labels if any
        this.removeMeasurementLabels(shape);
        const shapeType = shape.getType();

        if (shapeType === 'polygon' || shapeType === 'rectangle') {
            // Add individual line measurements
            this.addLineSegmentMeasurements(shape, googleMap);
        }

        const area = shape.getArea();
        const areaText = `Area: ${this.formatMeasurement(area, true)}`;

        // Get label positions based on shape type
        const labelPositions = this.getLabelPositions(shape);

        // Create labels for each position
        labelPositions.forEach((position, index) => {
            if (index > 0) {
                const MapLabelOverlay = MapUtils.mapLabelOverlay();
                const label = new MapLabelOverlay({
                    position: position,
                    text: areaText,
                    map: googleMap,
                });
                shape.measurementLabels.push(label);
            }
        });
    }

    addLineSegmentMeasurements(shape, googleMap) {
        const shapeObj = shape.getShape();
        let vertices = [];

        if (shape.getType() === 'polygon') {
            const path = shapeObj.getPath();
            vertices = path.getArray();
            // Add first point again to close the polygon
            vertices.push(vertices[0]);
        } else if (shape.getType() === 'rectangle') {
            const bounds = shapeObj.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const nw = new google.maps.LatLng(ne.lat(), sw.lng());
            const se = new google.maps.LatLng(sw.lat(), ne.lng());
            vertices = [ne, se, sw, nw, ne]; // Create rectangle vertices
        }

        // Calculate and add labels for each line segment
        for (let i = 0; i < vertices.length - 1; i++) {
            const start = vertices[i];
            const end = vertices[i + 1];

            // Calculate midpoint for label placement
            const midPoint = new google.maps.LatLng(
                (start.lat() + end.lat()) / 2,
                (start.lng() + end.lng()) / 2
            );

            // Calculate distance
            const distance = google.maps.geometry.spherical.computeDistanceBetween(start, end);
            if (distance > 0) {
                console.log({ distance });
                // Create label
                const MapLabelOverlay = MapUtils.mapLabelOverlay();
                const label = new MapLabelOverlay({
                    position: midPoint,
                    text: this.formatMeasurement(distance),
                    map: googleMap,
                    fontSize: '10px', // Smaller font for line measurements
                    className: 'line-measurement',
                });
                shape.measurementLabels.push(label);
            }
        }
    }

    // Add this helper method to properly remove labels
    _removeMeasurementLabels(shape) {
        if (shape) {
            if (shape.measurementLabels) {
                shape.measurementLabels.forEach((label) => {
                    if (label) {
                        if (label.div && label.div.parentNode) {
                            label.div.parentNode.removeChild(label.div);
                        }
                        label.setMap(null);
                        delete label.div;
                        delete label.map;
                    }
                });
            }
            shape.measurementLabels = [];
        }
    }

    formatMeasurement(value, isArea = false) {
        if (isArea) {
            // Format area measurements
            if (value < 10000) {
                // Less than 10,000 m²
                return `${value.toFixed(2)} m²`;
            } else if (value < 1000000) {
                // Less than 1 km²
                return `${(value / 10000).toFixed(2)} ha`;
            } else {
                // 1 km² or larger
                return `${(value / 1000000).toFixed(2)} km²`;
            }
        } else {
            // Format length/perimeter measurements
            if (value < 1000) {
                // Less than 1000 meters
                return `${value.toFixed(2)} m`;
            } else {
                // 1000 meters or larger
                return `${(value / 1000).toFixed(2)} km`;
            }
        }
    }

    getLabelPositions(shape) {
        switch (shape.getType()) {
            case 'polygon':
                return this._getPolygonLabelPositions(shape);
            case 'rectangle':
                return this._getRectangleLabelPositions(shape);
            case 'circle':
                return this._getCircleLabelPositions(shape);
            default:
                return [];
        }
    }

    _getPolygonLabelPositions(shape) {
        const bounds = shape.getBounds();
        const polygon = shape.getShape();
        const path = polygon.getPath();

        // Find centroid for area label
        let centroid = this._calculatePolygonCentroid(path);

        // Find middle point of first edge for perimeter label
        const firstPoint = path.getAt(0);
        const secondPoint = path.getAt(1);
        const midPoint = new google.maps.LatLng(
            (firstPoint.lat() + secondPoint.lat()) / 2,
            (firstPoint.lng() + secondPoint.lng()) / 2
        );

        return [midPoint, centroid];
    }

    _getRectangleLabelPositions(shape) {
        const bounds = shape.getShape().getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        // Middle of top edge for perimeter
        const topMiddle = new google.maps.LatLng(ne.lat(), (ne.lng() + sw.lng()) / 2);

        // Center for area
        const center = bounds.getCenter();

        return [topMiddle, center];
    }

    _getCircleLabelPositions(shape) {
        const circle = shape.getShape();
        const center = circle.getCenter();
        const radius = circle.getRadius();

        // Point on the circle's circumference for perimeter
        const northPoint = google.maps.geometry.spherical.computeOffset(
            center,
            radius,
            0 // 0 degrees = north
        );

        return [northPoint, center];
    }

    _calculatePolygonCentroid(path) {
        let lat = 0;
        let lng = 0;
        const length = path.getLength();

        for (let i = 0; i < length; i++) {
            lat += path.getAt(i).lat();
            lng += path.getAt(i).lng();
        }

        return new google.maps.LatLng(lat / length, lng / length);
    }
}
