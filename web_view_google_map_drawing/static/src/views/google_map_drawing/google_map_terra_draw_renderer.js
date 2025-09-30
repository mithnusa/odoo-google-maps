/**
 * @fileoverview Terra Draw Readonly Renderer for Google Maps Integration
 * 
 * This module provides a readonly display interface for Google Maps using the Terra Draw library.
 * It displays GeoJSON features with measurement capabilities but without editing functionality.
 * 
 * Key Features:
 * - Readonly display of GeoJSON features (Point, LineString, Polygon, Rectangle, Circle)
 * - Real-time measurement display for all geometry types
 * - Comprehensive measurement calculations (area, perimeter, length, coordinates)
 * - Professional number formatting with locale support
 * - Measurement unit toggling (metric/imperial)
 * - Feature selection with measurement display
 * - Click-to-view measurements on features
 * 
 * @author Yan - https://github.com/yan
 * @version 1.0.0
 * @requires Terra Draw Library
 * @requires Google Maps JavaScript API
 */

import { _t } from '@web/core/l10n/translation';
import { useService, useBus } from '@web/core/utils/hooks';
import { debounce } from '@web/core/utils/timing';
import { renderToString } from '@web/core/utils/render';
import {
    Component,
    useEffect,
    useState,
    useRef,
    useSubEnv,
    onPatched,
    onWillStart,
    onWillDestroy,
    onWillUpdateProps,
} from '@odoo/owl';
import { isNull } from '@web/views/utils';
import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { MAX_AUTO_ZOOM, MARKER_BATCH_SIZE } from '@web_view_google_map/views/google_map/google_map_renderer'; 
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';
import { GoogleMapsDrawingSidebar } from './google_map_drawing_sidebar';
import {
    loadTerraDrawAssets,
    processGeoJsonFeatures,
    addFeaturesToTerraDrawWithDebugging,
    getRandomColor,
    calculatePolygonArea,
    calculateLineStringLength,
    formatMeasurement,
    formatPointCount,
    MEASUREMENT_CONFIG,
    TERRA_DRAW_CONFIG,
} from '../../utils/terra_draw_utils';

/**
 * Terra Draw Readonly Renderer Component
 * 
 * A readonly display component that integrates Terra Draw with Google Maps
 * to display GeoJSON features with measurement capabilities.
 * 
 * @class GoogleMapTerraDrawRenderer
 * @extends Component
 * 
 * Features:
 * - Readonly display of GeoJSON features
 * - Feature selection with measurement display
 * - Real-time measurement calculations with professional formatting
 * - Measurement unit toggling (metric/imperial)
 * - Click-to-view measurements on features
 * 
 * Measurement Capabilities:
 * - Points: Coordinates with directional indicators (N/S, E/W)
 * - Lines: Length calculation with point count
 * - Polygons: Area and perimeter calculations
 * - Rectangles: Area and perimeter calculations  
 * - Circles: Area, radius, and circumference calculations
 * - Professional number formatting with appropriate units
 * 
 * Props:
 * @param {Object} googleMap - Google Maps instance
 * @param {Object} dataGeoJson - GeoJSON data to display
 * @param {boolean} showMeasurements - Whether to display measurements (default: true)
 * @param {string} measurementUnit - Unit system ('metric' or 'imperial', default: 'metric')
 */
export class GoogleMapTerraDrawRenderer extends BaseGoogleMapComponent {
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
        this.notificationService = useService('notification');
        this.uiService = useService("ui");

        this._isSidebarAction = false;

        this.state = useState({
            ...this.state,
            // flag to check if sidebar is folded or not
            sidebarIsFolded: false,
            // flag to control when to update markers
            groupDatalistId: null,
        });

        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        this.shapes = new Map();
        this.prevShapeSelected = null;
        this.currentShapeSelected = null;
        this.shapesBounds = null;
        this.terraDrawInstance = null;

        this.debounceRenderGeolocationData = debounce(this.renderGeolocationData.bind(this), 500);

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        onWillStart(async () => {
            try {
                await loadTerraDrawAssets();
            } catch (error) {
                this.notificationService.add(
                    _t('Failed to load Terra Draw assets. Please check javascript console for more information'),
                    { type: 'danger', title: _t('Error'), }
                );
            }
        });

        useEffect(
            () => {
                if (this.state.groupDatalistId && !this._isSidebarAction && this.terraDrawInstance !== null && this.isMapLoaded()) {
                    this.debounceRenderGeolocationData();
                }
                this._isSidebarAction = false;
            },
            () => [this.state.groupDatalistId]
        );

        useEffect(
            () => {
                if (!this.state.groupDatalistId && !this._isSidebarAction && this.terraDrawInstance !== null && this.isMapLoaded()) {
                    const isGrouped = this.props.list.isGrouped;
                    if (isGrouped) {
                        this.state.groupDatalistId = this._generateUniqueId();
                    } else {
                        this.debounceRenderGeolocationData();
                    }
                    this._isSidebarAction = false;
                }
            },
        );

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

        onWillDestroy(() => this._cleanup());

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
    renderGeolocationData() {
        // clear previous shapes
        if (this.terraDrawInstance) {
            this.terraDrawInstance.clear();
        }
        this.renderShapes();
    }

    async renderShapes() {
        const datas = this.getGroupsOrRecords();

        if (this.props.list.isGrouped) {
            this._renderGroupedShapes(datas);
        } else {
            this._renderUngroupShapes(datas);
        }
        // Fit map to bounds once all markers are rendered
        // this._fitBoundsWhenReady();
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
     * Render markers for ungrouped records with batching for performance
     * @private
     * @param {Array} datas Record data array
     */
    _renderUngroupShapes(datas) {
        if (!datas.length) return;

        const processBatch = (startIndex) => {
            const endIndex = Math.min(startIndex + MARKER_BATCH_SIZE, datas.length);

            for (let i = startIndex; i < endIndex; i++) {
                this.renderRecordGeoJSON(datas[i].record);
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
                records.forEach((record) => this.renderRecordGeoJSON(record, group.markerColor));
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        });
    }


    /**
     * Handles shape creation for a given record
     * @param {Object} record - The record containing shape data
     * @param {string} [color=false] - Optional color for the shape
     * @returns {Promise<Object|undefined>} The created shape object
     */
    async renderRecordGeoJSON(record, color = false) {
        try {
            const geoJson = record.data?.gshape_geojson;
            if (!geoJson || !this.terraDrawInstance) return;

            if (!geoJson?.features || !Array.isArray(geoJson.features)) {
                console.warn('Invalid GeoJSON data provided', { geoJson });
                return; // nothing to load
            }

            const recordId = {id: record.id, resId: record.resId};
            this._loadGeoJsonFeatures(geoJson, recordId, color);
        } catch (error) {
            console.error('Error creating shape:', error);
            this.notificationService.add(_t('Failed to create shape'), { type: 'danger' });
        }
    }

    async _loadGeoJsonFeatures(geoJsonData, recordId, color) {
        if (!this.terraDrawInstance || !geoJsonData) {
            return;
        }
        
        try {
            // Process features using utility function (readonly mode)
            const processedFeatures = processGeoJsonFeatures(geoJsonData, recordId, color, true);
            
            // Add features to Terra Draw with debugging
            const success = await addFeaturesToTerraDrawWithDebugging(
                this.terraDrawInstance, 
                processedFeatures, 
                'readonly'
            );
            
            if (success) {
                // Fit map to bounds
                this._fitMapToBounds(processedFeatures);
            } else {
                console.error('Failed to load readonly features into Terra Draw');
            }
            
        } catch (error) {
            console.error('Error loading GeoJSON features:', error);
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

    async _fitMapToBounds(features) {
        if (features.length <= 0 || !this.googleMap || !this.terraDrawInstance) return;
        
        try {
            if (!this.latLngBounds) {
                const { LatLngBounds } = await this.apiLoader.importLibrary('core');
                this.latLngBounds = new LatLngBounds();
            }

            features.forEach(feature => {
                this._extendBoundsFromFeature(feature);
            });

            if (!this.latLngBounds.isEmpty()) {
                this.googleMap.fitBounds(this.latLngBounds);
            }
        } catch (error) {
            console.warn('Failed to fit map bounds:', error);
        }
    }

    _extendBoundsFromFeature(feature, bounds = false) {
        const { coordinates } = feature.geometry;
        const { type } = feature.geometry;

        if (!bounds) {
            bounds = this.latLngBounds;
        }

        const coordHandlers = {
            Point: (coords) => {
                const latLng = new google.maps.LatLng(coords[1], coords[0]);
                bounds.extend(latLng);
            },
            LineString: (coords) => coords.forEach((coord) => coordHandlers.Point(coord)),
            MultiPoint: (coords) => coords.forEach((coord) => coordHandlers.Point(coord)),
            Polygon: (coords) =>
                coords.forEach((ring) => ring.forEach((coord) => coordHandlers.Point(coord))),
            MultiLineString: (coords) =>
                coords.forEach((line) => line.forEach((coord) => coordHandlers.Point(coord))),
            MultiPolygon: (coords) =>
                coords.forEach((polygon) =>
                    polygon.forEach((ring) => ring.forEach((coord) => coordHandlers.Point(coord)))
                ),
        };
        
        if (coordHandlers[type]) {
            coordHandlers[type](coordinates);
        }
    }

    /**
     * Get current groups or records data
     * @returns {Array} Array of group or record data
     */
    getGroupsOrRecords() {
        if (!this.isMapLoaded()) return [];
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
     * @override
     */
    async onMapReady(map) {
        await super.onMapReady(map);
        if (!this.latLngBounds) {
            const { LatLngBounds } = await this.apiLoader.importLibrary('core');
            this.latLngBounds = new LatLngBounds();
        }
        if (!this.markerInfoWindow) {
            this.markerInfoWindow = new google.maps.InfoWindow({ disableAutoPan: true });
        }
        this.initializeTerraDrawInstance();
    }

    /**
     * Initialize the Terra Draw instance for readonly display
     * @returns {Promise<void>}
     * @public
     */
    initializeTerraDrawInstance() {
        if (!this.googleMap) {
            new Error('Google Map instance is not available');
        }
        if (!window.terraDraw || !window.terraDrawGoogleMapsAdapter) {
            new Error('Terra Draw libraries are not loaded');
        }
        try {
            this._initializeTerraDrawInstance();
        } catch (error) {
            console.error('Failed to initialize Terra Draw instance:', error);
            this.notificationService.add(
                _t('Failed to initialize drawing tools. Please refresh the page.'),
                { type: 'danger' }
            );
        }
    }

    /**
     * Create and configure the Terra Draw instance for readonly mode
     * @private
     */
    _initializeTerraDrawInstance() {
        if (this.terraDrawInstance || !this.googleMap) {
            return;
        }

        const createTerraDrawInstance = () => {
            // Create Terra Draw instance with only selection mode (readonly)
            this.terraDrawInstance = new window.terraDraw.TerraDraw({
                adapter: new window.terraDrawGoogleMapsAdapter.TerraDrawGoogleMapsAdapter({
                    map: this.googleMap,
                    lib: google.maps,
                    coordinatePrecision: TERRA_DRAW_CONFIG.COORDINATE_PRECISION,
                }),
                modes: this._createTerraDrawModes(),
            });

            this.terraDrawInstance.start();
            this.terraDrawInstance.on('ready', () => {
                this.terraDrawInstance.setMode('select');
                this.terraDrawInstance.on('select', this.onFeatureSelect.bind(this));
                this.terraDrawInstance.on('deselect', this.onFeatureDeselect.bind(this));
                
                // Load initial GeoJSON data if available
                this.debounceRenderGeolocationData();
            });
        };

        // Check if map projection is already available
        const projection = this.googleMap.getProjection();
        if (projection) {
            createTerraDrawInstance();
        } else {
            this.eventProjectionChanges = this.googleMap.addListener('projection_changed', () => {
                if (this.eventProjectionChanges) {
                    google.maps.event.removeListener(this.eventProjectionChanges);
                    this.eventProjectionChanges = null;
                }
                createTerraDrawInstance();
            });

            this.initTimeout = setTimeout(() => {
                if (!this.terraDrawInstance && this.googleMap) {
                    if (this.eventProjectionChanges) {
                        google.maps.event.removeListener(this.eventProjectionChanges);
                        this.eventProjectionChanges = null;
                    }
                    createTerraDrawInstance();
                }
            }, 2000);
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
     * Centers the map on a specific shape
     * @param {string|number} recordId - Record ID to center on
     */
    async pointInMap(recordId) {
        if (!this.isMapLoaded() || !this.terraDrawInstance) return;
        const feature = this._getFeatureByOdooId(recordId);
        // Center map on feature
        if (feature) {
            // Ensure Terra Draw is in select mode
            if (this.terraDrawInstance.getMode() !== 'select') {
                this.terraDrawInstance.setMode('select');
            }
            const { LatLngBounds } = await this.apiLoader.importLibrary('core');
            // Reset bounds
            this.latLngBounds = new LatLngBounds()
            this._extendBoundsFromFeature(feature);
            if (!this.latLngBounds.isEmpty()) {
                this.googleMap.fitBounds(this.latLngBounds);
            }
            
            // Select feature using the correct Terra Draw API
            const featureId = feature.id;
            this.terraDrawInstance.selectFeature(featureId);
        }
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
            createShape: this.renderRecordGeoJSON.bind(this),
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

    /**
     * Handle feature selection events
     * @param {string} id - ID of the selected feature
     * @private
     */
    async onFeatureSelect(id) {
        // Open Info Window to be implemented
        // get feature by ID
        const feature = this._getFeatureById(id);
        if (!feature) {
            console.warn('Selected feature not found with ID:', id);
            return;
        } else {
            const record = this.props.list.records.find(r => r.id === feature.properties?.odoo?.id);
            const divContent = document.createElement('div');
            divContent.className = 'o_kanban_group';

            const featureContent = this._createInfoWindowContent(record);
            divContent.appendChild(featureContent);

            // Set content and position of Info Window
            if (this.markerInfoWindow) {
                this.markerInfoWindow.close();
                this.markerInfoWindow.setContent(divContent);
                try {
                    const { LatLngBounds } = await this.apiLoader.importLibrary('core');
                    const bounds = new LatLngBounds();
                    this._extendBoundsFromFeature(feature, bounds);
                    const position = bounds.getCenter();
                    if (position) {
                        this.markerInfoWindow.setPosition(position);
                        this.markerInfoWindow.open(this.googleMap);
                    }
                } catch (error) {
                    console.error('Error calculating feature center for InfoWindow:', error);
                }
            }
        }
    }

    /**
     * Handle feature deselection events
     * @private
     */
    onFeatureDeselect() {
        // this.state.selectedFeatureId = null;
        // Close Info Window to be implemented
        console.log('Feature deselected');
        this.markerInfoWindow.close();
    }

    /**
     * Get feature by ID
     * @param {string} id - Feature ID
     * @returns {Object|null} Feature object or null
     * @private
     */
    _getFeatureById(id) {
        if (!this.terraDrawInstance) {
            return null;
        }
        
        const features = this.terraDrawInstance.getSnapshot();
        return features.find(f => f.id === id) || null;
    }

    _getFeatureByOdooId(odooId) {
        if (!this.terraDrawInstance) {
            return null;
        }
        
        const features = this.terraDrawInstance.getSnapshot();
        return features.find(f => f.properties && f.properties.odoo && f.properties.odoo.id === odooId) || null;
    }

    /**
     * Get measurement for currently selected feature
     * @returns {Object|null} Measurement object or null
     * @public
     */
    getSelectedFeatureMeasurement() {
        // TODO: Move to info window
        return null;
        // if (!this.state.selectedFeatureId) {
        //     return null;
        // }
        
        // const selectedFeature = this._getFeatureById(this.state.selectedFeatureId);
        // if (selectedFeature) {
        //     return this._calculateFeatureMeasurement(selectedFeature);
        // }
        // return null;
    }

    /**
     * Calculate measurements for a given feature based on its geometry type
     * @param {Object} feature - GeoJSON feature to measure
     * @returns {Object} Measurement results with formatted strings
     * @private
     */
    _calculateFeatureMeasurement(feature) {
        console.log('Calculating measurement for feature:', feature);
        if (!feature || !feature.geometry) return null;
        
        const { type, coordinates } = feature.geometry;
        const unit = this.state.measurementUnit;
        const measurements = {};
        
        try {
            switch (type) {
                case 'Point':
                    measurements.type = 'Point';
                    const lat = coordinates[1];
                    const lng = coordinates[0];
                    const latDir = lat >= 0 ? 'N' : 'S';
                    const lngDir = lng >= 0 ? 'E' : 'W';
                    measurements.coordinates = `${Math.abs(lat).toFixed(MEASUREMENT_CONFIG.COORDINATE_PRECISION)}°${latDir}, ${Math.abs(lng).toFixed(MEASUREMENT_CONFIG.COORDINATE_PRECISION)}°${lngDir}`;
                    break;
                    
                case 'LineString':
                    const length = calculateLineStringLength(coordinates, unit);
                    measurements.type = 'Line';
                    measurements.length = formatMeasurement(length, 'distance', unit);
                    measurements.points = formatPointCount(coordinates.length);
                    break;
                    
                case 'Polygon':
                    const polygonCoords = coordinates[0]; // Outer ring
                    const area = calculatePolygonArea(polygonCoords, unit);
                    const perimeter = calculateLineStringLength(polygonCoords, unit);
                    measurements.type = 'Polygon';
                    measurements.area = formatMeasurement(area, 'area', unit);
                    measurements.perimeter = formatMeasurement(perimeter, 'distance', unit);
                    measurements.points = formatPointCount(polygonCoords.length - 1); // Subtract 1 for closed polygon
                    break;
                    
                default:
                    measurements.type = type;
                    measurements.info = 'Measurements not available for this geometry type';
            }
        } catch (error) {
            console.error('Error calculating measurement:', error);
            measurements.error = 'Error calculating measurements';
        }
        
        return measurements;
    }

    /**
     * Show measurement notification
     * @param {Object} measurement - Measurement object to display
     * @private
     */
    _showMeasurementNotification(measurement) {
        if (!measurement) return;
        
        let message = `${measurement.type} Measurements:\n`;
        const details = [];
        
        if (measurement.coordinates) details.push(`Coordinates: ${measurement.coordinates}`);
        if (measurement.length) details.push(`Length: ${measurement.length}`);
        if (measurement.area) details.push(`Area: ${measurement.area}`);
        if (measurement.perimeter) details.push(`Perimeter: ${measurement.perimeter}`);
        if (measurement.radius) details.push(`Radius: ${measurement.radius}`);
        if (measurement.circumference) details.push(`Circumference: ${measurement.circumference}`);
        if (measurement.points) details.push(`Points: ${measurement.points}`);
        if (measurement.info) details.push(measurement.info);
        if (measurement.error) details.push(measurement.error);
        
        if (details.length > 0) {
            message += details.join('\n');
        }
        
        this.notificationService.add(message, {
            title: _t('Feature Measurements'),
            type: 'info',
            sticky: true,
        });
    }

    /**
     * Toggle measurement unit between metric and imperial
     * @public
     */
    toggleMeasurementUnit() {
        // TODO: Move to info window
        // const newUnit = this.state.measurementUnit === MEASUREMENT_CONFIG.UNITS.METRIC ? 
        //     MEASUREMENT_CONFIG.UNITS.IMPERIAL : 
        //     MEASUREMENT_CONFIG.UNITS.METRIC;
        
        // this.state.measurementUnit = newUnit;
        
        // // Refresh measurement for selected feature
        // if (this.state.selectedFeatureId && this.state.showMeasurements) {
        //     const measurement = this.getSelectedFeatureMeasurement();
        //     if (measurement) {
        //         this._showMeasurementNotification(measurement);
        //     }
        // }
    }

    /**
     * Toggle measurement display on/off
     * @public
     */
    toggleMeasurementDisplay() {
        // TODO: Move to info window
        // this.state.showMeasurements = !this.state.showMeasurements;
    }

    /**
     * Get all features currently loaded
     * @returns {Array} Array of GeoJSON features
     * @public
     */
    getAllFeatures() {
        if (!this.terraDrawInstance) {
            return [];
        }
        return this.terraDrawInstance.getSnapshot();
    }

    /**
     * Get measurements for all loaded features
     * @returns {Array} Array of measurement objects
     * @public
     */
    getAllFeatureMeasurements() {
        const features = this.getAllFeatures();
        return features.map(feature => ({
            id: feature.id,
            measurement: this._calculateFeatureMeasurement(feature)
        })).filter(item => item.measurement);
    }


    /**
     * Prepare values for info window template
     * @private
     * @param {Object} record Record data
     * @param {boolean} isMulti Whether this is one of multiple records
     * @returns {Object} Template values
     */
    prepareInfoWindowValues(record, isMulti = false) {
        const { geolocation, other } = record.dataView;

        const values = {
            title: other.title || '',
            destination: geolocation ? `${geolocation.lat},${geolocation.lng}` : '',
            isMulti,
        };

        if (other.subTitle) {
            if (typeof other.subTitle === 'string') {
                values.subTitle = other.subTitle;
            } else if (Array.isArray(other.subtitle)) {
                values.subTitle = other.subTitle.join(' ');
            } else if (typeof other.subTitle === 'object') {
                values.subTitle = other.subTitle?.display_name || Object.values(other.subTitle).join(' ');
            }
        } else {
            values.subTitle = '';
        }
        return values;
    }

    /**
     * Create info window content for a record
     * @private
     * @param {Object} record Record to show in info window
     * @param {boolean} isMulti Whether this is one of multiple records
     * @returns {HTMLElement} Info window content
     */
    _createInfoWindowContent(record, isMulti = false) {
        if (!record?.dataView) return null;

        const content = this._generateInfoWindowHtml(record, isMulti);

        try {
            const divContent = new DOMParser()
                .parseFromString(content, 'text/html')
                .querySelector('div');

            if (!divContent) return null;

            const openButton = divContent.querySelector('#btn-open_form');
            if (openButton) {
                openButton.addEventListener('click', () => this.props.showRecord(record), false);
            }

            return divContent;
        } catch (error) {
            console.error('Error creating info window content:', error);
            return null;
        }
    }

    /**
     * Generate HTML for info window
     * @private
     * @param {Object} record Record data
     * @param {boolean} isMulti Whether this is one of multiple records
     * @returns {string} HTML content
     */
    _generateInfoWindowHtml(record, isMulti = false) {
        const values = this.prepareInfoWindowValues(record, isMulti);
        return renderToString(this.infoWindowTemplate, values);
    }

    getShapeColor() {
        return getRandomColor();
    }

    get featureOptions() {
        return {
            feature: {
                draggable: false,
                rotateable: false,
                coordinates: {
                    midpoints: false,
                    draggable: false,
                    deletable: false,
                },
            },
        };
    }

    /**
     * Get info window template name
     */
    get infoWindowTemplate() {
        return 'web_view_google_map_drawing.ShapeInfoWindow';
    }

    _createTerraDrawModes() {
        const modes = [];
        const modeCreators = [
            { name: 'Select', creator: () => this._createTerraDrawSelectMode() },
            { name: 'Point', creator: () => this._createTerraDrawPointMode() },
            { name: 'LineString', creator: () => this._createTerraDrawLineStringMode() },
            { name: 'Polygon', creator: () => this._createTerraDrawPolygonMode() },
            { name: 'Rectangle', creator: () => this._createTerraDrawRectangleMode() },
            { name: 'Circle', creator: () => this._createTerraDrawCircleMode() },
            { name: 'Freehand', creator: () => this._createTerraDrawFreehandMode() },
        ];
        
        modeCreators.forEach(({ name, creator }) => {
            try {
                modes.push(creator());
            } catch (error) {
                console.error(`Failed to create ${name} mode:`, error);
                this.notificationService.add(
                    _t('Failed to initialize %s drawing mode', name),
                    { title: _t('Error'), type: 'warning' }
                );
            }
        });
        
        return modes;
    }

    /**
     * Create Terra Draw select mode for selecting and manipulating existing features
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawSelectMode instance
     * @private
     */
    _createTerraDrawSelectMode(options) {
        const opt = Object.assign(
            {
                flags: {
                    polygon: this.featureOptions,
                    linestring: this.featureOptions,
                    point: {
                        feature: {
                            draggable: false,
                            rotateable: false,
                        },
                    },
                    rectangle: this.featureOptions,
                    circle: this.featureOptions,
                    freehand: this.featureOptions,
                },
            },
            options || {}
        );
        return new window.terraDraw.TerraDrawSelectMode(opt);
    }

    /**
     * Create Terra Draw point mode for drawing individual points
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawPointMode instance
     * @private
     */
    _createTerraDrawPointMode(options) {
        const opt = Object.assign(
            { editable: false },
            options || {}
        );
        return new window.terraDraw.TerraDrawPointMode(opt);
    }

    /**
     * Create Terra Draw line string mode for drawing connected line segments
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawLineStringMode instance
     * @private
     */
    _createTerraDrawLineStringMode(options) {
        const opt = Object.assign(
            { editable: false },
            options || {}
        );
        return new window.terraDraw.TerraDrawLineStringMode(opt);
    }

    /**
     * Create Terra Draw polygon mode for drawing closed polygon shapes
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawPolygonMode instance
     * @private
     */
    _createTerraDrawPolygonMode(options) {
        const opt = Object.assign(
            {
                editable: false,
                styles: {
                    lineWidth: 0.5
                }
            },
            options || {}
        );
        return new window.terraDraw.TerraDrawPolygonMode(opt);
    }

    /**
     * Create Terra Draw rectangle mode for drawing rectangular shapes
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawRectangleMode instance
     * @private
     */
    _createTerraDrawRectangleMode(options) {
        const opt = Object.assign(
            { editable: false },
            options || {}
        );
        return new window.terraDraw.TerraDrawRectangleMode(opt);
    }

    /**
     * Create Terra Draw circle mode for drawing circular shapes
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawCircleMode instance
     * @private
     */
    _createTerraDrawCircleMode(options) {
        const opt = Object.assign(
            { editable: false },
            options || {}
        );
        return new window.terraDraw.TerraDrawCircleMode(opt);
    }

    /**
     * Create Terra Draw freehand mode for drawing freeform shapes
     * @param {Object} options - Optional configuration to override defaults
     * @returns {Object} TerraDrawFreehandMode instance
     * @private
     */
    _createTerraDrawFreehandMode(options) {
        const opt = Object.assign(
            { editable: false },
            options || {}
        );
        return new window.terraDraw.TerraDrawFreehandMode(opt);
    }

    /**
     * Cleanup Terra Draw instance and event listeners
     * @private
     */
    _cleanup() {
        if (this.eventProjectionChanges) {
            try {
                google.maps.event.removeListener(this.eventProjectionChanges);
            } catch (error) {
                console.error('Error removing projection change listener:', error);
            }
            this.eventProjectionChanges = null;
        }
        
        if (this.initTimeout) {
            clearTimeout(this.initTimeout);
            this.initTimeout = null;
        }
        
        if (this.terraDrawInstance) {
            try {
                this.terraDrawInstance.off('ready');
                this.terraDrawInstance.off('select');
                this.terraDrawInstance.off('deselect');
                this.terraDrawInstance.clear();
                this.terraDrawInstance.stop();
            } catch (error) {
                console.error('Error stopping Terra Draw instance:', error);
            }
            this.terraDrawInstance = null;
        }
        // clear latLngBounds
        this.latLngBounds = null;
    }
}
