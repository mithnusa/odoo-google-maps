import {
    useRef,
    useState,
    useSubEnv,
    useEffect,
    onPatched,
    onWillUpdateProps,
    useExternalListener,
} from '@odoo/owl';
import { _t } from '@web/core/l10n/translation';
import { renderToString } from '@web/core/utils/render';
import { debounce } from '@web/core/utils/timing';
import { isNull } from '@web/views/utils';
import { useBus } from '@web/core/utils/hooks';

import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { LOADER_STATUS } from '@base_google_map/utils/loader_google_map';

import { GoogleMapSidebar } from './google_map_sidebar';
import { GoogleMapGeolocate } from './components/geolocate/geolocate';
import { GoogleMapSearchPlaces } from './components/search_places/search_places';
import { invertColorDarken } from './utils';

/**
 * Maximum zoom level to apply when fitting bounds
 * @type {number}
 */
const MAX_AUTO_ZOOM = 17;

/**
 * Number of records to process in each batch for better UI responsiveness
 * @type {number}
 */
const MARKER_BATCH_SIZE = 100;

/**
 * Number of other markers at the same position to show before displaying "Show more" button
 * @type {number}
 */
const MAX_INLINE_MARKERS = 2;

/**
 * Shift key code for keyboard events
 * @type {number}
 */
const SHIFT_KEY_CODE = 16;

export class GoogleMapRenderer extends BaseGoogleMapComponent {
    static template = 'web_view_google_map.GoogleMapRenderer';
    static components = {
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
    };

    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.googleMapBounds = null;
        this.markerClusterer = null;

        // Make sidebar state non-reactive
        this._isSidebarAction = false;

        this.state = useState({
            sidebarIsFolded: false,
            // flag to Google Maps API loader status
            loaderStatus: LOADER_STATUS.NOT_LOADED,
            // flag to control when to update markers
            groupDatalistId: null,
        });
        this.markerInfoWindow = null;
        this.cache = new Map();
        this.isShiftKeyPressed = false;
        this._markerPositionIndex = null;
        this._markerEventListeners = new Map();

        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        this.debounceToggleRecordSelection = debounce(this.toggleRecordSelection.bind(this), 500);

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

        useSubEnv({
            mapState: this.state,
            apiLoader: this.apiLoader,
            cache: this.cache,
            googleMap: this.getGoogleMap.bind(this),
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        onWillUpdateProps((nextProps) => {
            this._invalidateMarkerPositionIndex();
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

        useExternalListener(window, 'keydown', this._handleKeyDown, { capture: true });
        useExternalListener(window, 'keyup', this._handleKeyUp, { capture: true });

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
     * @override
     */
    updateLoaderState(status) {
        status = status || LOADER_STATUS.FAILED;
        this.state.loaderStatus = status;
    }

    /**
     * Render all markers on the map
     * @param {boolean} [noClear=false] Whether to clear existing markers
     */
    renderGeolocationData(noClear = false) {
        if (!this.isMapLoaded()) return;

        if (!noClear) {
            this.clearMarkers();
        }

        this.renderMarkers();
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
            this._renderGroupedMarkers(datas);
        } else {
            this._renderUngroupedMarkers(datas);
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
     * Create or update a marker for a record
     * @param {Object} record The record to create a marker for
     * @param {string} [markerColor] Optional color override for the marker
     * @returns {Promise<Object>} The marker object
     */
    async createMarker(record, markerColor) {
        if (!record?.dataView?.geolocation) return null;

        const { geolocation, other } = record.dataView;
        if (!this.isMapLoaded() || !geolocation) return null;

        try {
            const { AdvancedMarkerElement, PinElement } =
                await this.apiLoader.importLibrary('marker');

            // Determine marker scale based on selection state
            const scale = record.selected ? 1.3 : 1;

            // Create marker visual elements
            const elementValues = this._createMarkerElementValues(other, markerColor, scale);
            const pinEl = new PinElement(elementValues);

            // Update existing marker if it exists
            if (this.cache.has(record.id)) {
                return this._updateExistingMarker(record, geolocation, pinEl);
            }

            // Create new marker
            return this._createNewMarker(
                record,
                geolocation,
                other,
                pinEl,
                elementValues,
                AdvancedMarkerElement
            );
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

        // Remove all markers from the map and clear event listeners
        this.cache.forEach((marker, id) => {
            marker.map = null;
            this._removeMarkerEventListeners(id);
        });

        this.cache.clear();
        this._invalidateMarkerPositionIndex();

        // Reset map bounds
        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        this.googleMapBounds = new LatLngBounds();
    }

    /**
     * Center the map to show all markers
     */
    async centerMap() {
        if (!this.isMapLoaded()) return;

        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        const mapBounds = new LatLngBounds();

        let hasMarkers = false;

        this.cache.forEach((marker) => {
            if (marker.map) {
                mapBounds.extend(marker.position);
                hasMarkers = true;
            }
        });

        if (hasMarkers) {
            this._fitMapBoundsWithLimit(mapBounds);
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
        this.markerInfoWindow.close();
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
        this.markerInfoWindow.close();
        this.googleMap.panTo(position);

        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
            google.maps.event.trigger(marker, 'gmp-click');
            if (this.googleMap.getZoom() < 14) this.googleMap.setZoom(14);
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
     * Get info window template name
     */
    get infoWindowTemplate() {
        return 'web_view_google_map.MarkerInfoWindow';
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

    //--------------------------------------------------------------------------
    // Private Methods
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    async onMapReady() {
        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        this.googleMapBounds = new LatLngBounds();
        this.markerInfoWindow = new google.maps.InfoWindow({ disableAutoPan: true });
    }
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
            google.maps.event.trigger(marker, 'gmp-click');
        } catch (error) {
            console.error('Error selecting marker:', error);
        }
    }

    /**
     * Prepare values for info window template
     * @private
     * @param {Object} record Record data
     * @param {boolean} isMulti Whether this is one of multiple records
     * @returns {Object} Template values
     */
    _prepareInfoWindowValues(record, isMulti = false) {
        const { geolocation, other } = record.dataView;

        return {
            title: other.title || '',
            destination: geolocation ? `${geolocation.lat},${geolocation.lng}` : '',
            subTitle: other.subTitle || '',
            isMulti,
        };
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
    _createMarkerElementValues(data, markerColor, scale = 1) {
        const color = markerColor || data.markerColor || this.props.archInfo.markerColor || 'red';
        const borderColor = invertColorDarken(color);

        return {
            background: color,
            glyphColor: borderColor,
            borderColor: borderColor,
            scale,
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
     * Handle keydown event for shift key detection
     * @private
     * @param {KeyboardEvent} event The keyboard event
     */
    _handleKeyDown(event) {
        if (event.keyCode === SHIFT_KEY_CODE || event.which === SHIFT_KEY_CODE) {
            event.preventDefault();
            this.isShiftKeyPressed = true;
        }
    }

    /**
     * Handle keyup event for shift key detection
     * @private
     * @param {KeyboardEvent} event The keyboard event
     */
    _handleKeyUp(event) {
        if (event.keyCode === SHIFT_KEY_CODE || event.which === SHIFT_KEY_CODE) {
            event.preventDefault();
            this.isShiftKeyPressed = false;
        }
    }

    /**
     * Fit the map to current bounds with animation
     * @private
     */
    _fitBoundsWhenReady() {
        if (this.googleMapBounds && !this.googleMapBounds.isEmpty()) {
            this._fitMapBoundsWithLimit(this.googleMapBounds);
        }
    }

    /**
     * Render markers for ungrouped records with batching for performance
     * @private
     * @param {Array} datas Record data array
     */
    _renderUngroupedMarkers(datas) {
        if (!datas.length) return;

        const processBatch = (startIndex) => {
            const endIndex = Math.min(startIndex + MARKER_BATCH_SIZE, datas.length);

            for (let i = startIndex; i < endIndex; i++) {
                this.createMarker(datas[i].record);
            }

            if (endIndex < datas.length) {
                // Use requestIdleCallback if available, otherwise setTimeout
                if (window.requestIdleCallback) {
                    window.requestIdleCallback(() => processBatch(endIndex));
                } else {
                    setTimeout(() => processBatch(endIndex), 10);
                }
            }
        };
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => processBatch(0));
        } else {
            setTimeout(() => processBatch(0), 10);
        }
    }

    /**
     * Render markers for grouped records
     * @private
     * @param {Array} datas Grouped data array
     */
    _renderGroupedMarkers(datas) {
        datas.forEach(async ({ group }) => {
            try {
                const records = await group.groupRecords();
                records.forEach((record) => this.createMarker(record, group.markerColor));
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        });
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

        // Fit bounds if requested
        if (!skipFitBounds) {
            this._fitMapBoundsWithLimit(this.googleMapBounds);
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
     * @param {Object} pinElement Pin element
     * @returns {Object} Updated marker
     */
    _updateExistingMarker(record, geolocation, pinElement) {
        const marker = this.cache.get(record.id);

        // Update marker properties
        marker.content = pinElement.element;

        // Add to map if not already present
        if (!marker.map) {
            marker.map = this.googleMap;
        }

        // Update position
        marker.position = geolocation;

        // Update bounds
        this._updateMapBounds(marker);

        return marker;
    }

    /**
     * Create a new marker
     * @private
     * @param {Object} record Record data
     * @param {Object} geolocation Position data
     * @param {Object} data Additional marker data
     * @param {Object} pinElement Pin element
     * @param {Object} elementValues Values for marker styling
     * @param {Class} AdvancedMarkerElement Google Maps marker class
     * @returns {Object} New marker
     */
    _createNewMarker(record, geolocation, data, pinElement, elementValues, AdvancedMarkerElement) {
        // Create marker options
        const options = this._createMarkerOptions(geolocation, data);
        options.content = pinElement.element;

        // Create marker
        const marker = new AdvancedMarkerElement(options);

        // Store metadata with marker
        marker._odooRecord = record;
        marker._markerOptionValues = options;
        marker._elementValues = elementValues;

        // Store marker with record
        record._marker = marker;

        // Add click listener and store it for cleanup
        const clickListener = marker.addListener(
            'gmp-click',
            this._handleMarkerClick.bind(this, marker)
        );

        this._storeMarkerEventListener(record.id, 'gmp-click', clickListener);

        // Store marker in cache
        this.cache.set(record.id, marker);

        // Update map bounds
        this._updateMapBounds(marker);

        return marker;
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
     * Find other markers at the same position
     * @private
     * @param {Object} marker Marker to find others for
     * @returns {Array} Other records at same position
     */
    _findMarkersAtSamePosition(marker) {
        this._rebuildMarkerPositionIndexIfNeeded();

        const posKey = `${marker.position.lat},${marker.position.lng}`;
        const markersAtPosition = this._markerPositionIndex.get(posKey) || [];

        return markersAtPosition
            .filter((m) => m._odooRecord !== marker._odooRecord)
            .map((m) => m._odooRecord);
    }

    /**
     * Rebuild marker position index if it's invalid
     * @private
     */
    _rebuildMarkerPositionIndexIfNeeded() {
        if (!this._markerPositionIndex) {
            this._markerPositionIndex = new Map();

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
    }

    /**
     * Invalidate the marker position index
     * @private
     */
    _invalidateMarkerPositionIndex() {
        this._markerPositionIndex = null;
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
            const markerContent = this._createInfoWindowContent(marker._odooRecord, false);
            if (markerContent) {
                bodyContent.appendChild(markerContent);
            }

            // Add info for other records at same position (up to MAX_INLINE_MARKERS)
            const otherRecords = this._findMarkersAtSamePosition(marker);

            if (otherRecords.length > 0) {
                otherRecords.slice(0, MAX_INLINE_MARKERS).forEach((record) => {
                    const otherContent = this._createInfoWindowContent(record, true);
                    if (otherContent) {
                        bodyContent.appendChild(otherContent);
                    }
                });

                // Add "Show more" button if needed
                if (otherRecords.length > MAX_INLINE_MARKERS) {
                    this._addShowMoreButton(bodyContent, marker);
                }
            }

            // Show info window
            this.markerInfoWindow.setContent(bodyContent);
            this.markerInfoWindow.open(this.googleMap, marker);

            // Handle shift-click for selection
            if (this.isShiftKeyPressed && marker._odooRecord) {
                this.debounceToggleRecordSelection(marker._odooRecord);
            }
        } catch (error) {
            console.error('Error handling marker click:', error);
        }
    }

    /**
     * Add "Show more" button to info window
     * @private
     * @param {HTMLElement} container Container element
     * @param {Object} marker Marker object
     */
    _addShowMoreButton(container, marker) {
        const moreRecords = document.createElement('div');
        moreRecords.classList.add('pt-3', 'pb-3', 'text-center');

        const showMoreButton = document.createElement('button');
        showMoreButton.type = 'button';
        showMoreButton.className = 'btn btn-link';
        showMoreButton.textContent = _t('Show more');
        showMoreButton.addEventListener('click', () => this._handleShowMoreClick(marker), false);

        moreRecords.appendChild(showMoreButton);
        container.appendChild(moreRecords);
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
        const values = this._prepareInfoWindowValues(record, isMulti);
        return renderToString(this.infoWindowTemplate, values);
    }

    /**
     * Prepare values for info window template
     * @private
     * @param {Object} record Record data
     * @param {boolean} isMulti Whether this is one of multiple records
     * @returns {Object} Template values
     */
    _prepareInfoWindowValues(record, isMulti = false) {
        const { geolocation, other } = record.dataView;

        return {
            title: other.title || '',
            destination: geolocation ? `${geolocation.lat},${geolocation.lng}` : '',
            subTitle: other.subTitle || '',
            isMulti,
        };
    }

    /**
     * Handle "Show more" button click
     * @private
     * @param {Object} marker Marker object
     */
    async _handleShowMoreClick(marker) {
        try {
            const { lat, lng } = marker.position;
            const domain = await this._generatePositionDomain(lat, lng);
            const title = _t(`At same location (lat: ${lat.toFixed(6)}, lng: ${lng.toFixed(6)})`);

            if (!domain.length) {
                this.notificationService.add(
                    _t('Failed to construct domain. Please contact your administrator'),
                    { type: 'danger' }
                );
                return;
            }

            this.props.showRecordsByDomain(title, domain);
        } catch (error) {
            console.error("Error handling 'show more' action:", error);
            this.notificationService.add(
                _t('An error occurred while fetching additional records'),
                {
                    type: 'danger',
                }
            );
        }
    }

    /**
     * Generate domain to find records at specific coordinates
     * @private
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     * @returns {Promise<Array>} Domain array
     */
    async _generatePositionDomain(lat, lng) {
        const { latitudeField, longitudeField } = this.props.archInfo;

        try {
            const data = await this.props.list.model.orm.call(
                'google.map.view.mixins',
                'handle_get_geolocation_fields',
                [this.props.list.resModel, latitudeField, longitudeField]
            );

            if (!data) return [];

            const domain = [];
            Object.keys(data).forEach((key) => {
                if (key === latitudeField) {
                    domain.push([data[key], '=', lat]);
                } else if (key === longitudeField) {
                    domain.push([data[key], '=', lng]);
                }
            });
            return Promise.resolve(domain);
        } catch (error) {
            console.error('Error generating position domain:', error);
            return Promise.resolve([]);
        }
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
}
