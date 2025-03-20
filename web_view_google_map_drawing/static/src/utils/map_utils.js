export class MapUtils {
    static calculateArea(shape) {
        switch (shape.type) {
            case 'polygon':
                return google.maps.geometry.spherical.computeArea(shape.getPath());
            case 'circle':
                const radius = shape.getRadius();
                return Math.PI * radius * radius;
            case 'rectangle':
                return this.calculateRectangleArea(shape);
            default:
                throw new Error(`Unsupported shape type: ${shape.type}`);
        }
    }

    static calculateRectangleDimentions(rectangle) {
        const bounds = rectangle.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const width = this.calculateDistance(
            new google.maps.LatLng(ne.lat(), ne.lng()),
            new google.maps.LatLng(ne.lat(), sw.lng())
        );
        const height = this.calculateDistance(
            new google.maps.LatLng(ne.lat(), ne.lng()),
            new google.maps.LatLng(sw.lat(), ne.lng())
        );
        const area = width * height;
        return { width, height, area };
    }

    static calculateRectangleArea(rectangle) {
        const { area } = this.calculateRectangleDimentions(rectangle);
        return area;
    }

    static calculateDistance(point1, point2) {
        return google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
    }

    static calculateCenterPointOfPoligon(polygon) {
        if (!polygon.getPath) return null;
        const coordinates = polygon.getPath().getArray();
        if (!coordinates.length) return null;

        let sumLat = 0;
        let sumLng = 0;
        const len = coordinates.length;

        coordinates.forEach(coord => {
            sumLat += coord.lat();
            sumLng += coord.lng();
        });

        return new google.maps.LatLng(sumLat / len, sumLng / len);
    }

    static calculateCenterPointOfRectangle(rectangle) {
        if (!rectangle.getBounds) return null;
        const bounds = rectangle.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const lat = (ne.lat() + sw.lat()) / 2;
        const lng = (ne.lng() + sw.lng()) / 2;

        return new google.maps.LatLng(lat, lng);
    }

    static calculateCenterPointOfCircle(circle) {
        const center = circle.getCenter();
        const lat = center.lat();
        const lng = center.lng();
        return new google.maps.LatLng(lat, lng);
    }

    static calculateCenterPointOfShape(shape) {
        switch (shape.type) {
            case 'polygon':
                return this.calculateCenterPointOfPoligon(shape);
            case 'rectangle':
                return this.calculateCenterPointOfRectangle(shape);
            case 'circle':
                return this.calculateCenterPointOfCircle(shape);
            default:
                return null;
        }
    }
};
