import { useRef, useState, useSubEnv, useEffect, onPatched, onWillUpdateProps } from '@odoo/owl';
import { _t } from '@web/core/l10n/translation';
import { renderToString } from '@web/core/utils/render';
import { debounce } from '@web/core/utils/timing';
import { isNull } from '@web/views/utils';
import { useBus } from '@web/core/utils/hooks';

import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { LOADER_STATUS } from '@base_google_map/utils/loader_google_map';
import { KanbanRecord } from '@web/views/kanban/kanban_record';

import { GoogleMapSidebar } from './google_map_sidebar';
import { GoogleMapGeolocate } from './components/geolocate/geolocate';
import { GoogleMapSearchPlaces } from './components/search_places/search_places';
import {
    invertColorDarken,
    AdvancedMarkerBoxSelector,
    getRecordDataView,
    generateUUID,
} from './utils';

/**
 * Maximum zoom level to apply when fitting bounds
 * @type {number}
 */
export const MAX_AUTO_ZOOM = 17;

/**
 * Number of records to process in each batch for better UI responsiveness
 * @type {number}
 */
export const MARKER_BATCH_SIZE = 100;

/**
 * Number of other markers at the same position to show before displaying "Show more" button
 * @type {number}
 */
export const MAX_INLINE_MARKERS = 2;

/**
 * Shift key code for keyboard events
 * @type {number}
 */
export const SHIFT_KEY_CODE = 16;

export class GoogleMapRenderer extends BaseGoogleMapComponent {
    static template = 'web_view_google_map.GoogleMapRenderer';
    static templateInfoWindow = 'web_view_google_map.MarkerInfoWindow';
    static components = {
        KanbanRecord,
        Geolocate: GoogleMapGeolocate,
        Sidebar: GoogleMapSidebar,
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
        viewAttrs: Object,
    };

    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.googleMapBounds = null;
        this.googleMapBoundsSelected = null;
        this.markerClusterer = null;

        // Make sidebar state non-reactive
        this._isSidebarAction = false;

        this.state = useState({
            ...this.state,
            sidebarIsFolded: false,
            // flag to Google Maps API loader status
            loaderStatus: LOADER_STATUS.NOT_LOADED,
            // flag to control when to update markers
            groupDatalistId: null,
        });
        this.markerInfoWindow = null;
        this.cache = new Map();
        this.cacheRecordDataView = new Map();
        this.mapBoxSelector = null;
        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        this._markerEventListeners = new Map();
        this._markerPositionIndex = new Map();

        this.debounceToggleRecordSelection = debounce(this.toggleRecordSelection.bind(this), 500);
        this.debounceRenderGeolocationData = debounce(this.renderGeolocationData.bind(this), 500);
        this.debounceSelectedMarkers = debounce(this.onSelectedMarkers.bind(this), 500);

        useEffect(
            () => {
                if (this.state.groupDatalistId && this.isMapLoaded() && !this._isSidebarAction) {
                    this.debounceRenderGeolocationData();
                }
                this._isSidebarAction = false;
            },
            () => [this.state.groupDatalistId]
        );

        useEffect(() => {
            if (this.isMapLoaded() && !this.state.groupDatalistId && !this._isSidebarAction) {
                const isGrouped = this.props.list.isGrouped;
                if (isGrouped) {
                    this.state.groupDatalistId = generateUUID();
                } else {
                    this.debounceRenderGeolocationData();
                }
                this._isSidebarAction = false;
            }
        });

        useSubEnv({
            mapState: this.state,
            apiLoader: this.apiLoader,
            cache: this.cache,
            googleMap: this.getGoogleMap.bind(this),
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        onWillUpdateProps((nextProps) => {
            this._invalidateMarkerPositionIndex();
            this.state.groupDatalistId = generateUUID();
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
     * @override
     */
    async onMapReady(map) {
        await super.onMapReady(map);

        if (!this.googleMapBounds) {
            // Import marker library earlier
            await this.apiLoader.importLibrary('marker');
            const { LatLngBounds } = await this.apiLoader.importLibrary('core');
            this.googleMapBounds = new LatLngBounds();
            this.googleMapBoundsSelected = new LatLngBounds();
        }
        if (!this.markerInfoWindow) {
            // this.markerInfoWindow = new google.maps.InfoWindow({ disableAutoPan: true });
            this.markerInfoWindow = new google.maps.InfoWindow();
        }
        this.initMapboxSelector();
    }

    /**
     * Initialize the map box selector for selecting markers
     * @returns
     */
    initMapboxSelector() {
        if (this.mapBoxSelector) return;
        this.mapBoxSelector = new AdvancedMarkerBoxSelector(this.googleMap);
        // Handle selection changes from the box selector
        this.mapBoxSelector.onSelectionChange = this.debounceSelectedMarkers.bind(this);
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
     * Render all markers on the map
     * @param {boolean} [noClear=false] Whether to clear existing markers
     */
    renderGeolocationData() {
        if (!this.isMapLoaded()) return;

        this.clearMarkers();

        this.renderMarkers();
    }

    onSelectedMarkers(selectedMarkers) {
        if (selectedMarkers.length === 0) {
            this.notificationService.add(
                _t(
                    'No markers are currently selected. Please ensure the map is not tilted, try to zoom in closer, and try again'
                ),
                {
                    type: 'info',
                }
            );
            return;
        }
        const records = selectedMarkers
            .map((marker) => marker._odooRecord)
            .filter((record) => !!record);
        this._processSelectionInBatches(records, true);
    }

    /**
     * Render all markers on the map
     * @private
     */
    async renderMarkers() {
        const datas = this.getGroupsOrRecords();

        // Import marker library
        await this.apiLoader.importLibrary('marker');

        // Render markers differently based on grouping
        if (this.props.list.isGrouped) {
            await this._renderGroupedMarkers(datas);
        } else {
            await this._renderUngroupedMarkers(datas);
        }

        // Fit map to bounds once all markers are rendered
        this._fitBoundsWhenReady();
    }

    /**
     * Get the Google Map instance
     * @returns {Object|null} Google Map instance
     */
    getGoogleMap() {
        return this.googleMap;
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
     * Create or update a marker for a record
     * @param {Object} record The record to create a marker for
     * @param {string} [markerColor] Optional color override for the marker
     * @param {boolean} [skipFitBounds=false] Whether to skip fitting bounds after creation
     * @returns {Promise<Object>} The marker object
     */
    async createMarker(record, markerColor, skipFitBounds = false) {
        const dataView = this.getRecordDataView(record);
        if (!dataView?.geolocation) return null;

        const { geolocation, other } = dataView;
        if (!this.isMapLoaded() || !geolocation) return null;

        try {
            // Create marker visual elements
            const elementValues = this._createMarkerElementValues(other, markerColor);

            // Update existing marker if it exists
            if (this.cache.has(record.id)) {
                return this._updateExistingMarker(record, geolocation, skipFitBounds);
            }

            // Create new marker
            const marker = await this._createNewMarker(
                record,
                geolocation,
                other,
                elementValues,
                skipFitBounds
            );
            this.mapBoxSelector?.addMarker(marker);
            return marker;
        } catch (error) {
            this._handleMarkerError(error);
            return null;
        }
    }

    /**
     * Clear all markers from the map
     * @returns {Promise} Promise that resolves when markers are cleared
     */
    async clearMarkers() {
        // Clean up marker clusterer
        if (this.markerClusterer) {
            this.markerClusterer.clearMarkers();
        }

        if (this.mapBoxSelector) {
            this.mapBoxSelector.clearSelection(true);
        }

        // Remove all markers from the map and clear event listeners
        this.cache.forEach((marker, id) => {
            marker.map = null;
            this._removeMarkerEventListeners(id);
        });

        this.cacheRecordDataView.clear();
        this._markerEventListeners.clear();
        this._markerPositionIndex.clear();
        this.cache.clear();
        this._invalidateMarkerPositionIndex();

        // Reset map bounds
        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        this.googleMapBounds = new LatLngBounds();
        this.googleMapBoundsSelected = new LatLngBounds();
    }

    /**
     * Center the map to show all markers
     * @async
     * @param {boolean} [silent=false] Whether to suppress notifications when no markers found
     * @returns {Promise<void>}
     */
    async centerMap() {
        if (!this.isMapLoaded()) return;

        try {
            const { LatLngBounds } = await this.apiLoader.importLibrary('core');
            const mapBounds = new LatLngBounds();
            this.cache.forEach((marker) => {
                if (marker.map) {
                    mapBounds.extend(marker.position);
                }
            });
            this._fitMapBoundsWithLimit(mapBounds);
        } catch (error) {
            console.error('Error centering map:', error);
            this.notificationService.add(_t('Failed to center map. Please try again.'), {
                type: 'warning',
            });
        }
    }

    /**
     * Hide markers for specific group records
     * @param {Array} groupRecords Records to hide
     */
    hideGroupRecordsMarker(groupRecords) {
        if (!Array.isArray(groupRecords)) return;

        groupRecords.forEach((record) => {
            const marker = this.cache.get(record.id);
            if (marker) {
                marker.map = null;
            }
        });

        this.centerMap();
    }

    /**
     * Center map on a specific group of records
     * @param {Array} groupRecords Records to center on
     */
    async centerMapByGroup(groupRecords) {
        if (!this.isMapLoaded() || !Array.isArray(groupRecords)) return;
        this.markerInfoWindow?.close();
        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        const bounds = new LatLngBounds();
        groupRecords.forEach((record) => {
            const marker = this.cache.get(record.id);
            if (marker && marker.map) {
                bounds.extend(marker.position);
            }
        });
        this._fitMapBoundsWithLimit(bounds);
    }
    /**
     * Focus the map on a specific record
     * @param {string|number} recordId ID of the record to focus
     */
    pointInMap(recordId) {
        const marker = this.cache.get(recordId);
        if (!marker) return;

        const position = marker.position;
        this.markerInfoWindow?.close();
        this.googleMap.panTo(position);

        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
            const currentZoom = this.googleMap.getZoom();
            google.maps.event.trigger(marker, 'click');
            if (marker._isShifted && currentZoom < 21) {
                this.googleMap.setZoom(21);
            } else if (currentZoom < 14) {
                this.googleMap.setZoom(14);
            }
            this.markerInfoWindow.setPosition(position);
        });
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
     * Toggle selection of a record
     * @param {Object} record Record to toggle selection
     * @param {boolean} [pointInMap=false] Whether to center the map on the record
     */
    toggleRecordSelection(record, pointInMap = false) {
        if (!record) return;

        this.markerInfoWindow.close();

        record.toggleSelection().then(() => {
            this._updateMarkerSelectionState(record);
        });

        this.props.list.selectDomain(false);

        if (pointInMap && record._marker) {
            this.googleMap.panTo(record._marker.position);
        }
    }

    //--------------------------------------------------------------------------
    // Getters
    //--------------------------------------------------------------------------

    /**
     * Get sidebar props for the sidebar component
     */
    get sidebarProps() {
        const { viewTitle } = this.props.archInfo;
        return {
            header: viewTitle,
            title: this.props.archInfo.sidebarTitleField,
            subTitle: this.props.archInfo.sidebarSubtitleField,
            getGroupsOrRecords: this.getGroupsOrRecords.bind(this),
            createMarker: this.createMarker.bind(this),
            openRecord: this.props.openRecord.bind(this),
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
     * Check if records can be selected
     */
    get canSelectRecord() {
        return !this.props.list.editedRecord && !this.props.list.model.useSampleModel;
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
     * Get data view for a record, with caching
     * @param {*} record
     * @returns Object Data view for the record
     */
    getRecordDataView(record) {
        if (this.cacheRecordDataView.has(record.id)) {
            const cachedDataView = this.cacheRecordDataView.get(record.id);
            return cachedDataView;
        }
        const dataView = getRecordDataView(record, this.props.viewAttrs || {});
        this.cacheRecordDataView.set(record.id, dataView);
        return dataView;
    }

    /**
     * Prepare values for info window template
     * @private
     * @param {Object} record Record data
     * @returns {Object} Template values
     */
    prepareInfoWindowValues(record) {
        const dataView = this.getRecordDataView(record);
        const { geolocation, other } = dataView;

        return {
            title: other.title || '',
            destination: geolocation ? `${geolocation.lat},${geolocation.lng}` : '',
            subTitle: other.subTitle || '',
        };
    }

    //--------------------------------------------------------------------------
    // Private Methods
    //--------------------------------------------------------------------------

    /**
     * Apply visual changes to a selected marker
     * @private
     * @param {Object} marker Marker object
     */
    async _selectMarker(marker) {
        if (!marker || !this.isMapLoaded()) return;

        try {
            // Center map on marker
            this.googleMap.panTo(marker.position);
            this.googleMap.setZoom(14);

            // Trigger click to show info
            google.maps.event.trigger(marker, 'click');
        } catch (error) {
            console.error('Error selecting marker:', error);
        }
    }

    /**
     * Apply visual changes to a deselected marker
     * @private
     * @param {Object} marker Marker object
     */
    async _deselectMarker(marker) {
        if (!marker || !this.isMapLoaded()) return;

        try {
            // Center map on marker
            this.googleMap.panTo(marker.position);
            this.googleMap.setZoom(14);

            // Close info window
            this.markerInfoWindow.close();
        } catch (error) {
            console.error('Error deselecting marker:', error);
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
                        this._updateMarkerSelectionState(record);
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
     * Create marker element values (color, scale, etc.)
     * @private
     * @param {Object} data Record data
     * @param {string} markerColor Marker color
     * @param {number} scale Marker scale
     * @returns {Object} Marker element configuration
     */
    _createMarkerElementValues(data, markerColor) {
        const color = markerColor || data.__geoColor || this.props.archInfo.__geoColor || 'red';
        const borderColor = invertColorDarken(color);

        return {
            color,
            background: color,
            glyphColor: borderColor,
            borderColor: borderColor,
        };
    }
    /**
     * Create marker options
     * @private
     * @param {Object} geolocation Latitude/longitude object
     * @param {Object} data Record data
     * @returns {Object} Marker options
     */
    _createMarkerOptions(geolocation, data) {
        return {
            position: geolocation,
            map: this.googleMap,
            title: data.title || '',
        };
    }

    /**
     * Fit the map to current bounds with animation
     * @private
     */
    _fitBoundsWhenReady() {
        if (this.googleMapBoundsSelected && !this.googleMapBoundsSelected.isEmpty()) {
            this._fitMapBoundsWithLimit(this.googleMapBoundsSelected);
            return;
        }
        if (this.googleMapBounds && !this.googleMapBounds.isEmpty()) {
            this._fitMapBoundsWithLimit(this.googleMapBounds);
        }
    }

    /**
     * Render markers for ungrouped records with batching for performance
     * @private
     * @param {Array} datas Record data array
     * @returns {Promise} Promise that resolves when all markers are rendered
     */
    _renderUngroupedMarkers(datas) {
        if (!datas.length) return Promise.resolve();

        return new Promise((resolve) => {
            const processBatch = (startIndex) => {
                const endIndex = Math.min(startIndex + MARKER_BATCH_SIZE, datas.length);

                for (let i = startIndex; i < endIndex; i++) {
                    // Skip fitting bounds during batch creation for performance
                    this.createMarker(datas[i].record, undefined, true);
                }

                if (endIndex < datas.length) {
                    // Use requestIdleCallback if available, otherwise setTimeout
                    if (window.requestIdleCallback) {
                        window.requestIdleCallback(() => processBatch(endIndex));
                    } else {
                        setTimeout(() => processBatch(endIndex), 10);
                    }
                } else {
                    // All markers have been created, resolve the promise
                    resolve();
                }
            };

            if (window.requestIdleCallback) {
                window.requestIdleCallback(() => processBatch(0));
            } else {
                setTimeout(() => processBatch(0), 10);
            }
        });
    }

    /**
     * Render markers for grouped records
     * @private
     * @param {Array} datas Grouped data array
     * @returns {Promise} Promise that resolves when all markers are rendered
     */
    async _renderGroupedMarkers(datas) {
        const groupPromises = datas.map(async ({ group }) => {
            try {
                const records = await group.groupRecords();
                records.forEach((record) => {
                    // Skip fitting bounds during batch creation for performance
                    this.createMarker(record, group.groupColor, true);
                });
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        });

        // Wait for all groups to finish creating their markers
        await Promise.all(groupPromises);
    }

    /**
     * Update map bounds with a new marker position
     * @private
     * @param {Object} marker Marker to include in bounds
     * @param {boolean} [skipFitBounds=false] Whether to skip fitting bounds
     */
    _updateMapBounds(marker, skipFitBounds = false) {
        if (!this.isMapLoaded() || !marker) return;

        // Update marker clustering
        this._updateMarkerClusterer(marker);

        // Extend map bounds
        this.googleMapBounds.extend(marker.position);

        if (marker._odooRecord?.selected) {
            this.googleMapBoundsSelected.extend(marker.position);
        }

        // Fit bounds if requested
        if (!skipFitBounds) {
            if (!this.googleMapBoundsSelected.isEmpty()) {
                this._fitMapBoundsWithLimit(this.googleMapBoundsSelected);
            } else {
                this._fitMapBoundsWithLimit(this.googleMapBounds);
            }
        }
    }

    /**
     * Fit map to bounds with max zoom limit
     * @private
     * @param {Object} bounds Bounds to fit
     */
    _fitMapBoundsWithLimit(bounds) {
        if (!this.isMapLoaded() || bounds.isEmpty()) return;

        // Add padding to prevent markers from being pushed to the edge
        // Padding is in pixels and creates space between markers and viewport edges
        this.googleMap.fitBounds(bounds, 50);

        // Limit zoom level after bounds fit
        if (google.maps?.event) {
            google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                if (this.googleMap && this.googleMap.getZoom() > MAX_AUTO_ZOOM) {
                    this.googleMap.setZoom(MAX_AUTO_ZOOM);
                }
            });
        }
    }

    /**
     * Update marker clusterer
     * @private
     * @param {Object} marker Marker to add to clusterer
     */
    _updateMarkerClusterer(marker) {
        // Skip if clustering disabled or map/marker not available
        if (this.props.archInfo.disableMarkerCluster || !this.isMapLoaded() || !marker) return;

        // Initialize clusterer if not exists
        if (!this.markerClusterer) {
            this._initMarkerClusterer();
        }

        if (!this.markerClusterer) return;

        // Ensure clusterer is attached to map
        if (!this.markerClusterer.map) {
            this.markerClusterer.setMap(this.googleMap);
        }

        // Add marker to clusterer
        this.markerClusterer.addMarker(marker);
    }

    /**
     * Initialize marker clusterer
     * @private
     */
    _initMarkerClusterer() {
        try {
            // Create clusterer with options
            this.markerClusterer = new markerClusterer.MarkerClusterer({
                map: this.googleMap,
                onClusterClick: (event, cluster, map) => {
                    this.markerInfoWindow.close();
                    this._fitMapBoundsWithLimit(cluster.bounds);
                },
            });
        } catch (error) {
            console.error(error);
            this.notificationService.add(
                _t(
                    "Something went wrong. Marker Clusterer couldn't be created. See Javascript console for technical details."
                ),
                {
                    title: _t('Google Maps MarkerClusterer'),
                    type: 'danger',
                    sticky: false,
                    autocloseDelay: 2000,
                }
            );
        }
    }

    /**
     * Update an existing marker
     * @private
     * @param {Object} record Record data
     * @param {Object} geolocation Position data
     * @param {boolean} [skipFitBounds=false] Whether to skip fitting bounds
     * @returns {Object} Updated marker
     */
    _updateExistingMarker(record, geolocation, skipFitBounds = false) {
        const marker = this.cache.get(record.id);

        // Add to map if not already present
        if (!marker.map) {
            marker.map = this.googleMap;
        }

        // Update position
        marker.position = geolocation;

        // Update bounds
        this._updateMapBounds(marker, skipFitBounds);

        return marker;
    }

    /**
     * Create a new marker
     * @private
     * @param {Object} record Record data
     * @param {Object} geolocation Position data
     * @param {Object} data Additional marker data
     * @param {Object} elementValues Values for marker styling
     * @param {boolean} [skipFitBounds=false] Whether to skip fitting bounds
     * @returns {Object} New marker
     */
    async _createNewMarker(record, geolocation, data, elementValues, skipFitBounds = false) {
        const { AdvancedMarkerElement } = await this.apiLoader.importLibrary('marker');
        const content = this._createMarkerElement(record, elementValues);
        const options = this._createMarkerOptions(geolocation, data);
        options.content = content;

        // Create marker
        const marker = new AdvancedMarkerElement(options);

        // Store metadata with marker
        marker._odooRecord = record;
        marker._markerOptionValues = options;
        marker._elementValues = elementValues;

        // Store the original position before any shifts
        marker._originalPosition = {
            lat: geolocation.lat,
            lng: geolocation.lng,
        };

        // Store marker with record
        record._marker = marker;
        marker._isShifted = false;

        // Add click listener and store it for cleanup
        const clickListener = marker.addListener(
            'click',
            this._handleMarkerClick.bind(this, marker)
        );

        this._storeMarkerEventListener(record.id, 'click', clickListener);

        // Store marker in cache
        this.cache.set(record.id, marker);

        // Handle overlapping markers
        this._handleMarkersOverlapAt(marker);

        // Update map bounds
        this._updateMapBounds(marker, skipFitBounds);

        return marker;
    }

    /**
     * Slightly shift markers that overlap at the same position
     * Arranges overlapping markers in a circular pattern
     * @param {*} marker
     */
    _handleMarkersOverlapAt(marker) {
        const OVERLAP_OFFSET_RADIUS = 0.00009; // ~10 meters at equator

        // Get the original position of the new marker
        const originalLat = marker._originalPosition.lat;
        const originalLng = marker._originalPosition.lng;

        // Count how many markers already exist at this original position
        let overlapIndex = 0;

        for (const [, m] of this.cache) {
            if (m !== marker && m._originalPosition) {
                // Compare against the original positions (before any shifts)
                if (
                    Math.abs(m._originalPosition.lat - originalLat) < 0.000001 &&
                    Math.abs(m._originalPosition.lng - originalLng) < 0.000001
                ) {
                    overlapIndex++;
                }
            }
        }

        // If there's overlap, arrange markers in a circle
        if (overlapIndex > 0) {
            // Calculate angle for this marker's position in the circle
            // Distribute markers evenly around 360 degrees
            const angle = (overlapIndex * 2 * Math.PI) / (overlapIndex + 1);

            // Calculate offset using polar coordinates
            const offsetLat = Math.sin(angle) * OVERLAP_OFFSET_RADIUS;
            const offsetLng = Math.cos(angle) * OVERLAP_OFFSET_RADIUS;

            // Apply the offset to the original position
            marker.position = {
                lat: originalLat + offsetLat,
                lng: originalLng + offsetLng,
            };

            marker._isShifted = true;

            // Draw a line from shifted marker to original position
            this._drawConnectionLine(marker);
        }
    }

    /**
     * Draw a line connecting a shifted marker to its original position
     * @param {*} marker The shifted marker
     */
    _drawConnectionLine(marker) {
        if (!marker._isShifted || !marker._originalPosition) return;

        const lineSymbol = {
            path: 'M 0,-1 0,1',
            strokeOpacity: 0.6,
            strokeWeight: 1,
            scale: 2,
        };

        const line = new google.maps.Polyline({
            path: [
                marker._originalPosition,
                { lat: marker.position.lat, lng: marker.position.lng },
            ],
            strokeColor: '#999999',
            strokeOpacity: 0,
            strokeWeight: 1,
            icons: [
                {
                    icon: lineSymbol,
                    offset: '0',
                    repeat: '10px',
                },
            ],
            map: this.googleMap,
        });

        // Store the line reference on the marker for cleanup
        marker._connectionLine = line;
    }

    _createMarkerElement(record, elementValues) {
        const content = document.createElement('div');
        if (record.selected) {
            content.className = 'marker-circle selected';
        } else {
            content.className = 'marker-circle';
        }
        content.style.background = elementValues.background;
        content.style.border = '2px solid #fafafa';
        return content;
    }

    /**
     * Handle marker creation errors
     * @private
     * @param {Error} error The error that occurred
     */
    _handleMarkerError(error) {
        console.error('Marker creation error:', error);

        this.notificationService.add(
            _t(
                "Something went wrong. Marker couldn't be created. See Javascript console for technical details."
            ),
            {
                title: _t('Google Maps Marker'),
                type: 'danger',
                sticky: false,
                autocloseDelay: 2000,
            }
        );
    }

    /**
     * Store marker event listener for later cleanup
     * @private
     * @param {string|number} markerId Marker ID
     * @param {string} eventType Event type
     * @param {Object} listener Event listener
     */
    _storeMarkerEventListener(markerId, eventType, listener) {
        if (!this._markerEventListeners.has(markerId)) {
            this._markerEventListeners.set(markerId, new Map());
        }

        this._markerEventListeners.get(markerId).set(eventType, listener);
    }

    /**
     * Remove all event listeners for a marker
     * @private
     * @param {string|number} markerId Marker ID
     */
    _removeMarkerEventListeners(markerId) {
        const listeners = this._markerEventListeners.get(markerId);

        if (listeners) {
            listeners.forEach((listener) => {
                google.maps.event.removeListener(listener);
            });

            this._markerEventListeners.delete(markerId);
        }
    }

    /**
     * Rebuild marker position index if it's invalid
     * @private
     */
    _rebuildMarkerPositionIndexIfNeeded() {
        this.cache.forEach((m) => {
            if (m.position) {
                const posKey = `${m.position.lat},${m.position.lng}`;

                if (!this._markerPositionIndex.has(posKey)) {
                    this._markerPositionIndex.set(posKey, []);
                }

                this._markerPositionIndex.get(posKey).push(m);
            }
        });
    }

    /**
     * Invalidate the marker position index
     * @private
     */
    _invalidateMarkerPositionIndex() {
        this._markerPositionIndex.clear();
        if (this.markerInfoWindow) {
            this.markerInfoWindow.close();
        }
    }

    /**
     * Handle marker click
     * @private
     * @param {Object} marker Clicked marker
     */
    _handleMarkerClick(marker) {
        // Create content container
        const bodyContent = document.createElement('div');
        bodyContent.className = 'o_kanban_group';

        try {
            // Add main marker info
            const markerContent = this._createInfoWindowContent(marker._odooRecord, marker._isShifted);
            if (markerContent) {
                bodyContent.appendChild(markerContent);
            }

            // Show info window
            this.markerInfoWindow.setContent(bodyContent);
            this.markerInfoWindow.open(this.googleMap, marker);
        } catch (error) {
            console.error('Error handling marker click:', error);
        }
    }

    /**
     * Create info window content for a record
     * @private
     * @param {Object} record Record to show in info window
     * @returns {HTMLElement} Info window content
     */
    _createInfoWindowContent(record, isShifted = false) {
        const dataView = this.getRecordDataView(record);
        if (!dataView) return null;

        const content = this._generateInfoWindowHtml(record, isShifted);

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
     * @returns {string} HTML content
     */
    _generateInfoWindowHtml(record, isShifted = false) {
        const values = this.prepareInfoWindowValues(record);
        return renderToString(this.constructor.templateInfoWindow, { ...values, isShifted });
    }

    /**
     * Update marker appearance based on selection state
     * @private
     * @param {Object} record Record object
     */
    _updateMarkerSelectionState(record) {
        if (record.selected) {
            this._selectMarker(this.cache.get(record.id));
        } else {
            this._deselectMarker(this.cache.get(record.id));
        }
    }

    _cleanUp() {
        super._cleanUp();
        // Remove all markers from the map and clear event listeners
        for (const [id, marker] of this.cache) {
            // Remove connection line if exists
            if (marker._connectionLine) {
                marker._connectionLine.setMap(null);
                delete marker._connectionLine;
            }
            marker.map = null;
            this._removeMarkerEventListeners(id);
        }
        this.cacheRecordDataView.clear();
        this.cache.clear();

        this._markerPositionIndex.clear();
        this._markerEventListeners.clear();

        if (this.mapBoxSelector) {
            this.mapBoxSelector.destroy();
            this.mapBoxSelector = null;
        }
    }
}
