import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import {
    useRef,
    useSubEnv,
    onWillUpdateProps,
    onWillDestroy,
    useState,
    onRendered,
} from '@odoo/owl';
import { useDebounced } from '@web/core/utils/timing';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { renderToString } from '@web/core/utils/render';

import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';

import { TerraDrawToolsUI } from '../../views/components/terra-tools-ui/terra-tools-ui';

import { ShapeManager } from '../../utils/shape_manager';
import { EventManager } from '../../utils/event_manager';
import { MapConfig } from '../../utils/map_config';
import { ShapeFactory } from '../../utils/shape_factory';


export class GoogleMapDrawingField extends BaseGoogleMapComponent {
    static template = 'web_view_google_map_drawing.GoogleDrawingField';
    static components = {
        Geolocate: GoogleMapGeolocate,
        InMapSearchPlaces: GoogleMapSearchPlaces,
        TerraDrawToolsUI,
    };
    static defaultProps = {
        dynamicPlaceholder: false,
        shouldTrim: true,
    };
    static props = {
        ...standardFieldProps,
        placeholder: { type: String, optional: true },
        dynamicPlaceholder: { type: Boolean, optional: true },
        options: { type: Object, optional: true },
    };

    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.googleMapBounds = null;
        this.shapeManager = new ShapeManager();
        this.eventManager = new EventManager();
        this.drawingManager = null;
        this.customControl = null;

        this.state = useState({
            ...this.state,
            sidebarIsFolded: false,
            groupDatalistId: null,
            isEditing: false,
        });

        // Setup debounced handlers
        this._handleDrawPolygonAddListenerDebounce = useDebounced(
            this._handlePolygonBoundsChanged.bind(this),
            MapConfig.DEBOUNCE_DELAY
        );
        this._handleCircleBoundsChangedDebounce = useDebounced(
            this._handleCircleBoundsChanged.bind(this),
            MapConfig.DEBOUNCE_DELAY
        );
        this._handleRectangleBoundsChangedDebounce = useDebounced(
            this._handleRectangleBoundsChanged.bind(this),
            MapConfig.DEBOUNCE_DELAY
        );

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        // Setup lifecycle hooks
        onWillUpdateProps(this._handlePropsUpdate);
        onWillDestroy(this._cleanup);
        onRendered(this._handleRendered);
    }

    _handlePropsUpdate(nextProps) {
        this.shapeManager.cleanup();
        if (this.drawingManager) {
            this.drawingManager.setDrawingMode(null);
        }
    }

    _handleRendered() {
        if (this.isMapLoaded()) {
            this.renderMap();
        }
    }

    /**
     * @override
     */
    mapDivElement() {
        return this.mapRef.el;
    }

    /**
     * @override
     */
    // _prepareMapOptions(options) {
    //     options.mapTypeId = google.maps.MapTypeId.HYBRID;
    //     return options;
    // }

    /**
     * @override
     */
    async onMapReady(map) {
        await super.onMapReady(map);
        try {
            const { LatLngBounds } = await this.apiLoader.importLibrary('core');
            this.googleMapBounds = new LatLngBounds();
            this.initializeDrawing();
        } catch (error) {
            console.error('Map initialization failed:', error);
            this.notificationService.add(_t('Failed to initialize map'), { type: 'danger' });
        }
    }

    renderMap() {
        if (!this.isMapLoaded()) return;
        this._loadExistingShape();
    }

    initializeDrawing() {
        if (this.drawingManager || !this.googleMap) return;

        try {
            this.drawingManager = new google.maps.drawing.DrawingManager({
                drawingControl: !this.props.readonly,
                drawingControlOptions: {
                    position: google.maps.ControlPosition.TOP_CENTER,
                    drawingModes: MapConfig.DRAWING_MODES,
                },
                map: this.googleMap,
                ...MapConfig.DEFAULT_SHAPE_OPTIONS,
            });

            // Disable drawing mode if shape exists
            if (this.shapeManager.getShapeCount() > 0) {
                this.drawingManager.setDrawingMode(null);
            }

            this._setupDrawingListeners();
            this._renderCustomControls();
        } catch (error) {
            console.error('Drawing initialization failed:', error);
            this.notificationService.add(_t('Failed to initialize drawing tools'), {
                type: 'danger',
            });
        }
    }

    _setupDrawingListeners() {
        this.eventManager.addListener(
            this.drawingManager,
            'overlaycomplete',
            this._handleOverlayComplete.bind(this)
        );

        this.eventManager.addListener(this.googleMap, 'click', this._clearSelectedShape.bind(this));
    }

    async _handleOverlayComplete(event) {
        this.drawingManager.setDrawingMode(null);

        // Check if shape already exists
        if (this.shapeManager.getShapeCount() > 0) {
            event.overlay.setMap(null); // Remove the newly drawn shape
            this.notificationService.add(
                _t('Only one shape is allowed. Please edit the existing shape or delete it first.'),
                {
                    type: 'warning',
                    title: _t('Warning'),
                }
            );
            return;
        }

        const shape = ShapeFactory.createShape(event.type, event.overlay);
        this.shapeManager.addShape(shape);
        this._setupShapeListeners(shape);

        // Add measurement labels after shape creation
        this.shapeManager.updateMeasurementLabel(shape, this.googleMap);

        try {
            const shapeData = shape.toJSON();
            await this.props.record.update({
                [this.props.name]: JSON.stringify(shapeData),
                gshape_type: shape.getType(),
                gshape_area: shape.getArea(),
                ...shape.getDimensions(),
            });

            // Add notification for successful creation
            this.notificationService.add(_t('Shape created and saved successfully'), {
                type: 'success',
                title: _t('Success'),
            });
        } catch (error) {
            console.error('Failed to save new shape:', error);
            this.notificationService.add(_t('Failed to save new shape'), {
                type: 'danger',
                title: _t('Error'),
            });
        }
    }

    _loadExistingShape() {
        const value = this.props.record.data[this.props.name];
        if (!value) return;

        try {
            const shapeData = JSON.parse(value);
            // Create the shape directly on the map
            const shape = ShapeFactory.fromJSON(shapeData, this.googleMap);
            this.shapeManager.addShape(shape);
            this._setupShapeListeners(shape);

            // Add measurement labels after loading existing shape
            this.shapeManager.updateMeasurementLabel(shape, this.googleMap);

            this._centerMapOnShape(shape);

            // Disable drawing mode if shape exists
            if (this.drawingManager) {
                this.drawingManager.setDrawingMode(null);
            }
        } catch (error) {
            console.error('Failed to load shape:', error);
            this.notificationService.add(_t('Failed to load existing shape'), { type: 'danger' });
        }
    }

    _setupShapeListeners(shape) {
        const shapeObj = shape.getShape();

        // Remove any existing listeners
        this.eventManager.removeListeners(shapeObj, 'click');

        // Add click listener for selection
        this.eventManager.addListener(shapeObj, 'click', (e) => {
            // Prevent event bubbling to map
            e.stop();
            e.domEvent.stopPropagation();

            this.shapeManager.selectShape(shape);
            shape.setEditable(true);

            // Disable drawing mode when editing
            if (this.drawingManager) {
                this.drawingManager.setDrawingMode(null);
            }
        });

        // Add type-specific listeners
        switch (shape.getType()) {
            case 'polygon':
                this._setupPolygonListeners(shape);
                break;
            case 'circle':
                this._setupCircleListeners(shape);
                break;
            case 'rectangle':
                this._setupRectangleListeners(shape);
                break;
        }
    }

    _setupPolygonListeners(shape) {
        const path = shape.getShape().getPath();
        this.eventManager.addListener(path, 'insert_at', () =>
            this._handleDrawPolygonAddListenerDebounce()
        );
        this.eventManager.addListener(path, 'set_at', () =>
            this._handleDrawPolygonAddListenerDebounce()
        );
        this.eventManager.addListener(path, 'remove_at', () =>
            this._handleDrawPolygonAddListenerDebounce()
        );
    }

    _setupCircleListeners(shape) {
        const circle = shape.getShape();
        this.eventManager.addListener(circle, 'radius_changed', () =>
            this._handleCircleBoundsChangedDebounce()
        );
        this.eventManager.addListener(circle, 'center_changed', () =>
            this._handleCircleBoundsChangedDebounce()
        );
    }

    _setupRectangleListeners(shape) {
        const rectangle = shape.getShape();

        // Remove any existing listeners first
        this.eventManager.removeListeners(rectangle, 'bounds_changed');

        // Add the bounds_changed listener with debounce
        this.eventManager.addListener(
            rectangle,
            'bounds_changed',
            () => {
                if (shape.isEditable()) {
                    this._handleRectangleBoundsChangedDebounce(shape);
                }
            },
            { debounce: MapConfig.DEBOUNCE_DELAY }
        );
    }

    _handlePolygonBoundsChanged(shape) {
        this._handleShapeChanged(shape);
    }

    _handleCircleBoundsChanged(shape) {
        this._handleShapeChanged(shape);
    }

    _handleRectangleBoundsChanged(shape) {
        this._handleShapeChanged(shape);
    }

    async _handleShapeChanged(shape) {
        if (!shape) {
            shape = this.shapeManager.getSelectedShape();
        }

        if (shape) {
            try {
                // Update measurement labels when shape changes
                this.shapeManager.updateMeasurementLabel(shape, this.googleMap);

                const shapeData = shape.toJSON();
                await this.props.record.update({
                    [this.props.name]: JSON.stringify(shapeData),
                    gshape_type: shape.getType(),
                    gshape_area: shape.getArea(),
                    ...shape.getDimensions(),
                });

                // Add notification for successful save
                this.notificationService.add(_t('Shape changes saved successfully'), {
                    type: 'success',
                    title: _t('Success'),
                });
            } catch (error) {
                console.error('Failed to save shape changes:', error);
                this.notificationService.add(_t('Failed to save shape changes'), {
                    type: 'danger',
                    title: _t('Error'),
                });
            }
        }
    }

    _renderCustomControls() {
        if (this.customControl) return;

        const content = renderToString('web_view_google_map_drawing.ButtonActionDelete', {});
        this.customControl = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');

        this.googleMap.controls[google.maps.ControlPosition.TOP_CENTER].push(this.customControl);

        this.customControl
            .querySelector('#delete')
            .addEventListener('click', this._handleDelete.bind(this));
    }

    async _handleDelete() {
        const selectedShape = this.shapeManager.getSelectedShape();
        if (!selectedShape) {
            this.notificationService.add(_t('No shape selected'), {
                type: 'warning',
                sticky: false,
                title: _t('Warning'),
            });
            return;
        }

        try {
            this.shapeManager.removeMeasurementLabels(selectedShape);
            selectedShape.remove();
            this.shapeManager.removeShape(selectedShape.getId());
            await this.props.record.update({ [this.props.name]: false });

            // Add notification for successful deletion
            this.notificationService.add(_t('Shape deleted successfully'), {
                type: 'success',
                sticky: false,
                title: _t('Success'),
            });

            // Re-enable drawing mode after deletion
            if (this.drawingManager) {
                this.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
            }
        } catch (error) {
            console.error('Failed to delete shape:', error);
            this.notificationService.add(_t('Failed to delete shape'), {
                type: 'danger',
                sticky: true,
                title: _t('Error'),
            });
        }
    }

    _clearSelectedShape() {
        const selectedShape = this.shapeManager.getSelectedShape();
        if (selectedShape) {
            selectedShape.setEditable(false);
            this.shapeManager.clearSelection();
        }
    }

    _centerMapOnShape(shape) {
        const bounds = shape.getBounds();
        if (bounds && !bounds.isEmpty()) {
            this.googleMap.fitBounds(bounds);
        }
    }

    _cleanup() {
        this.eventManager.removeAllListeners();
        this.shapeManager.cleanup();
        if (this.drawingManager) {
            this.drawingManager.setMap(null);
        }
    }

    getMapOptions() {
        return MapConfig.MAP_OPTIONS;
    }
}

export const googleMapDrawingField = {
    component: GoogleMapDrawingField,
    displayName: _t('Google Maps Drawing'),
    supportedTypes: ['text'],
    extractProps: ({ attrs, options }) => ({
        placeholder: attrs.placeholder,
        dynamicPlaceholder: options?.dynamic_placeholder || false,
        options,
    }),
};

registry.category('fields').add('google_map_drawing', googleMapDrawingField);
