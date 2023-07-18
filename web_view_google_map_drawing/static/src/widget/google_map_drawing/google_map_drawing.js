/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { onWillUpdateProps, onWillDestroy } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { useDebounced } from '@web/core/utils/timing';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { renderToString } from '@web/core/utils/render';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';

import { LOADER_STATUS } from '@base_google_map/utils/base_google_map';
import { MAP_THEMES } from '@base_google_map/utils/themes';

export class GoogleMapDrawing extends GoogleMapRenderer {
    setup() {
        super.setup();
        this.notification = useService('notification');

        this.displayColor = '#006ee5';
        this.editColor = '#ffa187';

        this.drawingManager = null;
        this.customControl = null;
        this.selectedShape = null;
        this.isEditing = false;
        this.shapes = {};

        this._handleDrawPolygonAddListenerDebounce = useDebounced(
            this._handlePolygonBoundsChanged,
            500
        );
        this._handleCircleBoundsChangedDebounce = useDebounced(
            this._handleCircleBoundsChanged,
            500
        );
        this._handleRectangleBoundsChangedDebounce = useDebounced(
            this._handleRectangleBoundsChanged,
            500
        );

        onWillUpdateProps((_nextProps) => {
            // on page changed, disable the shape already drawn before
            if (!_nextProps.value) {
                Object.values(this.shapes).forEach((shape) => shape.setMap(null));
            } else {
                for (const [key, shape] of Object.entries(this.shapes)) {
                    if (key !== _nextProps.value) {
                        shape.setMap(null);
                    }
                }
            }
            // reset the edit mode
            this.isEditing = false;
            this.toggleSaveButtonAnimation();
        });

        onWillDestroy(() => {
            if (this.shapes) {
                Object.keys(this.shapes).forEach((key) =>
                    this._deleteShapeInCache(key)
                );
            }
        });
    }

    /**
     * @overwrite
     */
    handleOnPatched() {
        // do nothing
    }

    /**
     * @overwrite
     */
    handleOnRendered() {
        if (this.state.loaderStatus === LOADER_STATUS.SUCCESS) {
            this.renderMap();
        }
    }

    /**
     * @overwrite
     */
    renderMap() {
        if (!this.drawingManager) return;
        this._resetShape();
        this._handleLoadShape();
    }

    /**
     * Initialize Google Map instance
     */
    initialize() {
        super.initialize();
        const mapThemeDrawing = new google.maps.StyledMapType(
            MAP_THEMES['line_drawing'],
            {
                name: _lt('Drawing'),
            }
        );
        this.googleMap.setOptions({
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
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
        this.googleMap.mapTypes.set('drawing', mapThemeDrawing);
        this.initializeDrawing();
    }

    /**
     * Load the shape from cache if any, otherwise create a new one
     */
    _handleLoadShape() {
        const value = this.props.value;
        if (value) {
            if (this.shapes[value]) {
                const shape = this.shapes[value];
                const shapeMap = shape.getMap();
                if (!shapeMap) {
                    shape.setMap(this.googleMap);
                }
                if (shape.type === 'polygon') {
                    this._handleCenterMap(shape.getPath());
                } else if (shape.type === 'circle') {
                    this._handleCenterMap(false, shape.getBounds());
                } else if (shape.type === 'rectangle') {
                    this._handleCenterMap(false, shape.getBounds());
                }
            } else {
                try {
                    const shape = JSON.parse(value);
                    this._handleShapeToDraw(shape);
                } catch (error) {
                    console.error(error);
                    this.notification.add(
                        this.env._t(
                            'Something went wrong, the shape cannot be drawn on the map. Please contact administrator'
                        ),
                        { type: 'danger' }
                    );
                }
            }
        }
    }

    _storeInCache(shape) {
        const value = { type: shape.type };
        if (shape.type === 'rectangle') {
            const directions = shape.getBounds().toJSON();
            value.options = {
                bounds: directions,
            };
        } else if (shape.type === 'polygon') {
            const paths = shape.getPath();
            value.options = {
                paths: paths.getArray().map((item) => ({
                    lat: item.lat(),
                    lng: item.lng(),
                })),
            };
        } else if (shape.type === 'circle') {
            const radius = shape.getRadius();
            const center = shape.getCenter();
            value.options = {
                radius: radius,
                center: {
                    lat: center.lat(),
                    lng: center.lng(),
                },
            };
        }
        this.shapes[JSON.stringify(value)] = shape;
    }

    _deleteShapeInCache(shape_key) {
        if (shape_key in this.shapes) {
            this.shapes[shape_key].setMap(null);
            delete this.shapes[shape_key];
        }
    }

    _handleShapeToDraw(shape) {
        if (shape.type === 'polygon') {
            const polygon = this._handleDrawPolygon(shape);
            polygon.setOptions({
                strokeColor: this.displayColor,
                fillColor: this.displayColor,
            });
            polygon.type = 'polygon';
            this._storeInCache(polygon);
            const selectedShape = polygon;
            google.maps.event.addListener(
                selectedShape,
                'click',
                this.handleSetSelectedShape.bind(this, selectedShape)
            );
        } else if (shape.type === 'rectangle') {
            const rectangle = this._handleDrawRectangle(shape.options);
            rectangle.setOptions({
                draggable: false,
                strokeColor: this.displayColor,
                fillColor: this.displayColor,
            });
            rectangle.type = 'rectangle';
            this._storeInCache(rectangle);
            const selectedShape = rectangle;
            google.maps.event.addListener(
                selectedShape,
                'click',
                this.handleSetSelectedShape.bind(this, selectedShape)
            );
        } else if (shape.type === 'circle') {
            const circle = this._handleDrawCircle(shape.options);
            circle.setOptions({
                draggable: false,
                strokeColor: this.displayColor,
                fillColor: this.displayColor,
            });
            circle.type = 'circle';
            this._storeInCache(circle);
            const selectedShape = circle;
            google.maps.event.addListener(
                selectedShape,
                'click',
                this.handleSetSelectedShape.bind(this, selectedShape)
            );
        }
    }

    _handleDrawPolygonPoints(lines) {
        this._cleanPolygonPoints();
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

    _handleDrawPolygon(shape) {
        const options = shape.options;
        const polygon = new google.maps.Polygon({
            strokeColor: '#FF0000',
            strokeOpacity: 0.85,
            strokeWeight: 1.0,
            fillColor: '#FF9999',
            fillOpacity: 0.35,
            editable: false,
            map: this.googleMap,
        });
        polygon.setOptions(options);
        this._handleDrawPolygonPoints(shape.lines);
        this._handleCenterMap(polygon.getPath());
        this._handleDrawPolygonAddListener(polygon);
        return polygon;
    }

    _handleDrawPolygonAddListener(polygon) {
        google.maps.event.addListener(
            polygon.getPath(),
            'insert_at',
            this._handleDrawPolygonAddListenerDebounce.bind(this)
        );
        // event `dragend` is also fired at event `set_at`
        google.maps.event.addListener(
            polygon.getPath(),
            'set_at',
            this._handleDrawPolygonAddListenerDebounce.bind(this)
        );
        google.maps.event.addListener(
            polygon.getPath(),
            'remove_at',
            this._handleDrawPolygonAddListenerDebounce.bind(this)
        );
    }

    _handlePolygonBoundsChanged() {
        this.isEditing = true;
        this.toggleSaveButtonAnimation();
    }

    _handleDrawRectangle(options) {
        const rectangle = new google.maps.Rectangle({
            strokeColor: '#FF0000',
            strokeOpacity: 0.85,
            strokeWeight: 1.0,
            fillColor: '#FF9999',
            fillOpacity: 0.35,
            map: this.googleMap,
            editable: false,
            draggable: false,
        });
        rectangle.setOptions(options);
        this._handleCenterMap(false, rectangle.getBounds());
        this._handleDrawRectangleAddListener(rectangle);
        return rectangle;
    }

    _handleDrawRectangleAddListener(rectangle) {
        rectangle.addListener(
            'bounds_changed',
            this._handleRectangleBoundsChangedDebounce.bind(this)
        );
    }

    _handleRectangleBoundsChanged() {
        this.isEditing = true;
        this.toggleSaveButtonAnimation();
    }

    _handleDrawCircle(options) {
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
        this._handleCenterMap(false, circle.getBounds());
        this._handleDrawCircleAddListener(circle);
        return circle;
    }

    _handleDrawCircleAddListener(circle) {
        circle.addListener(
            'radius_changed',
            this._handleCircleBoundsChangedDebounce.bind(this)
        );
        circle.addListener(
            'center_changed',
            this._handleCircleBoundsChangedDebounce.bind(this)
        );
    }

    _handleCircleBoundsChanged() {
        this.isEditing = true;
        this.toggleSaveButtonAnimation();
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

    _getSelectedOptions() {
        return {
            fillColor: '#ffa187',
            strokeColor: '#fc6c44',
            strokeOpacity: 0.85,
            strokeWeight: 2.0,
            fillOpacity: 0.45,
            editable: true,
        };
    }

    toggleSaveButtonAnimation() {
        this.googleMap.controls[google.maps.ControlPosition.TOP_CENTER].forEach(
            (element) => {
                if (element.id === 'custom-control-drawing-buttons') {
                    let button = element.querySelector('#save');
                    let floppyIcon = element.querySelector('.fa-floppy-o');
                    if (button && floppyIcon) {
                        if (this.isEditing) {
                            button.classList.add('btn-success');
                            button.classList.remove('btn-light');
                            floppyIcon.classList.add('animate');
                        } else {
                            floppyIcon.classList.remove('btn-success');
                            button.classList.add('btn-light');
                            floppyIcon.classList.remove('animate');
                        }
                    }
                }
            }
        );
    }

    _renderMapCustomControl() {
        if (!this.customControl) {
            const content = renderToString(
                'web_view_google_map_drawing.ButtonActionDelete',
                {}
            );
            this.customControl = new DOMParser()
                .parseFromString(content, 'text/html')
                .querySelector('div');
            this.googleMap.controls[google.maps.ControlPosition.TOP_CENTER].push(
                this.customControl
            );
            this.customControl
                .querySelector('#delete')
                .addEventListener('click', this._actionDelete.bind(this));
            this.customControl
                .querySelector('#save')
                .addEventListener('click', this._actionSave.bind(this));
        }
    }

    _actionDelete() {
        if (this.selectedShape) {
            this.selectedShape.setMap(null);
            this.selectedShape = null;
        } else {
            this.notification.add(this.env._t('No shape selected to delete'), {
                type: 'warning',
            });
            this.notification.add(
                this.env._t(
                    'Click on one of the shapes you have drawn to select a shape'
                ),
                { type: 'info' }
            );
        }
    }

    _actionSave() {
        if (!this.selectedShape) {
            this.notification.add(this.env._t('There is no shape to save'), {
                type: 'danger',
            });
            this.notification.add(
                this.env._t(
                    'Please click on one of the shapes that you have drawn and that you would like to save.'
                ),
                { type: 'info' }
            );
        } else {
            let values;
            if (this.selectedShape.type === 'polygon') {
                values = this._handleSavePolygon();
            } else if (this.selectedShape.type === 'rectangle') {
                values = this._handleSaveRectangle();
            } else if (this.selectedShape.type === 'circle') {
                values = this._handleSaveCircle();
            }
            this._saveChanges(values);
        }
    }

    async _saveChanges(values) {
        if (values) {
            this._storeInCache(this.selectedShape);
            const paths = values[this.props.name];
            delete values[this.props.name];
            this.props.update(paths);
            await this.props.record.update(values);
            this.selectedShape.setOptions({
                editable: false,
                strokeColor: this.displayColor,
                fillColor: this.displayColor,
            });
            this.drawingManager.setDrawingMode(null);
            this.notification.add(this.env._t('The shape has been recorded'), {
                type: 'info',
            });
            this.selectedShape = null;
            this.isEditing = false;
            this.toggleSaveButtonAnimation();
        }
    }

    _computePolygonLines(paths) {
        let stop;
        let start;
        let count = 0;

        const lines = {};
        paths.forEach((latLng) => {
            start = stop;
            stop = latLng;
            if (start) {
                lines[count] = { start, stop };
            }
            count += 1;
        });

        const lines_len = Object.keys(lines).length;
        lines[lines_len + 1] = {
            start: lines[1].start,
            stop: lines[lines_len].stop,
        };

        Object.keys(lines).forEach((line) => {
            lines[line].length = google.maps.geometry.spherical.computeLength([
                lines[line].start,
                lines[line].stop,
            ]);
        });
        return lines;
    }

    _handleSavePolygon() {
        const paths = this.selectedShape.getPath();
        const area = this._calculateAreaPolygon(this.selectedShape);
        const values = {
            gshape_type: this.selectedShape.type,
            gshape_area: area,
            gshape_radius: 0.0,
            gshape_width: 0.0,
            gshape_height: 0.0,
        };

        const linePaths = paths
            .getArray()
            .map((item) => ({ lat: item.lat(), lng: item.lng() }));

        const lines = this._computePolygonLines(linePaths);
        const shape_paths = {
            type: this.selectedShape.type,
            options: {
                paths: linePaths,
            },
            lines,
        };
        values[this.props.name] = JSON.stringify(shape_paths);
        return values;
    }

    _handleSaveRectangle() {
        const area = this._calculateAreaRectangle(this.selectedShape);
        const values = {
            gshape_type: this.selectedShape.type,
            gshape_radius: 0.0,
            gshape_area: area,
        };
        const bounds = this.selectedShape.getBounds();
        const directions = bounds.toJSON();
        const shape_paths = {
            type: this.selectedShape.type,
            options: { bounds: directions },
        };
        values.gshape_height = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(
                this.selectedShape.bounds.toJSON().north,
                this.selectedShape.bounds.toJSON().east
            ),
            new google.maps.LatLng(
                this.selectedShape.bounds.toJSON().south,
                this.selectedShape.bounds.toJSON().east
            )
        );
        values.gshape_width = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(
                this.selectedShape.bounds.toJSON().north,
                this.selectedShape.bounds.toJSON().east
            ),
            new google.maps.LatLng(
                this.selectedShape.bounds.toJSON().north,
                this.selectedShape.bounds.toJSON().west
            )
        );
        values[this.props.name] = JSON.stringify(shape_paths);
        return values;
    }
    /**
     * Calculate circle square area (in meter)
     * @param {*} circle
     * @returns
     */
    _calculateAreaCircle(circle) {
        const radius = circle.getRadius();
        const area = Math.PI * radius * radius;
        return area;
    }
    /**
     * Calculate rectangle square area (in meter)
     * @param {*} rectangle
     * @returns
     */
    _calculateAreaRectangle(rectangle) {
        const rectangleBound = rectangle.bounds.toJSON();
        const height = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(rectangleBound.north, rectangleBound.east),
            new google.maps.LatLng(rectangleBound.south, rectangleBound.east)
        );
        const width = google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(rectangleBound.north, rectangleBound.east),
            new google.maps.LatLng(rectangleBound.north, rectangleBound.west)
        );
        const area = height * width;
        return area;
    }
    /**
     * Calculate polygon square area (in meter)
     * @param {*} polygon
     * @returns
     */
    _calculateAreaPolygon(polygon) {
        const paths = polygon.getPath();
        const area = google.maps.geometry.spherical.computeArea(paths);
        return area;
    }

    _handleSaveCircle() {
        const radius = this.selectedShape.getRadius();
        const center = this.selectedShape.getCenter();
        const area = this._calculateAreaCircle(this.selectedShape);
        const values = {
            gshape_type: this.selectedShape.type,
            gshape_radius: radius,
            gshape_area: area,
            gshape_width: 0.0,
            gshape_height: 0.0,
        };
        const shape_paths = {
            type: this.selectedShape.type,
            options: {
                radius: radius,
                center: {
                    lat: center.lat(),
                    lng: center.lng(),
                },
            },
        };
        values[this.props.name] = JSON.stringify(shape_paths);
        return values;
    }

    /**
     * Overwrite
     * @returns {}
     */
    getMapOptions() {
        return {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            center: { lat: 0, lng: 0 },
            zoom: 4,
            minZoom: 2,
            maxZoom: 22,
            fullscreenControl: true,
            mapTypeControl: true,
            gestureHandling: 'cooperative',
        };
    }

    /**
     * Overwrite
     * Instantiate Drawing Manager with edit options
     */
    initializeDrawing() {
        if (!this.drawingManager) {
            const shapeOption = this._getGeneralOptions();
            const circleOption = this._getCircleOptions();
            try {
                this.drawingManager = new google.maps.drawing.DrawingManager({
                    drawingControl: !this.props.readonly,
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
                google.maps.event.addListener(
                    this.drawingManager,
                    'overlaycomplete',
                    this.handleOverlayComplete.bind(this)
                );
                google.maps.event.addListener(
                    this.googleMap,
                    'click',
                    this._clearSelectedShape.bind(this)
                );
                this._renderMapCustomControl();
            } catch (error) {
                console.error(error);
                this.notification.add(
                    this.env._t(
                        'Google Maps DrawingManager could not be loaded. Please make sure "drawing" is configured on Google Maps Libraries settings'
                    ),
                    { type: 'danger' }
                );
            }
        }
    }

    handleOverlayComplete(event) {
        this.drawingManager.setDrawingMode(null);
        const shape = event.overlay;
        if (this.selectedShape) {
            shape.setMap(null);
            this.notification.add(this.env._t('Only one shape allowed'), {
                type: 'warning',
            });
            this.notification.add(
                this.env._t(
                    'If you want to change the shape, you will need to delete the shape that you are currently drawing'
                ),
                { type: 'info' }
            );
            return;
        }
        this.isEditing = true;
        this.toggleSaveButtonAnimation();
        shape.type = event.type;
        this.handleSetSelectedShape(shape);

        google.maps.event.addListener(
            shape,
            'click',
            this.handleSetSelectedShape.bind(this, shape)
        );
    }

    handleSetSelectedShape(shape) {
        this.selectedShape = shape;
        const options = this._getSelectedOptions();
        if (['circle', 'rectangle', 'polygon'].indexOf(this.selectedShape.type) >= 0) {
            options.draggable = true;
        }
        this.selectedShape.setOptions(options);
    }

    _resetShape() {
        if (this.selectedShape) {
            this.selectedShape.setOptions({
                editable: false,
                map: null,
            });
            this.selectedShape = null;
        }
        Object.values(this.shapes).forEach((shape) => shape.setMap(null));
        if (this.polygonMarkers) {
            Object.keys(this.polygonMarkers).forEach((lineAt) => {
                this.polygonMarkers[lineAt].setMap(null);
                delete this.polygonMarkers[lineAt];
            });
        }
        this.drawingManager.setDrawingMode(null);
    }

    _clearSelectedShape() {
        if (this.selectedShape) {
            this.selectedShape.setEditable(false);
            this.selectedShape = null;
        }
        this.drawingManager.setDrawingMode(null);
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

    _handleCenterMap(paths, bounds) {
        paths = paths || [];
        bounds = bounds || false;
        if (paths.length > 0) {
            let mapBounds = new google.maps.LatLngBounds();
            paths.forEach((item) => {
                mapBounds.extend({ lat: item.lat(), lng: item.lng() });
            });
            this.googleMap.fitBounds(mapBounds);
        } else if (bounds) {
            this.googleMap.fitBounds(bounds);
        }
    }
}

GoogleMapDrawing.components = {};
GoogleMapDrawing.template = 'web_view_google_map_drawing.GoogleDrawingField';
GoogleMapDrawing.defaultProps = {
    dynamicPlaceholder: false,
    shouldTrim: true,
};
GoogleMapDrawing.props = {
    ...standardFieldProps,
    dynamicPlaceholder: { type: Boolean, optional: true },
    options: { type: Object, optional: true },
};
GoogleMapDrawing.extractProps = ({ attrs }) => ({
    options: attrs.options,
    dynamicPlaceholder: attrs.options.dynamic_placeholder,
});
GoogleMapDrawing.displayName = _lt('Google Maps Drawing');
GoogleMapDrawing.supportedTypes = ['text'];

registry.category('fields').add('google_map_drawing', GoogleMapDrawing);
