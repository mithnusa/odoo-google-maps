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
        this.shapes.forEach((shape) => shape.remove());
        this.shapes.clear();
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
}
