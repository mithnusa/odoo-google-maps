/** @odoo-module **/

import { renderToString } from '@web/core/utils/render';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapsDrawingSidebar } from './google_map_drawing_sidebar';

export class GoogleMapDrawingRenderer extends GoogleMapRenderer {
    setup() {
        super.setup();
        this.editColor = '#ffa187';
        this.drawingManager = null;
        this.shapesBounds = new google.maps.LatLngBounds();
        this.shapes = {};
        this.prevShapeSelected = null;
        this.currentShapeSelected = null;
    }

    /**
     * @override
     */
    renderMap() {
        this.shapes = {};
        this.initialize();
        this.initializeDrawing();
        this.renderShapes();
        this.centerMap();
    }

    /**
     * @override
     */
    initialize() {
        if (!this.googleMap) {
            this.googleMap = new google.maps.Map(this.mapRef.el, {
                center: { lat: 0, lng: 0 },
                mapTypeId: 'terrain',
                minZoom: 2,
                maxZoom: 20,
                fullscreenControl: true,
                mapTypeControl: true,
                gestureHandling: 'auto',
            });
            this.getTheme();
        }
        this.markerInfoWindow = new google.maps.InfoWindow();
    }

    _getGeneralOptions() {
        return {
            fillColor: this.editColor,
            strokeColor: '#fc6c44',
            strokeOpacity: 0.85,
            strokeWeight: 2.0,
            fillOpacity: 0.45,
            editable: true,
        };
    }

    _getCircleOptions() {
        return {
            fillColor: this.editColor,
            fillOpacity: 0.45,
            strokeWeight: 0,
            editable: true,
            zIndex: 1,
        };
    }

    _getBaseColorOptions() {
        return {
            strokeColor: '#FF0000',
            strokeOpacity: 0.55,
            strokeWeight: 0.85,
            fillColor: '#FF9999',
            fillOpacity: 0.45,
            editable: false,
            zIndex: 1,
        };
    }

    _getSelectedColorOptions() {
        return {
            fillColor: '#de6ade',
            strokeColor: '#b038b0',
            strokeOpacity: 0.65,
            strokeWeight: 0.85,
            fillOpacity: 0.45,
            editable: false,
            zIndex: 99,
        };
    }

    initializeDrawing() {
        if (!this.drawingManager) {
            const shapeOption = this._getGeneralOptions();
            const circleOption = this._getCircleOptions();
            this.drawingManager = new google.maps.drawing.DrawingManager({
                drawingControl: false,
                drawingControlOptions: {
                    position: google.maps.ControlPosition.TOP_CENTER,
                    drawingModes: [
                        google.maps.drawing.OverlayType.CIRCLE,
                        google.maps.drawing.OverlayType.POLYGON,
                        google.maps.drawing.OverlayType.RECTANGLE,
                    ],
                },
                map: this.googleMap,
                polygonOptions: shapeOption,
                circleOptions: circleOption,
                rectangleOptions: shapeOption,
            });
        }
    }

    renderShapes() {
        this.props.list.records.forEach((record) => this.renderShape(record));
    }

    renderShape(record) {
        if (record.data.gshape_paths) {
            try {
                const options = JSON.parse(record.data.gshape_paths || '{}');
                if (record.data.gshape_type === 'polygon' && options) {
                    this._handleDrawPolygon(record, options);
                } else if (record.data.gshape_type === 'rectangle' && options) {
                    this._handleDrawRectangle(record, options);
                } else if (record.data.gshape_type === 'circle' && options) {
                    this._handleDrawCircle(record, options);
                }
            } catch (error) {
                console.warn(error);
            }
        }
    }

    _handleDrawPolygon(record, options) {
        if (record.id in this.shapes) {
            this.shapes[record.id].setMap(null);
        }
        const polygon = new google.maps.Polygon({
            strokeColor: '#FF0000',
            strokeOpacity: 0.55,
            strokeWeight: 1.0,
            fillColor: '#FF9999',
            fillOpacity: 0.35,
            editable: false,
            map: this.googleMap,
        });
        polygon.setOptions(options);
        this.shapes[record.id] = polygon;
        polygon.getPaths().forEach((path) => {
            path.forEach((latlng) => {
                this.shapesBounds.extend(latlng);
            });
        });
        google.maps.event.addListener(
            polygon,
            'click',
            this.handleShapeInfoWindow.bind(this, record)
        );
        return polygon;
    }

    _handleDrawRectangle(record, options) {
        if (record.id in this.shapes) {
            this.shapes[record.id].setMap(null);
        }
        const rectangle = new google.maps.Rectangle({
            strokeColor: '#FF0000',
            strokeOpacity: 0.55,
            strokeWeight: 1.0,
            fillColor: '#FF9999',
            fillOpacity: 0.35,
            map: this.googleMap,
            editable: false,
            draggable: false,
        });
        rectangle.setOptions(options);
        this.shapes[record.id] = rectangle;
        this.shapesBounds.union(rectangle.getBounds());
        google.maps.event.addListener(
            rectangle,
            'click',
            this.handleShapeInfoWindow.bind(this, record)
        );
        return rectangle;
    }

    _handleDrawCircle(record, options) {
        if (record.id in this.shapes) {
            this.shapes[record.id].setMap(null);
        }
        const circle = new google.maps.Circle({
            strokeColor: '#FF0000',
            strokeOpacity: 0.85,
            strokeWeight: 1.0,
            fillColor: '#FF9999',
            fillOpacity: 0.35,
            map: this.googleMap,
            editable: false,
            draggable: false,
        });
        circle.setOptions(options);
        this.shapes[record.id] = circle;
        this.shapesBounds.union(circle.getBounds());
        google.maps.event.addListener(
            circle,
            'click',
            this.handleShapeInfoWindow.bind(this, record)
        );
        return circle;
    }

    getShapeContent(record) {
        const content = renderToString('web_view_google_map_drawing.ShapeInfoWindow', {
            record: record.id,
            title: record.data.gshape_name,
            description: record.data.gshape_description,
        });

        const divContent = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');

        divContent.querySelector('#btn-open_form').addEventListener(
            'click',
            (ev) => {
                const dataId = ev.target.getAttribute('data-record') || null;
                const record = this.props.list.records.find((r) => r.id === dataId);
                if (record) {
                    this.props.openRecord(record);
                }
            },
            false
        );
        return divContent;
    }

    handleShapeInfoWindow(record, event) {
        let bodyContent = document.createElement('div');
        bodyContent.className = 'o_kanban_group';

        const shapeContent = this.getShapeContent(record);

        bodyContent.appendChild(shapeContent);

        this.markerInfoWindow.setOptions({
            content: bodyContent,
            position: event.latLng,
        });
        this.markerInfoWindow.open(this.googleMap);
    }

    centerMap() {
        const mapBounds = new google.maps.LatLngBounds();
        if (!this.shapesBounds.isEmpty()) {
            mapBounds.union(this.shapesBounds);
        }
        this.googleMap.fitBounds(mapBounds);
        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
            google.maps.event.trigger(this.googleMap, 'resize');
            if (this.googleMap.getZoom() > 17) this.googleMap.setZoom(17);
        });
    }

    _handleActiveShape() {
        let options;
        if (this.prevShapeSelected) {
            options = this._getBaseColorOptions();
            this.prevShapeSelected.setOptions(options);
        }
        if (this.currentShapeSelected) {
            options = this._getSelectedColorOptions();
            this.currentShapeSelected.setOptions(options);
        }
    }

    pointInMap(shape) {
        if (shape) {
            this.prevShapeSelected = this.currentShapeSelected;
            this.currentShapeSelected = shape;

            let bounds;
            if (shape.type === 'polygon') {
                const paths = shape.getPath();
                if (paths.length > 0) {
                    bounds = new google.maps.LatLngBounds();
                    paths.forEach((item) => {
                        bounds.extend({ lat: item.lat(), lng: item.lng() });
                    });
                }
            } else if (shape.type === 'circle') {
                bounds = shape.getBounds();
            } else if (shape.type === 'rectangle') {
                bounds = shape.getBounds();
            }
            this._handleActiveShape();
            if (bounds) {
                this.googleMap.fitBounds(bounds);
                this.googleMap.panTo(bounds.getCenter());
                google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                    google.maps.event.trigger(this.googleMap, 'resize');
                    if (this.googleMap.getZoom() > 17) this.googleMap.setZoom(17);
                });
            }
        }
    }

    get sidebarComponent() {
        return GoogleMapsDrawingSidebar;
    }

    get sidebarProps() {
        return {
            handleOpenRecord: this.props.openRecord.bind(this),
            handlePointInMap: this.pointInMap.bind(this),
            string: this.props.archInfo.viewTitle,
            records: this.props.list.records,
            shapes: this.shapes,
        };
    }
}
