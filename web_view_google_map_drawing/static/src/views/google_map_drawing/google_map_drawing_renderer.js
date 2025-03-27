import { renderToString } from '@web/core/utils/render';
import { _t } from '@web/core/l10n/translation';
import { onPatched, onWillUpdateProps, useRef, useEffect, useState, useSubEnv } from '@odoo/owl';
import { isNull } from '@web/views/utils';
import { useBus } from '@web/core/utils/hooks';

import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';
import { LOADER_STATUS } from '@base_google_map/utils/loader_google_map';
import { GoogleMapsDrawingSidebar } from './google_map_drawing_sidebar';
import { MapUtils } from '../../utils/map_utils';
import { ShapeFactory } from '../../utils/shape_factory';
import { ShapeManager } from '../../utils/shape_manager';

/**
 * Maximum zoom level to apply when fitting bounds
 * @type {number}
 */
const MAX_AUTO_ZOOM = 20;

/**
 * Number of records to process in each batch for better UI responsiveness
 * @type {number}
 */
const MARKER_BATCH_SIZE = 100;

export class GoogleMapDrawingRenderer extends BaseGoogleMapComponent {
    static template = 'web_view_google_map.GoogleMapRenderer';
    static components = {
        Geolocate: GoogleMapGeolocate,
        Sidebar: GoogleMapsDrawingSidebar,
        InMapSearchPlaces: GoogleMapSearchPlaces,
    };
    static props = {
        archInfo: Object,
        openRecord: Function,
        showRecord: Function,
        showRecordsByDomain: Function,
        readonly: Boolean,
        list: Object,
        onAdd: { type: Function, optional: true },
        activeActions: { type: Object, optional: true },
        allowSelectors: Boolean,
    };

    setup() {
        super.setup();
        this.mapRef = useRef('map');

        this._isSidebarAction = false;

        this.state = useState({
            // flag to check if sidebar is folded or not
            sidebarIsFolded: false,
            // flag to Google Maps API loader status
            loaderStatus: LOADER_STATUS.NOT_LOADED,
            // flag to control when to update markers
            groupDatalistId: null,
        });

        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        this.shapeManager = new ShapeManager();

        this.editColor = '#ffa187';
        this.drawingManager = null;
        this.shapes = new Map();
        this.prevShapeSelected = null;
        this.currentShapeSelected = null;
        this.shapesBounds = null;

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        useEffect(
            () => {
                if (this.state.groupDatalistId && this.isMapLoaded() && !this._isSidebarAction) {
                    this.renderGeolocationData();
                }
                this._isSidebarAction = false;
            },
            () => [this.state.groupDatalistId]
        );

        useEffect(() => {
            if (this.isMapLoaded() && !this.state.groupDatalistId && !this._isSidebarAction) {
                const isGrouped = this.props.list.isGrouped;
                if (isGrouped) {
                    this.state.groupDatalistId = this._generateUniqueId();
                } else {
                    this.renderGeolocationData();
                }
                this._isSidebarAction = false;
            }
        });

        onWillUpdateProps(() => {
            this.state.groupDatalistId = this._generateUniqueId();
        });

        onPatched(() => {
            if (this._isSidebarAction) {
                this._isSidebarAction = false;
            }
            if (this.state.groupDatalistId && !this.props.list.isGrouped) {
                this.state.groupDatalistId = null;
            }
        });

        if (this.props.allowSelectors) {
            useBus(this.uiService.bus, 'google-map-center-map', this.centerMap);
        }
    }

    /**
     * Toggle sidebar expand/collapse state
     */
    toggleSidebar() {
        this._isSidebarAction = true;
        this.state.sidebarIsFolded = !this.state.sidebarIsFolded;
    }

    _onWillDestroy() {
        this.shapeManager.cleanup();
        if (this.shapes) {
            this.shapes.forEach((shape, key) => {
                // Remove event listeners
                google.maps.event.clearInstanceListeners(shape.getShape());
                this._deleteShapeInCache(key);
            });
        }
        if (this.markerInfoWindow) {
            this.markerInfoWindow.close();
            google.maps.event.clearInstanceListeners(this.markerInfoWindow);
        }
        super._onWillDestroy();
    }

    /**
     * @override
     * @returns {boolean} True if the map is loaded
     */
    isMapLoaded() {
        return this.state.loaderStatus === LOADER_STATUS.LOADED && this.googleMap;
    }

    /**
     * @override
     * @returns {HTMLElement|false} Map DOM element
     */
    mapDivElement() {
        return this.mapRef.el;
    }

    /**
     * @overwrite
     */
    renderGeolocationData(noClear) {
        if (!this.isMapLoaded()) return;
        // noClear = noClear || false;
        // if (!noClear) {
        //     this.clearMarkers();
        // }
        this.renderShapes();
    }

    /**
     * @override
     */
    _prepareMapOptions(options) {
        const values = super._prepareMapOptions(options);
        values.mapTypeId = google.maps.MapTypeId.HYBRID;
        values.gestureHandling = this.props.archInfo?.gestureHandling || 'auto';
        return values;
    }

    /**
     * @override
     */
    updateLoaderState(status) {
        status = status || LOADER_STATUS.FAILED;
        this.state.loaderStatus = status;
    }

    /**
     * @override
     */
    async onMapReady() {
        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        this.shapesBounds = new LatLngBounds();
        this.markerInfoWindow = new google.maps.InfoWindow({ disableAutoPan: true });
        this.initializeDrawing();
    }

    /**
     * Returns base color options for shapes
     * @returns {Object} Shape color options
     * @private
     */
    _getBaseColorOptions() {
        return {
            strokeColor: '#fc3232',
            strokeOpacity: 0.55,
            strokeWeight: 0.85,
            fillColor: '#fa5a5a',
            fillOpacity: 0.45,
            editable: false,
            draggable: false,
            zIndex: 1,
        };
    }

    /**
     * Returns color options for selected shapes
     * @returns {Object} Selected shape color options
     * @private
     */
    _getSelectedColorOptions() {
        return {
            fillColor: '#de6ade',
            strokeColor: '#b038b0',
            strokeOpacity: 0.65,
            strokeWeight: 0.85,
            fillOpacity: 0.45,
            editable: false,
            draggable: false,
            zIndex: 99,
        };
    }

    /**
     * Initializes the drawing manager
     * @throws {Error} If drawing library fails to load
     */
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
                console.error(error);
                this.notificationService.add(
                    _t(
                        'Google Maps DrawingManager could not be loaded. Please make sure "drawing" is configured on Google Maps Libraries settings'
                    ),
                    { type: 'danger' }
                );
            }
        }
    }

    /**
     * Removes a shape from the cache and map
     * @param {string|number} shape_key - Key of shape to delete
     * @private
     */
    _deleteShapeInCache(shape_key) {
        if (this.shapes.has(shape_key)) {
            const shape = this.shapes.get(shape_key);
            shape.getShape().setMap(null);
            this.shapes.delete(shape_key);
        }
    }

    /**
     * Render markers for ungrouped records with batching for performance
     * @private
     * @param {Array} datas Record data array
     */
    _renderUngroupShapes(datas) {
        if (!datas.length) return;

        const processBatch = (startIndex) => {
            const endIndex = Math.min(startIndex + MARKER_BATCH_SIZE, datas.length);

            for (let i = startIndex; i < endIndex; i++) {
                this.createShape(datas[i].record);
            }

            if (endIndex < datas.length) {
                if (window.requestIdleCallback) {
                    window.requestIdleCallback(() => processBatch(endIndex));
                } else {
                    setTimeout(() => processBatch(endIndex), 10);
                }
            }
        };

        // Use requestIdleCallback if available, otherwise setTimeout
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => processBatch(0));
        } else {
            setTimeout(() => processBatch(0), 0);
        }
    }

    /**
     * Render markers for grouped records
     * @private
     * @param {Array} datas Grouped data array
     */
    _renderGroupedShapes(datas) {
        datas.forEach(async ({ group }) => {
            try {
                const records = await group.groupRecords();
                records.forEach((record) => this.createShape(record, group.markerColor));
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        });
    }

    async renderShapes() {
        const datas = this.getGroupsOrRecords();

        // Import marker library
        await this.apiLoader.importLibrary('marker');

        if (this.props.list.isGrouped) {
            this._renderGroupedShapes(datas);
        } else {
            this._renderUngroupShapes(datas);
        }
        // Fit map to bounds once all markers are rendered
        this._fitBoundsWhenReady();
    }

    /**
     * Get current groups or records data
     * @returns {Array} Array of group or record data
     */
    getGroupsOrRecords() {
        if (this.state.loaderStatus !== LOADER_STATUS.LOADED) return [];
        const { list } = this.props;

        const currentProps = {
            isGrouped: list.isGrouped,
            recordsIds: list.isGrouped
                ? list.groups.map((group) => group.id)
                : list.records.map((record) => record.id),
            length: list.isGrouped ? list.groups.length : list.records.length,
        };

        if (
            this.cachedGroupsOrRecords &&
            JSON.stringify(currentProps) === JSON.stringify(this.lastGroupsOrRecordsProps)
        ) {
            return this.cachedGroupsOrRecords;
        }

        let result;
        if (list.isGrouped) {
            result = [...list.groups]
                .sort((a, b) => (a.value && !b.value ? 1 : !a.value && b.value ? -1 : 0))
                .map((group, i) => ({
                    group,
                    key: isNull(group.value) ? `group_key_${i}` : `${String(group.value)}_${i}`,
                }));
        } else {
            result = list.records.map((record) => ({ record, key: record.id }));
        }

        this.lastGroupsOrRecordsProps = currentProps;
        this.cachedGroupsOrRecords = result;
        return result;
    }

    /**
     * Handles shape creation for a given record
     * @param {Object} record - The record containing shape data
     * @param {string} [color=false] - Optional color for the shape
     * @returns {Promise<Object|undefined>} The created shape object
     */
    async createShape(record, color = false) {
        if (!record?.data?.gshape_paths || !record?.data?.gshape_type) return;

        try {
            const data = JSON.parse(record.data.gshape_paths);
            const options = {};
            if (color) {
                options.strokeColor = color;
                options.fillColor = color;
            }
            switch (record.data.gshape_type) {
                case 'polygon':
                    return this._handleDrawPolygon(record, data, options);
                case 'rectangle':
                    return this._handleDrawRectangle(record, data, options);
                case 'circle':
                    return this._handleDrawCircle(record, data, options);
                default:
                    console.warn(`Unsupported shape type: ${record.data.gshape_type}`);
            }
        } catch (error) {
            console.error('Error creating shape:', error);
            this.notificationService.add(_t('Failed to create shape'), { type: 'danger' });
        }
    }

    /**
     * Creates a polygon shape from record data
     * @param {Object} record - The record containing polygon data
     * @param {Object} data - The polygon coordinate data
     * @param {Object} options - Style options for the polygon
     * @returns {Object} The created polygon object
     * @private
     */
    _handleDrawPolygon(record, data, options) {
        options = options || {};
        this._deleteShapeInCache(record.id);
        const styleOption = Object.assign({}, this._getBaseColorOptions(), options);

        const polygon = ShapeFactory.fromJSON(data, this.googleMap, styleOption, record.id);
        const polygonShape = polygon.getShape();
        this.shapes.set(record.id, polygon);

        this.shapesBounds.union(polygon.getBounds());
        google.maps.event.addListener(
            polygonShape,
            'click',
            this.handleShapeInfoWindow.bind(this, record)
        );
        const color = styleOption.fillColor;
        this.createShapeMarker(record, polygonShape, color);
        return polygon;
    }

    /**
     * Creates a rectangle shape from record data
     * @param {Object} record - The record containing rectangle data
     * @param {Object} data - The rectangle coordinate data
     * @param {Object} options - Style options for the rectangle
     * @returns {Object} The created rectangle object
     * @private
     */
    _handleDrawRectangle(record, data, options) {
        this._deleteShapeInCache(record.id);
        options = options || {};
        const styleOption = Object.assign({}, this._getBaseColorOptions(), options);

        const rectangle = ShapeFactory.fromJSON(data, this.googleMap, styleOption, record.id);
        const rectangleShape = rectangle.getShape();

        this.shapes.set(record.id, rectangle);

        this.shapesBounds.union(rectangle.getBounds());
        google.maps.event.addListener(
            rectangleShape,
            'click',
            this.handleShapeInfoWindow.bind(this, record)
        );
        const color = styleOption.fillColor;
        this.createShapeMarker(record, rectangleShape, color);
        return rectangle;
    }

    /**
     * Creates a circle shape from record data
     * @param {Object} record - The record containing circle data
     * @param {Object} data - The circle coordinate data
     * @param {Object} options - Style options for the circle
     * @returns {Object} The created circle object
     * @private
     */
    _handleDrawCircle(record, data, options) {
        this._deleteShapeInCache(record.id);
        options = options || {};
        const styleOption = Object.assign({}, this._getBaseColorOptions(), options);

        const circle = ShapeFactory.fromJSON(data, this.googleMap, styleOption, record.id);
        const circleShape = circle.getShape();

        this.shapes.set(record.id, circle);

        this.shapesBounds.union(circle.getBounds());

        google.maps.event.addListener(
            circleShape,
            'click',
            this.handleShapeInfoWindow.bind(this, record)
        );
        const color = styleOption.fillColor;
        this.createShapeMarker(record, circleShape, color);
        return circle;
    }

    /**
     * Generates HTML content for shape info window
     * @param {Object} record - The record to display info for
     * @returns {HTMLElement} The generated content element
     */
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

        const button = divContent.querySelector('#btn-open_form');
        const clickHandler = (ev) => {
            const data = ev.target.getAttribute('data-record');
            if (data) {
                const values = JSON.parse(data);
                const record = this.props.list.records.find((r) => r.id === values.id);
                if (record) {
                    this.props.showRecord(record);
                }
            }
        };

        button.addEventListener('click', clickHandler);

        // Store handler for cleanup
        button._clickHandler = clickHandler;

        return divContent;
    }

    /**
     * Handles displaying the info window for a shape
     * @param {Object} record - The record associated with the shape
     * @param {google.maps.MouseEvent} event - The click event
     */
    handleShapeInfoWindow(record, event) {
        if (this.markerInfoWindow.getContent()) {
            const oldButton = this.markerInfoWindow.getContent().querySelector('#btn-open_form');
            if (oldButton && oldButton._clickHandler) {
                oldButton.removeEventListener('click', oldButton._clickHandler);
            }
        }
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

    /**
     * Updates the visual state of active/inactive shapes
     * @private
     */
    _handleActiveShape() {
        let options;
        if (this.prevShapeSelected) {
            options = this._getBaseColorOptions();
            this.prevShapeSelected.getShape().setOptions(options);
        }
        if (this.currentShapeSelected) {
            options = this._getSelectedColorOptions();
            this.currentShapeSelected.getShape().setOptions(options);
        }
    }

    /**
     * Centers the map on a specific shape
     * @param {string|number} shapeId - ID of the shape to center on
     */
    pointInMap(shapeId) {
        if (!this.isMapLoaded()) return;

        if (shapeId && this.shapes.has(shapeId)) {
            const shape = this.shapes.get(shapeId);
            this.shapeManager.updateMeasurementLabel(shape, this.googleMap);
            this.prevShapeSelected = this.currentShapeSelected;
            this.currentShapeSelected = shape;

            const bounds = shape.getBounds();

            this._handleActiveShape();
            if (bounds && !bounds.isEmpty()) {
                this.googleMap.fitBounds(bounds);
                this.googleMap.panTo(bounds.getCenter());
                google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                    google.maps.event.trigger(this.googleMap, 'resize');
                    if (this.googleMap.getZoom() > MAX_AUTO_ZOOM)
                        this.googleMap.setZoom(MAX_AUTO_ZOOM);
                });
            }
        }
    }

    /**
     * Calculates the center point of a given shape
     * @param {Object} shape - The shape object
     * @returns {google.maps.LatLng|null} The center point or null if not calculated
     */
    calculateCenterPointOfShape(shape) {
        let centerPoint = null;
        switch (shape.type) {
            case 'polygon':
                centerPoint = MapUtils.calculateCenterPointOfPoligon(shape);
                break;
            case 'rectangle':
                centerPoint = MapUtils.calculateCenterPointOfRectangle(shape);
                break;
            case 'circle':
                centerPoint = MapUtils.calculateCenterPointOfCircle(shape);
                break;
        }
        return centerPoint;
    }

    /**
     * Creates a marker at the center of a shape
     * @param {Object} record - Record related
     * @param {Object} shape - The shape to create marker for
     * @param {string} [color='red'] - Color of the marker
     * @returns {Promise<google.maps.marker.AdvancedMarkerElement|undefined>} The created marker
     */
    async createShapeMarker(record, shape, color = 'red') {
        try {
            const position = this.calculateCenterPointOfShape(shape);
            if (!position) return;
            const { other } = record?.dataView || {};
            const flagElement = document.createElement('div');
            flagElement.innerHTML = `
                <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="2" width="4" height="46" fill="#333" stroke="#222" stroke-width="1"/>
                    <path d="M6 5 H30 L26 15 H30 L6 25 V5Z" fill="${color}" stroke="#555" stroke-width="1"/>
                </svg>
            `;
            flagElement.style.cursor = 'pointer';
            const { AdvancedMarkerElement } = await this.apiLoader.importLibrary('marker');
            const marker = new AdvancedMarkerElement({
                map: this.googleMap,
                position: position,
                content: flagElement,
                title: other?.title || '',
            });
            return marker;
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Centers the map to show all shapes in a group
     * @param {Array} groupRecords - Array of records in the group
     * @returns {Promise<void>}
     */
    async centerMapByGroup(groupRecords) {
        if (!this.isMapLoaded() || !Array.isArray(groupRecords)) return;
        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        const bounds = new LatLngBounds();
        groupRecords.forEach((record) => {
            const shape = this.shapes.get(record.id);
            if (shape && shape.getShape().getMap()) {
                bounds.union(shape.getBounds());
            }
        });
        this._fitMapBoundsWithLimit(bounds);
    }

    /**
     * Process record selection in batches
     * @private
     * @param {Array} records Records to process
     * @param {boolean} shouldSelect Whether to select or deselect
     * @returns {Promise} Promise resolving when complete
     */
    _processSelectionInBatches(records, shouldSelect) {
        // Process in batches to avoid UI freezing
        const batchSize = 20;
        const totalRecords = records.length;
        let processedCount = 0;

        return new Promise((resolve) => {
            const processBatch = async () => {
                const batch = records.slice(
                    processedCount,
                    Math.min(processedCount + batchSize, totalRecords)
                );

                const batchPromises = batch.map((record) =>
                    record.toggleSelection(shouldSelect).then(() => {
                        this._updateShapeSelectionState(record);
                    })
                );

                await Promise.all(batchPromises);

                processedCount += batch.length;

                if (processedCount < totalRecords) {
                    // Continue with next batch after a small delay
                    setTimeout(processBatch, 0);
                } else {
                    resolve();
                }
            };

            processBatch();
        });
    }

    /**
     * Toggles selection state of a specific record
     * @param {Object} record - Record to toggle selection for
     * @param {boolean} [pointInMap=false] - Whether to center map on selection
     */
    toggleRecordSelection(record, pointInMap = false) {
        if (!record) return;

        this.markerInfoWindow.close();

        record.toggleSelection().then(() => {
            this._updateShapeSelectionState(record);
        });

        this.props.list.selectDomain(false);
    }

    /**
     * Toggle selection of all records
     * @returns {Promise} Promise that resolves when all selections are toggled
     */
    toggleSelectionAll() {
        const list = this.props.list;
        if (!this.canSelectRecord) {
            return Promise.resolve();
        }

        const recordsToUpdate = [...list.records];
        const shouldSelect = list.selection.length !== recordsToUpdate.length;

        // Deselect domain if we're deselecting
        if (!shouldSelect) {
            list.selectDomain(false);
        }

        // Process records in batches for better UI responsiveness
        return this._processSelectionInBatches(recordsToUpdate, shouldSelect);
    }

    /**
     * Update marker appearance based on selection state
     * @private
     * @param {Object} record Record object
     */
    _updateShapeSelectionState(record) {
        if (record.selected) {
            this._selectShape(this.shapes.get(record.id));
        }
    }

    /**
     * Apply visual changes to a selected marker
     * @private
     * @param {Object} marker Marker object
     */
    async _selectShape(shape) {
        if (!shape || !this.isMapLoaded()) return;

        try {
            const bounds = shape.getBounds();
            if (bounds && !bounds.isEmpty()) {
                this.googleMap.fitBounds(bounds);
                this.googleMap.panTo(bounds.getCenter());
            }
        } catch (error) {
            console.error('Error selecting marker:', error);
        }
    }

    /**
     * Centers the map to show all shapes
     */
    centerMap() {
        if (!this.isMapLoaded()) return;
        const mapBounds = new google.maps.LatLngBounds();
        if (this.shapesBounds && !this.shapesBounds.isEmpty()) {
            mapBounds.union(this.shapesBounds);
        }
        this.googleMap.fitBounds(mapBounds);
    }

    /**
     * Fit the map to current bounds with animation
     * @private
     */
    _fitBoundsWhenReady() {
        if (this.shapesBounds && !this.shapesBounds.isEmpty()) {
            this._fitMapBoundsWithLimit(this.shapesBounds);
        }
    }

    /**
     * Fit map to bounds with max zoom limit
     * @private
     * @param {Object} bounds Bounds to fit
     */
    _fitMapBoundsWithLimit(bounds) {
        if (!this.isMapLoaded() || bounds.isEmpty()) return;

        this.googleMap.fitBounds(bounds);

        // Limit zoom level after bounds fit
        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
            google.maps.event.trigger(this.googleMap, 'resize');
            if (this.googleMap && this.googleMap.getZoom() > MAX_AUTO_ZOOM) this.googleMap.setZoom(MAX_AUTO_ZOOM);
        });
    }

    /**
     * Check if all records are selected
     */
    get selectAll() {
        const list = this.props.list;
        const nbDisplayedRecords = list.records.length;
        if (list.isDomainSelected) {
            return true;
        } else {
            return nbDisplayedRecords > 0 && list.selection.length === nbDisplayedRecords;
        }
    }

    /**
     * Check if records can be selected
     */
    get canSelectRecord() {
        return !this.props.list.editedRecord && !this.props.list.model.useSampleModel;
    }

    /**
     * Provides properties for the sidebar component
     * @returns {Object} Sidebar component properties
     */
    get sidebarProps() {
        const { viewTitle } = this.props.archInfo;
        return {
            header: viewTitle,
            title: this.props.archInfo.sidebarTitleField,
            subTitle: this.props.archInfo.sidebarSubtitleField,
            getGroupsOrRecords: this.getGroupsOrRecords.bind(this),
            openRecord: this.props.openRecord.bind(this),
            createShape: this.createShape.bind(this),
            showRecordsByDomain: this.props.showRecordsByDomain.bind(this),
            pointInMap: this.pointInMap.bind(this),
            centerMapByGroup: this.centerMapByGroup.bind(this),
            handleToggleRecordSelection: this.toggleRecordSelection.bind(this),
            handleToggleSelection: this.toggleSelectionAll.bind(this),
            handleCanSelectRecord: this.canSelectRecord,
            handleSelectAll: this.props.allowSelectors ? this.selectAll : false,
            allowSelectors: this.props.allowSelectors,
            isGrouped: !!this.props.list.isGrouped,
        };
    }
}
