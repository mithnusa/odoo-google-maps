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

        coordinates.forEach((coord) => {
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

    static mapLabelOverlay() {
        class MapLabel extends google.maps.OverlayView {
            constructor(options) {
                super();
                this.position = options.position;
                this.text = options.text;
                this.map = options.map;
                this.setMap(this.map);
            }

            onAdd() {
                // console.log('onAdd');
                this.div = document.createElement('div');
                this.div.className = 'map-measurement-label';
                this.div.style.position = 'absolute';
                this.div.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                this.div.style.padding = '2px 6px';
                this.div.style.borderRadius = '3px';
                this.div.style.fontSize = '12px';
                this.div.style.fontWeight = '500';
                this.div.style.border = '1px solid #666';
                this.div.style.cursor = 'default';
                this.div.style.userSelect = 'none';
                this.div.style.whiteSpace = 'nowrap';
                this.div.innerHTML = this.text;

                const panes = this.getPanes();
                panes.overlayLayer.appendChild(this.div);
            }

            draw() {
                if (!this.div || !this.map) return;

                const overlayProjection = this.getProjection();
                const position = overlayProjection.fromLatLngToDivPixel(this.position);
                if (position) {
                    this.div.style.left = position.x + 'px';
                    this.div.style.top = position.y + 'px';
                }
            }

            onRemove() {
                console.log('onRemove');
                if (this.div) {
                    if (this.div.parentNode) {
                        this.div.parentNode.removeChild(this.div);
                    }
                    this.div = null;
                }
            }

            setPosition(position) {
                this.position = position;
                this.draw();
            }

            setText(text) {
                this.text = text;
                if (this.div && this.text) {
                    this.div.innerHTML = text;
                }
            }

            setMap(map) {
                if (this.map && this.div) {
                    this.onRemove();
                }
                super.setMap(map);
            }
        }
        return MapLabel;
    }
}
