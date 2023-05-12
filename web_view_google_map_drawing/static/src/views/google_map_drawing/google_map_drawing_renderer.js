/** @odoo-module **/

import { renderToString } from '@web/core/utils/render';
import { _lt } from '@web/core/l10n/translation';
import { onWillDestroy, onWillUpdateProps } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapsDrawingSidebar } from './google_map_drawing_sidebar';
import { MAP_THEMES } from '@base_google_map/utils/themes';

export class GoogleMapDrawingRenderer extends GoogleMapRenderer {
    setup() {
        super.setup();
        this.notification = useService('notification');

        this.editColor = '#ffa187';
        this.drawingManager = null;
        this.shapes = {};
        this.prevShapeSelected = null;
        this.currentShapeSelected = null;
        this.shapesBounds = null;

        onWillDestroy(() => {
            if (this.shapes) {
                Object.keys(this.shapes).forEach((key) =>
                    this._deleteShapeInCache(key)
                );
            }
        });

        onWillUpdateProps(() => {
            if (this.shapes) {
                Object.keys(this.shapes).forEach((key) =>
                    this._deleteShapeInCache(key)
                );
            }
        });
    }

    /**
     * @override
     */
    renderMap(isCentered) {
        isCentered = isCentered || false;
        this.shapesBounds = new google.maps.LatLngBounds();
        this.renderShapes();

        if (isCentered) {
            this.centerMap();
        }
    }

    /**
     * @override
     */
    setMapTheme() {
        super.setMapTheme();
        this.googleMap.setOptions({
            mapTypeControlOptions: {
                mapTypeIds: [
                    'roadmap',
                    'satellite',
                    'hybrid',
                    'terrain',
                    'drawing',
                    'styled_map',
                ],
            },
        });
    }

    /**
     * @override
     */
    initialize() {
        super.initialize();
        const mapThemeDrawing = new google.maps.StyledMapType(
            MAP_THEMES['line_drawing'],
            {
                name: _lt('Drawing'),
            }
        );
        this.googleMap.mapTypes.set('drawing', mapThemeDrawing);
        this.initializeDrawing();
    }

    _getGeneralOptions() {
        return {
            fillColor: '#fa5a5a',
            strokeColor: '#fc3232',
            strokeOpacity: 0.85,
            strokeWeight: 2.0,
            fillOpacity: 0.45,
            editable: true,
        };
    }

    _getCircleOptions() {
        return {
            fillColor: '#fa5a5a',
            fillOpacity: 0.45,
            strokeWeight: 0,
            editable: true,
            zIndex: 1,
        };
    }

    _getBaseColorOptions() {
        return {
            strokeColor: '#fc3232',
            strokeOpacity: 0.55,
            strokeWeight: 0.85,
            fillColor: '#fa5a5a',
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
            try {
                this.drawingManager = new google.maps.drawing.DrawingManager({
                    drawingMode: null,
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
                });
            } catch (error) {
                console.log(error);
                this.notification.add(
                    this.env._t(
                        'Google Maps DrawingManager could not be loaded. Please make sure "drawing" is configured on Google Maps Libraries settings'
                    ),
                    { type: 'danger' }
                );
            }
        }
    }

    _deleteShapeInCache(shape_key) {
        if (shape_key in this.shapes) {
            this.shapes[shape_key].setMap(null);
            delete this.shapes[shape_key];
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
                console.error(error);
            }
        }
    }

    _handleDrawPolygon(record, options) {
        this._deleteShapeInCache(record.id);
        const styleOption = this._getBaseColorOptions();
        const polygon = new google.maps.Polygon(styleOption);
        polygon.setOptions({ ...options, map: this.googleMap });
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
        this._deleteShapeInCache(record.id);
        const styleOption = this._getBaseColorOptions();
        const rectangle = new google.maps.Rectangle(styleOption);
        rectangle.setOptions({
            ...options,
            map: this.googleMap,
            draggable: false,
        });
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
        this._deleteShapeInCache(record.id);
        const styleOption = this._getBaseColorOptions();
        const circle = new google.maps.Circle(styleOption);
        circle.setOptions({ ...options, map: this.googleMap, draggable: false });
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
            record: JSON.stringify({
                id: record.id,
                resId: record.resId,
                resModel: record.resModel,
            }),
            title: record.data.gshape_name,
            description: record.data.gshape_description,
        });

        const divContent = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');

        divContent.querySelector('#btn-open_form').addEventListener(
            'click',
            (ev) => {
                const data = ev.target.getAttribute('data-record') || null;
                if (data) {
                    const values = JSON.parse(data);
                    const record = this.props.list.records.find(
                        (r) => r.id === values.id
                    );
                    if (record) {
                        this.props.showRecord(record);
                    }
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
        if (this.shapesBounds && !this.shapesBounds.isEmpty()) {
            mapBounds.union(this.shapesBounds);
        }
        this.googleMap.fitBounds(mapBounds);
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
            this._cleanPolygonPoints();
            if (shape.type === 'polygon') {
                const paths = shape.getPath();
                if (paths.length > 0) {
                    bounds = new google.maps.LatLngBounds();
                    paths.forEach((item) => {
                        bounds.extend({ lat: item.lat(), lng: item.lng() });
                    });
                }
                this._handleDrawPolygonPoints(shape.lines);
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
                });
            }
        }
    }

    _cleanPolygonPoints() {
        if (this.polygonMarkers) {
            Object.keys(this.polygonMarkers).forEach((lineAt) => {
                this.polygonMarkers[lineAt].setMap(null);
                delete this.polygonMarkers[lineAt];
            });
        } else {
            this.polygonMarkers = {};
        }
    }

    _handleDrawPolygonPoints(lines) {
        if (lines) {
            let latLng;
            const totalStop = Object.keys(lines).length;
            Object.keys(lines).forEach((key) => {
                if (key < totalStop) {
                    latLng = lines[key].start;
                } else {
                    latLng = lines[key].stop;
                }
                this.polygonMarkers[key] = new google.maps.Marker({
                    map: this.googleMap,
                    position: latLng,
                    label: key,
                    animation: google.maps.Animation.DROP,
                });
            });
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
            fieldTitle: this.props.archInfo.sidebarTitleField,
            fieldSubtitle: this.props.archInfo.sidebarSubtitleField,
        };
    }
}
