import { MapConfig } from '../map_config';

export class BaseShape {
    constructor(overlay, id) {
        this.shape = overlay;
        this.id = id || Math.random().toString(36).substring(2, 9);
        this._editable = false;
    }

    getId() {
        return this.id;
    }

    getShape() {
        return this.shape;
    }

    setEditable(editable) {
        this._editable = editable;
        this.shape.setOptions({
            editable: editable,
            draggable: editable,
            strokeColor: editable ? MapConfig.COLORS.EDIT : MapConfig.COLORS.DISPLAY,
            fillColor: editable ? MapConfig.COLORS.EDIT : MapConfig.COLORS.DISPLAY,
        });
    }

    isEditable() {
        return this._editable;
    }

    remove() {
        this.shape.setMap(null);
    }

    finalize() {
        this.setEditable(false);
    }

    // Abstract methods to be implemented by subclasses
    getType() {
        throw new Error('Must be implemented by subclass');
    }

    getArea() {
        throw new Error('Must be implemented by subclass');
    }

    toJSON() {
        throw new Error('Must be implemented by subclass');
    }

    getDimensions() {
        throw new Error('Must be implemented by subclass');
    }
}
