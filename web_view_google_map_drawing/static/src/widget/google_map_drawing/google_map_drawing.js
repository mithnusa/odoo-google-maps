/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { Component, useRef, useEffect, onRendered, onWillUpdateProps } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { renderToString } from '@web/core/utils/render';

import { MAP_THEMES } from '@web_view_google_map/views/google_map/utils';

export class GoogleMapDrawing extends Component {
    setup() {
        this.mapRef = useRef('map');
        this.rpc = useService('rpc');
        this.user = useService('user');
        this.notification = useService('notification');

        this.editColor = '#ffa187';
        this.displayColor = '#006ee5';
        this.googleMap = null;
        this.drawingManager = null;
        this.buttonDeleteEl = null;
        this.selectedShape = null;
        this.shapes = {};

        useEffect(() => this.renderGoogleMapDrawing());
        onRendered(() => {
            if (!this.props.value) {
                Object.values(this.shapes).forEach((shape) => {
                    console.log({ shape });
                    shape.setMap(null);
                });
            }
        });
    }

    _handleLoadShape() {
        const value = this.props.value;
        if (value) {
            if (this.shapes[value]) {
                const shape = this.shapes[value];
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

    _handleShapeToDraw(shape) {
        if (shape.type === 'polygon') {
            const polygon = this._handleDrawPolygon(shape.options);
            polygon.setOptions({
                strokeColor: this.displayColor,
                fillColor: this.displayColor,
            });
            polygon.type = 'polygon';
            this.shapes[JSON.stringify(shape)] = polygon;
            const selectedShape = polygon;
            google.maps.event.addListener(
                selectedShape,
                'click',
                this.handleSetSelectedShape.bind(this, selectedShape)
            );
        } else if (shape.type === 'rectangle') {
            const rectangle = this._handleDrawRectangle(shape.options);
            rectangle.setOptions({
                draggable: true,
                strokeColor: this.displayColor,
                fillColor: this.displayColor,
            });
            rectangle.type = 'rectangle';
            this.shapes[JSON.stringify(shape)] = rectangle;
            const selectedShape = rectangle;

            google.maps.event.addListener(
                selectedShape,
                'click',
                this.handleSetSelectedShape.bind(this, selectedShape)
            );
        } else if (shape.type === 'circle') {
            const circle = this._handleDrawCircle(shape.options);
            circle.setOptions({
                draggable: true,
                strokeColor: this.displayColor,
                fillColor: this.displayColor,
            });
            circle.type = 'circle';
            this.shapes[JSON.stringify(shape)] = circle;
            const selectedShape = circle;
            google.maps.event.addListener(
                selectedShape,
                'click',
                this.handleSetSelectedShape.bind(this, selectedShape)
            );
        }
    }

    _handleDrawPolygon(options) {
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
        this._handleCenterMap(polygon.getPath());
        return polygon;
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
        return rectangle;
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
        return circle;
    }

    _setMapTheme(style) {
        if (
            !Object.prototype.hasOwnProperty.call(MAP_THEMES, style) ||
            style === 'default'
        ) {
            return;
        }
        const styledMapType = new google.maps.StyledMapType(MAP_THEMES[style], {
            name: 'Styled Map',
        });
        this.googleMap.setOptions({
            mapTypeControlOptions: {
                mapTypeIds: ['satellite', 'hybrid', 'terrain', 'styled_map'],
            },
        });
        // Associate the styled map with the MapTypeId and set it to display.
        this.googleMap.mapTypes.set('styled_map', styledMapType);
        this.googleMap.setMapTypeId('styled_map');
    }

    async getTheme() {
        const data = await this.rpc('/web/base_google_map/theme', {
            context: this.user.context,
        });
        if (data.theme) {
            this._setMapTheme(data.theme);
        }
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

    _renderButtonDelete() {
        if (!this.buttonDeleteEl) {
            const content = renderToString(
                'web_view_google_map_drawing.ButtonActionDelete',
                {}
            );
            this.buttonDeleteEl = new DOMParser()
                .parseFromString(content, 'text/html')
                .querySelector('div');
            this.googleMap.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(
                this.buttonDeleteEl
            );
            this.buttonDeleteEl
                .querySelector('#delete')
                .addEventListener('click', this._actionDelete.bind(this), false);
            this.buttonDeleteEl
                .querySelector('#save')
                .addEventListener('click', this._actionSave.bind(this), false);
        }
    }

    _actionDelete() {
        if (this.selectedShape) {
            // delete this.shapes[this.selectedShape._ID];
            this.selectedShape.setMap(null);
            this.selectedShape = null;
        } else {
            this.notification.add(
                this.env._t('You have not selected a shape to delete'),
                {
                    type: 'warning',
                }
            );
            this.notification.add(
                this.env._t(
                    'To select a shape, please click on any of the shapes that you have drawn'
                ),
                { type: 'info' }
            );
        }
    }

    _actionSave(ev) {
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

    _saveChanges(values) {
        if (values) {
            this.props.record.update(values);
            this.shapes[JSON.stringify(values[this.props.name])] = this.selectedShape;
            this.selectedShape.setOptions({
                editable: false,
                strokeColor: this.displayColor,
                fillColor: this.displayColor,
            });
            this.drawingManager.setDrawingMode(null);
            this.notification.add(this.env._t('The shape has been updated'), {
                type: 'info',
            });
            this.selectedShape = null;
        }
    }

    _handleSavePolygon() {
        const paths = this.selectedShape.getPath();
        const area = google.maps.geometry.spherical.computeArea(paths);
        const paths_latLng = [];
        paths.forEach(function (item) {
            paths_latLng.push({
                lat: item.lat(),
                lng: item.lng(),
            });
        });
        const values = {
            gshape_type: this.selectedShape.type,
            gshape_area: area,
            gshape_radius: 0.0,
        };
        const shape_paths = {
            type: this.selectedShape.type,
            options: {
                paths: paths_latLng,
            },
        };
        values[this.props.name] = JSON.stringify(shape_paths);
        return values;
    }

    _handleSaveRectangle() {
        const values = {
            gshape_type: this.selectedShape.type,
            gshape_radius: 0.0,
            gshape_area: 0.0,
        };
        const bounds = this.selectedShape.getBounds();
        const directions = bounds.toJSON();
        const shape_paths = {
            type: this.selectedShape.type,
            options: {
                bounds: directions,
            },
        };
        values[this.props.name] = JSON.stringify(shape_paths);
        return values;
    }

    _handleSaveCircle() {
        const radius = this.selectedShape.getRadius();
        const center = this.selectedShape.getCenter();
        const values = {
            gshape_type: this.selectedShape.type,
            gshape_radius: radius,
            gshape_area: 0.0,
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

    renderGoogleMapDrawing() {
        if (!this.googleMap) {
            this.googleMap = new google.maps.Map(this.mapRef.el, {
                mapTypeId: 'terrain',
                center: { lat: 0, lng: 0 },
                zoom: 2,
                gestureHandling: 'cooperative',
            });
            this.getTheme();
        }
        if (!this.drawingManager) {
            const shapeOption = this._getGeneralOptions();
            const circleOption = this._getCircleOptions();
            this.drawingManager = new google.maps.drawing.DrawingManager({
                drawingControl: !this.props.readonly,
                drawingControlOptions: {
                    position: google.maps.ControlPosition.BOTTOM_CENTER,
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
        }
        this._renderButtonDelete();
        this._handleLoadShape();
    }

    handleOverlayComplete(event) {
        const shape = event.overlay;
        shape.type = event.type;

        this.drawingManager.setDrawingMode(null);
        this.handleSetSelectedShape(shape);

        google.maps.event.addListener(
            shape,
            'click',
            this.handleSetSelectedShape.bind(this, shape)
        );
    }

    handleSetSelectedShape(shape) {
        this.selectedShape = shape;
        this.selectedShape.setEditable(true);
        const options = this._getSelectedOptions();
        this.selectedShape.setOptions(options);
    }

    _clearSelectedShape() {
        if (this.selectedShape) {
            this.selectedShape.setEditable(false);
            this.selectedShape = null;
        }
    }

    _handleCenterMap(paths, bounds) {
        paths = paths || [];
        bounds = bounds || false;
        let mapBounds = new google.maps.LatLngBounds();
        if (paths.length > 0) {
            paths.forEach((item) => {
                mapBounds.extend({ lat: item.lat(), lng: item.lng() });
            });
        } else if (bounds) {
            mapBounds.union(bounds);
        }
        this.googleMap.fitBounds(mapBounds);
    }
}

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
