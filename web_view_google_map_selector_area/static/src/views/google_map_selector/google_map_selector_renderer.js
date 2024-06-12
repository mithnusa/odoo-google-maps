/** @odoo-module **/

import { patch } from '@web/core/utils/patch';
import { archParseBoolean } from '@web/views/utils';
import { renderToString } from '@web/core/utils/render';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';

patch(GoogleMapRenderer.prototype, 'web_view_google_map_selector_area', {
    /**
     * @override
     */
    setup() {
        this._super(...arguments);
        this.shapes = {};
        this.markerInAreaSelected = new Set();
        this.editColor = '#fca2a2';
        this.disableAreaSelector = false;
    },

    /**
     * @override
     */
    addMapCustomEvListeners() {
        if (!this.disableAreaSelector) {
            this._super();
        }
    },

    /**
     * @override
     */
    removeMapCustomEvListeners() {
        if (!this.disableAreaSelector) {
            this._super();
        }
    },

    /**
     * @override
     */
    initialize() {
        this._super(...arguments);
        let js_class = '';
        if (this.props.archInfo && this.props.archInfo.arch) {
            const xml = new DOMParser().parseFromString(this.props.archInfo.arch, 'text/xml');
            js_class = xml.documentElement.getAttribute('js_class') || '';
            this.disableAreaSelector = archParseBoolean(xml.documentElement.getAttribute('disable_area_selector'), false);
        }

        // prevent initialize area selector in view google map drawing or widget google maps drawing
        if (js_class === 'google_map_drawing' || (this.props.id && this.props.name) || this.disableAreaSelector) {
            return;
        } else {
            this._initializeGoogleMapDrawing();
        }
    },
    _initializeGoogleMapDrawing() {
        let isDrawingEnabled = true;
        if (!this.googleDrawingManager && this.googleMap) {
            const drawingOption = this.polygonOption;
            const circleOption = this.circleOption;
            try {
                this.googleDrawingManager = new google.maps.drawing.DrawingManager({
                    drawingControl: true,
                    drawingControlOptions: {
                        position: google.maps.ControlPosition.BOTTOM_CENTER,
                        drawingModes: [
                            google.maps.drawing.OverlayType.CIRCLE,
                            google.maps.drawing.OverlayType.POLYGON,
                            google.maps.drawing.OverlayType.RECTANGLE,
                        ],
                    },
                    map: this.googleMap,
                    polygonOptions: drawingOption,
                    circleOptions: circleOption,
                    rectangleOptions: drawingOption,
                });
                google.maps.event.addListener(
                    this.googleDrawingManager,
                    'overlaycomplete',
                    this.handleOverlayComplete.bind(this)
                );
            } catch (error) {
                isDrawingEnabled = false;
                this.notification.add(
                    this.env._t(
                        'Google Maps drawing failed to load, please update the setting by add "drawing" in the Libraries'
                    ),
                    { type: 'warning' }
                );
            }
        }
        if (isDrawingEnabled) {
            this.addActionButton();
        }
        this.resetShapes();
    },

    addActionButton() {
        if (!this.selectorDeleteBtn) {
            const content = renderToString('web_view_google_map_selector_area.ButtonActions', {});
            this.selectorDeleteBtn = new DOMParser()
                .parseFromString(content, 'text/html')
                .querySelector('div');

            this.googleMap.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(
                this.selectorDeleteBtn
            );
            this.selectorDeleteBtn
                .querySelector('button')
                .addEventListener('click', this.deleteSelectedArea.bind(this));
        }
    },

    deleteSelectedArea(event) {
        event.preventDefault();
        event.stopPropagation();
        if (this.selectedShape) {
            this.selectedShape.setMap(null);
            if (this.shapes[this.selectedShape._ID].markers.size) {
                this.clearSelections(this.shapes[this.selectedShape._ID].markers);
                this.shapes[this.selectedShape._ID].markers.clear();
            }
            delete this.shapes[this.selectedShape._ID];
            this.selectedShape = null;
        }
    },

    handleOverlayComplete(event) {
        this.googleDrawingManager.setDrawingMode(null);
        const shape = event.overlay;
        const shapeID = new Date().getTime().toString();
        shape.type = event.type;
        shape._ID = shapeID;

        this.shapes[shapeID] = { shape, markers: new Set(), selected: null };
        google.maps.event.addListener(shape, 'click', this.setSelectedShape.bind(this, shape));
    },

    /**
     * @override
     */
    renderMap() {
        if (this.selectedShape || Object.keys(this.shapes).length) {
            return;
        } else {
            this._super();
        }
    },

    setSelectedShape(shape) {
        this.selectedShape = shape;
        this.selectedShape.setEditable(true);

        this.handleClearSelection();

        this.shapes[shape._ID].selected =
            this.shapes[shape._ID].selected === null ? true : !this.shapes[shape._ID].selected;

        const selectedColor = this.selectedShapeOption;
        const unselectedColor = this.polygonOption;

        if (this.shapes[shape._ID].selected) {
            this.selectedShape.setOptions(selectedColor);
        } else {
            this.selectedShape.setOptions(unselectedColor);
        }
        this.handleShapeDrawn();
    },

    handleShapeDrawn() {
        if (this.selectedShape.type === 'polygon') {
            this._handleShapePolygon();
        } else if (this.selectedShape.type === 'circle') {
            this._handleShapeCircle();
        } else if (this.selectedShape.type === 'rectangle') {
            this._handleShapeRectangle();
        }
    },

    _handleShapeRectangle: function () {
        const markers = Array.from(this.cache.values());
        const markersInRectangle = new Set();
        const rectangleID = this.selectedShape._ID;
        const bounds = this.selectedShape.getBounds();
        let isShapeSelected = null;

        Object.keys(this.shapes).forEach((key) => {
            if (rectangleID === key) {
                // unselect all previous markers
                if (this.shapes[rectangleID].markers.size) {
                    this.clearSelections(this.shapes[rectangleID].markers);
                }
                // recalculate markers inside the shape
                markers.forEach((marker) => {
                    if (bounds.contains(marker.getPosition())) {
                        markersInRectangle.add(marker);
                    }
                });
                isShapeSelected = this.shapes[rectangleID].selected;
            }
        });

        this.shapes[rectangleID].markers = markersInRectangle;
        if (isShapeSelected) {
            this.markersToogleSelection(markersInRectangle);
        } else {
            this.clearSelections(markersInRectangle);
        }
    },
    /**
     * Handle markers in a circle
     */
    _handleShapeCircle: function () {
        const markers = Array.from(this.cache.values());

        const markersInCircle = new Set();
        const circleID = this.selectedShape._ID;

        const circleArea = this.selectedShape;

        let isShapeSelected = null;

        Object.keys(this.shapes).forEach((key) => {
            if (circleID === key) {
                // unselect all previous markers
                if (this.shapes[circleID].markers.size) {
                    this.clearSelections(this.shapes[circleID].markers);
                }
                // recalculate markers inside the shape
                markers.forEach((marker) => {
                    const isInside =
                        google.maps.geometry.spherical.computeDistanceBetween(
                            marker.getPosition(),
                            circleArea.getCenter()
                        ) <= circleArea.getRadius();
                    if (isInside) {
                        markersInCircle.add(marker);
                    }
                });
                isShapeSelected = this.shapes[circleID].selected;
            }
        });

        this.shapes[circleID].markers = markersInCircle;
        if (isShapeSelected) {
            this.markersToogleSelection(markersInCircle);
        } else {
            this.clearSelections(markersInCircle);
        }
    },
    /**
     * Handle markers in a polygon
     */
    _handleShapePolygon: function () {
        const markers = Array.from(this.cache.values());

        const markersInShape = new Set();
        const polygonID = this.selectedShape._ID;

        let isShapeSelected = null;

        Object.keys(this.shapes).forEach((key) => {
            if (polygonID === key) {
                // unselect all previous markers
                if (this.shapes[polygonID].markers.size) {
                    this.clearSelections(this.shapes[polygonID].markers);
                }
                // recalculate markers inside the shape
                markers.forEach((marker) => {
                    if (
                        google.maps.geometry.poly.containsLocation(
                            marker.getPosition(),
                            this.selectedShape
                        )
                    ) {
                        markersInShape.add(marker);
                    }
                });
                isShapeSelected = this.shapes[polygonID].selected;
            }
        });

        this.shapes[polygonID].markers = markersInShape;
        if (isShapeSelected) {
            this.markersToogleSelection(markersInShape);
        } else {
            this.clearSelections(markersInShape);
        }
    },

    handleClearSelection() {
        if (Object.keys(this.shapes).length) {
            const unselectedColor = this.polygonOption;
            Object.keys(this.shapes).forEach((shapeId) => {
                if (this.selectedShape._ID !== shapeId) {
                    this.shapes[shapeId].selected = false;
                    this.shapes[shapeId].shape.setEditable(false);
                    this.shapes[shapeId].shape.setOptions(unselectedColor);
                    if (this.shapes[shapeId].markers.size) {
                        this.clearSelections(this.shapes[shapeId].markers);
                    }
                }
            });
        }
    },

    resetShapes() {
        if (this.selectedShape) {
            this.selectedShape.setOptions({
                editable: false,
                map: null,
            });
        }
        Object.keys(this.shapes).forEach((shapeId) => {
            this.shapes[shapeId].selected = null;
            this.shapes[shapeId].shape.setOptions({
                editable: false,
                map: null,
            });
            if (this.shapes[shapeId].markers.size) {
                this.clearSelections(this.shapes[shapeId].markers);
                this.shapes[shapeId].markers.clear();
            }
            delete this.shapes[shapeId];
        });
    },

    markersToogleSelection(markers) {
        if (markers.size) {
            markers.forEach((marker) => this.toggleRecordSelection(marker._odooRecord));
        }
    },

    clearSelections(markers) {
        if (markers.size) {
            markers.forEach((marker) => {
                marker._odooRecord.toggleSelection(false);
                this.props.list.selectDomain(false);
                this._deselectMarker(marker);
            });
        }
    },

    get polygonOption() {
        return {
            fillColor: '#fca2a2',
            strokeColor: '#fc6c44',
            strokeOpacity: 0.85,
            strokeWeight: 2.0,
            fillOpacity: 0.45,
            editable: true,
            zIndex: 1,
            draggable: true,
        };
    },
    get circleOption() {
        return {
            fillColor: '#fca2a2',
            fillOpacity: 0.45,
            strokeWeight: 0,
            editable: true,
            zIndex: 1,
            draggable: true,
        };
    },
    get selectedShapeOption() {
        return {
            fillColor: '#ff5757',
            strokeColor: '#ff5757',
            strokeOpacity: 0.85,
            strokeWeight: 2.0,
            fillOpacity: 0.45,
            editable: true,
            zIndex: 1000,
            draggable: true,
        };
    },
});
