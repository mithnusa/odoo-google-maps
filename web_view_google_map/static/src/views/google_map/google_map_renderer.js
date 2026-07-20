import { useLayoutEffect, useRef, useSubEnv } from '@web/owl2/utils';
import { proxy, onPatched, onWillUpdateProps, onWillStart, props, t } from '@odoo/owl';
import { _t } from '@web/core/l10n/translation';
import { renderToString } from '@web/core/utils/render';
import { debounce } from '@web/core/utils/timing';
import { isNull } from '@web/views/utils';
import { useBus } from '@web/core/utils/hooks';

import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { LOADER_STATUS } from '@base_google_map/utils/loader_google_map';
import { KanbanRecord } from '@web/views/kanban/kanban_record';

import { GoogleMapSidebar } from './google_map_sidebar';
import { GoogleMapGeolocate } from '@web_widget_google_map/components/geolocate/geolocate';
import { GoogleMapSearchPlaces } from '@web_widget_google_map/components/search_places/search_places';
import {
    darkenColor,
    lightenColor,
    AdvancedMarkerBoxSelector,
    getRecordDataView,
    loadMarkerClustererAssets,
} from './utils';

/**
 * Configuration constants for marker behavior and styling
 */
const MARKER_CONFIG = {
    OVERLAP: {
        OFFSET_RADIUS: 0.0003, // ~33 meters at equator
        POSITION_TOLERANCE: 0.00001, // ~1.1 meters — catches coordinates geocoded to the same address
    },
    VISUAL: {
        CONNECTION_LINE: {
            STROKE_COLOR: '#ee6060ff',
            STROKE_OPACITY: 0,
            STROKE_WEIGHT: 2,
            SYMBOL: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 0.6,
                strokeWeight: 2,
                scale: 2,
            },
            ICON_OFFSET: '0',
            ICON_REPEAT: '10px',
        },
        MARKER: {
            SELECTED_CLASS: 'marker-circle selected',
            DEFAULT_CLASS: 'marker-circle',
            BORDER: '2px solid #fafafa',
        },
        ZOOM: {
            DEFAULT: 15,
            SHIFTED_DETAIL: 22,
        },
        TILT: 65,
        DEFAULT_SCALE: 1,
        SELECTED_SCALE: 1.4,
        SELECTED_COLOR: '#4285F4',
    },
    NEARBY_SEARCH: {
        STROKE_COLOR: 'rgb(255, 61, 61)',
        STROKE_OPACITY: 0.8,
        STROKE_WEIGHT: 1.2,
        FILL_OPACITY: 0.3,
        DOT_SCALE: 0.5,
        DOT_REPEAT: '5px',
    },
    BOUNDS: {
        DEFAULT_PADDING: 200,
        MAX_AUTO_ZOOM: 15,
    },
    BATCH: {
        SELECTION_SIZE: 20,
        MARKER_SIZE: 100,
        IDLE_TIMEOUT: 10,
    },
};

export const googleMapRendererProps = {
    archInfo: t.object(),
    openRecord: t.function(),
    showRecord: t.function(),
    showRecordsByDomain: t.function(),
    showNearbyRecords: t.function(),
    showUnlocatedRecords: t.function(),
    showGoogleStreetViewSideBySide: t.function(),
    readonly: t.boolean(),
    list: t.object(),
    unLocatedCount: t.number(),
    onAdd: t.function().optional(),
    activeActions: t.object().optional(),
    allowSelectors: t.boolean(),
    viewAttrs: t.object(),
};

export class GoogleMapRenderer extends BaseGoogleMapComponent {
    static template = 'web_view_google_map.GoogleMapRenderer';
    static templateInfoWindow = 'web_view_google_map.MarkerInfoWindow';
    static components = {
        KanbanRecord,
        Geolocate: GoogleMapGeolocate,
        Sidebar: GoogleMapSidebar,
        InMapSearchPlaces: GoogleMapSearchPlaces,
    };
    static props = googleMapRendererProps; 
    props = props(this.constructor.props);

    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.googleMapBounds = null;
        this.googleMapBoundsSelected = null;
        this.markerClusterer = null;

        this._nearbySearchCoverageRectangle = null;
        this._nearbySearchCoveragePolylines = [];

        // Make sidebar state non-reactive
        this._isSidebarAction = false;

        this.state = proxy({
            ...this.state,
            sidebarIsFolded: false,
            // flag to Google Maps API loader status
            loaderStatus: LOADER_STATUS.NOT_LOADED,
        });

        this.markerInfoWindow = null;
        this.cache = new Map();
        this.cacheRecordDataView = new Map();
        this.mapBoxSelector = null;
        this.lastGroupsOrRecordsProps = null;
        this.cachedGroupsOrRecords = null;

        this._markerEventListeners = new Map();
        this._elementEventListeners = new Map();
        this._idleCallbackHandles = new Set();

        this.debounceRenderGeolocationData = debounce(this.renderGeolocationData.bind(this), 500);
        this.debounceSelectedMarkers = debounce(this.onSelectedMarkers.bind(this), 500);

        useLayoutEffect(
            () => {
                if (this.isMapLoaded() && !this._isSidebarAction) {
                    this.debounceRenderGeolocationData();
                }
            },
            () => [this.state.isMapReady]
        );

        useSubEnv({
            mapState: this.state,
            apiLoader: this.apiLoader,
            cache: this.cache,
            googleMap: () => this.googleMap,
            model: this.props.list.model,
            openRecord: this.props.openRecord,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        onWillStart(async () => {
            await this._onWillStart();
        });

        onWillUpdateProps((nextProps) => {
            this.onWillUpdatePropsRenderMarkers(nextProps);
        });

        onPatched(() => {
            if (this._isSidebarAction) {
                this._isSidebarAction = false;
            }
        });

        if (this.props.allowSelectors) {
            useBus(this.uiService.bus, 'google-map-center-map', () =>
                this.centerMap().catch((e) => console.error('GoogleMapRenderer: centerMap failed:', e))
            );
        }
    }

    async _onWillStart() {
        return loadMarkerClustererAssets();
    }

    /**
     * Handles marker rendering logic before props are updated.
     * Invalidates the marker position index and manages marker lifecycle based on grouping state changes.
     * When switching to grouped view, clears all markers. Otherwise, triggers a debounced render.
     *
     * @param {Object} nextProps - The incoming props object containing the updated state
     * @param {Object} nextProps.list - The list data object
     * @param {boolean} nextProps.list.isGrouped - Whether the next state is grouped
     */
    onWillUpdatePropsRenderMarkers(nextProps) {
        if (!this.isMapLoaded()) {
            return;
        }

        this._invalidateMarkerPositionIndex();

        const nextIsGrouped = !!nextProps.list.isGrouped;
        const currentIsGrouped = !!this.props.list.isGrouped;
        const isGroupingChanged = nextIsGrouped !== currentIsGrouped;

        // Clear all markers when switching to grouped view
        if (isGroupingChanged && nextIsGrouped) {
            this.debounceRenderGeolocationData.cancel();
            this.clearMarkers();
            return;
        }

        if (currentIsGrouped && nextIsGrouped) {
            // re-evaluate selected markers
            this.debounceSelectedMarkers.cancel();

            for (const marker of this.cache.values()) {
                this._updateMarkerSelectionState(marker._odooRecord);
            }
        }

        // Re-render when not in grouped view (staying ungrouped or switching from grouped)
        if (!nextIsGrouped) {
            this.debounceRenderGeolocationData();
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
    async renderGeolocationData() {
        if (!this.isMapLoaded()) return;

        await this.clearMarkers();

        await this.renderMarkers();

        this.renderNearbySearchCoverageArea();
    }

    /**
     * Renders a filled rectangle on the map to visually represent the nearby search
     * bounding box. Reads `is_nearby_search` and `nearby_bounding_box` from the list's
     * eval context (set by {@link GoogleMapController#showNearbyRecords}).
     * The rectangle is stored in `_nearbySearchCoverageRectangle` and removed by
     * {@link clearNearbySearchCoverageArea}. Does nothing if the context does not
     * indicate a nearby search.
     */
    renderNearbySearchCoverageArea() {
        this.clearNearbySearchCoverageArea();

        const context = this.props.list.evalContext;

        if (!context?.is_nearby_search || !context.nearby_bounding_box) return;

        const bbox = context.nearby_bounding_box;
        const { north, south, east, west } = bbox;
        if (![north, south, east, west].every(Number.isFinite)) {
            console.warn('Invalid nearby search bounding box:', bbox);
            return;
        }

        const { FILL_OPACITY, STROKE_WEIGHT, DOT_REPEAT, DOT_SCALE, STROKE_COLOR, STROKE_OPACITY } =
            MARKER_CONFIG.NEARBY_SEARCH;
        this._nearbySearchCoverageRectangle = new google.maps.Rectangle({
            strokeColor: STROKE_COLOR,
            strokeOpacity: STROKE_OPACITY,
            strokeWeight: STROKE_WEIGHT,
            fillColor: STROKE_COLOR,
            fillOpacity: FILL_OPACITY,
            map: this.googleMap,
            bounds: bbox,
        });

        const polylineOptions = {
            strokeOpacity: 0,
            icons: [
                {
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillOpacity: FILL_OPACITY,
                        fillColor: STROKE_COLOR,
                        strokeOpacity: STROKE_OPACITY,
                        strokeColor: STROKE_COLOR,
                        scale: DOT_SCALE,
                    },
                    offset: '0',
                    repeat: DOT_REPEAT,
                },
            ],
            map: this.googleMap,
        };
        const midLat = (north + south) / 2;
        let midLng = (east + west) / 2;
        if (east < west) {
            // handle antimeridian crossing
            midLng = midLng > 0 ? midLng - 180 : midLng + 180;
        }

        // Two midlines forming a crosshair at the center — marks the origin point used for the nearby search radius
        const polylinePaths = [
            [
                { lat: midLat, lng: west },
                { lat: midLat, lng: east },
            ], // W → E
            [
                { lat: north, lng: midLng },
                { lat: south, lng: midLng },
            ], // N → S
        ];
        this._nearbySearchCoveragePolylines = polylinePaths.map(
            (path) => new google.maps.Polyline({ ...polylineOptions, path })
        );

        // Fit map to rectangle bounds
        const bounds = this._nearbySearchCoverageRectangle.getBounds();
        if (bounds) {
            this._fitMapBoundsWithLimit(bounds);
        }
    }

    onSelectedMarkers(selectedMarkers) {
        if (selectedMarkers.length === 0) {
            this.notificationService.add(
                _t(
                    'No markers are currently selected. Please ensure the map is not tilted, try to zoom in closer, and try again'
                ),
                { type: 'info' }
            );
            return;
        }
        const records = selectedMarkers.map((marker) => marker._odooRecord).filter((record) => !!record);
        this._processSelectionInBatches(records, true);
    }

    /**
     * Render all markers on the map
     * @private
     */
    async renderMarkers() {
        try {
            this.uiService.block();
            const datas = this.getGroupsOrRecords();

            // Render markers differently based on grouping
            if (this.props.list.isGrouped) {
                await this._renderGroupedMarkers(datas);
            } else {
                await this._renderUngroupedMarkers(datas);
            }
            // Fit map to bounds once all markers are rendered
            // This now happens after the async batch processing completes
            this._fitBoundsWhenReady();
        } finally {
            this.uiService.unblock();
        }
    }

    /**
     * Get current groups or records data
     * @returns {Array} Array of group or record data
     */
    getGroupsOrRecords() {
        if (!this.isMapLoaded()) return [];

        const list = this.props.list;

        const currentProps = {
            isGrouped: list.isGrouped,
            recordsIds: list.isGrouped ? list.groups.map((group) => group.id) : list.records.map((record) => record.id),
            length: list.isGrouped ? list.groups.length : list.records.length,
        };

        const prev = this.lastGroupsOrRecordsProps;
        const isCacheValid =
            this.cachedGroupsOrRecords &&
            prev &&
            prev.isGrouped === currentProps.isGrouped &&
            prev.length === currentProps.length &&
            currentProps.recordsIds.every((id, i) => id === prev.recordsIds[i]);
        if (isCacheValid) {
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
     * Toggles the expansion/collapse state of a group in the sidebar.
     * Sets a flag to indicate this is a sidebar-initiated action.
     *
     * @param {Object} group - The group object to toggle
     * @returns {Promise<void>}
     */
    async toggleGroup(group) {
        this._isSidebarAction = true;
        await group.toggle();
    }

    /**
     * Create or update a marker for a record
     * @param {Object} record The record to create a marker for
     * @param {string} [markerColor] Optional color override for the marker
     * @returns {Promise<Object>} The marker object
     */
    async createMarker(record, markerColor) {
        const dataView = this.getRecordDataView(record);
        if (!dataView?.geolocation) return null;

        const { geolocation, other } = dataView;
        if (!this.isMapLoaded() || !geolocation) return null;

        try {
            // Update existing marker if it exists (before computing element values)
            if (this.cache.has(record.resId)) {
                return this._updateExistingMarker(record, geolocation);
            }

            // Create marker visual elements
            const elementValues = this._createMarkerElementValues(other, markerColor);

            // Create new marker
            const marker = await this._createNewMarker(record, geolocation, other, elementValues);
            this.mapBoxSelector?.addMarker(marker);
            return marker;
        } catch (error) {
            this._handleMarkerError(error);
            return null;
        }
    }

    /**
     * Typically invoked from {@link renderNearbySearchCoverageArea} during re-renders to
     * prevent stale coverage shapes from accumulating. Safe to call when no rectangle is
     * currently rendered.
     */
    clearNearbySearchCoverageArea() {
        if (this._nearbySearchCoverageRectangle) {
            this._nearbySearchCoverageRectangle.setMap(null);
            this._nearbySearchCoverageRectangle = null;
        }
        if (this._nearbySearchCoveragePolylines.length > 0) {
            for (const polyline of this._nearbySearchCoveragePolylines) {
                polyline.setMap(null);
            }
            this._nearbySearchCoveragePolylines = [];
        }
    }

    /**
     * Clear all markers from the map
     * @returns {Promise} Promise that resolves when markers are cleared
     */
    async clearMarkers() {
        this._terminateAnyZoomOperations();
        this.markerInfoWindow?.close();

        // Remove all element event listeners
        for (const element of this._elementEventListeners.keys()) {
            this._removeElementEventListeners(element);
        }

        // Clean up marker clusterer
        if (this.markerClusterer) {
            this.markerClusterer.clearMarkers();
        }

        if (this.mapBoxSelector) {
            this.mapBoxSelector.clearSelection(true);
        }

        // Remove all markers from the map and clear event listeners
        for (const [id, marker] of this.cache) {
            this._cleanUpMarker(id, marker);
        }

        this.cacheRecordDataView.clear();
        this._markerEventListeners.clear();
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
            this._fitMapBoundsWithLimit(this.googleMapBounds);
        } catch (error) {
            console.error('Error centering map:', error);
            this.notificationService.add(_t('Failed to center map. Please try again.'), {
                type: 'warning',
            });
        }
    }

    /**
     * Deletes all markers associated with the given group records.
     * Cleans up markers from the cache and map, then adjusts the map bounds.
     *
     * @param {Array<Object>} groupRecords - Array of record objects to delete from the map
     * @returns {Promise<void>}
     */
    async deleteGroupRecords(groupRecords) {
        if (!this.isMapLoaded() || !Array.isArray(groupRecords)) return;
        this.markerInfoWindow?.close();

        for (const { group } of groupRecords) {
            for (const record of group.list.records) {
                const marker = this.cache.get(record.resId);
                if (marker) {
                    this._cleanUpMarker(record.resId, marker);
                    this.cache.delete(record.resId);
                }
            }
        }
        this._fitBoundsWhenReady();
    }

    /**
     * Focus the map on a specific record by navigating to its marker.
     * If the marker is within a cluster, automatically breaks apart the cluster
     * through progressive zooming to reveal the individual marker.
     *
     * @param {string|number} recordId - resId of the record to focus on
     */
    pointInMap(recordId) {
        const marker = this.cache.get(recordId);
        if (!marker) return;
        this._openMarkerClusterForMarker(marker);
    }

    /**
     * Reads the configured search radius from API settings and delegates to the
     * controller's showNearbyRecords to display records near the given record.
     * Falls back to the controller's default radius when nearby_radius_search
     * is not set.
     *
     * @param {Object} record - The reference record with geolocation data
     */
    searchNearbyRecords(record) {
        const settings = this.apiLoader.getSettings();
        this.props.showNearbyRecords(record, settings.nearby_radius_search);
    }

    /**
     * Terminates all ongoing zoom operations including animations and event listeners.
     * This is called when starting a new zoom operation or when user manually interacts with the map.
     *
     * @private
     */
    _terminateAnyZoomOperations() {
        if (this._zoomAnimationFrame) {
            cancelAnimationFrame(this._zoomAnimationFrame);
            this._zoomAnimationFrame = null;
        }
        if (this._currentZoomOperation) {
            google.maps.event.removeListener(this._currentZoomOperation);
            this._currentZoomOperation = null;
        }
        // Clean up user interaction listeners
        if (this._userInteractionListeners) {
            this._userInteractionListeners.forEach((listener) => {
                google.maps.event.removeListener(listener);
            });
            this._userInteractionListeners = null;
        }
    }

    /**
     * Sets up listeners to detect user interaction with the map.
     * If user interacts (drag, zoom, click), the provided callback is triggered.
     * Uses addListenerOnce for each event, so listeners auto-remove after first trigger.
     *
     * @private
     * @param {Function} callback - Function to call when user interacts
     * @returns {Array} Array of listener references for cleanup
     */
    _setupUserInteractionListeners(callback) {
        const listeners = [];
        const events = ['drag', 'click', 'dblclick', 'rightclick'];

        events.forEach((eventName) => {
            const listener = google.maps.event.addListenerOnce(this.googleMap, eventName, callback);
            listeners.push(listener);
        });

        return listeners;
    }

    /**
     * Opens a marker cluster by progressively zooming in until the cluster breaks apart.
     * If the marker is not clustered, immediately focuses on the marker.
     * Cancels any ongoing zoom operations before starting a new one.
     *
     * This method uses a recursive approach:
     * - Checks if the marker is in a cluster with multiple markers
     * - Zooms in by 3 levels with smooth animation
     * - Waits for the map to settle (idle event)
     * - Repeats until cluster breaks apart or max attempts reached
     * - Terminates if user interacts with the map (drag, zoom, click)
     *
     * @private
     * @param {google.maps.Marker} marker - The Google Maps marker to reveal
     * @param {number} [maxAttempts=8] - Maximum number of zoom attempts to break the cluster
     */
    _openMarkerClusterForMarker(marker, maxAttempts = 8) {
        this._terminateAnyZoomOperations();

        let attempts = 0;
        let isTerminated = false;

        if (!this.markerClusterer) {
            this._handleZoomAtMarker(marker);
            return;
        }

        const position = marker.position;

        // Handler for user interaction - terminates the zoom operation
        const handleUserInteraction = () => {
            isTerminated = true;
            this._terminateAnyZoomOperations();
        };

        // Set up user interaction listeners ONCE (not in the loop)
        this._userInteractionListeners = this._setupUserInteractionListeners(handleUserInteraction);

        const checkAndZoom = () => {
            // Check if operation was terminated by user interaction
            if (isTerminated) {
                return;
            }

            const cluster = this.markerClusterer.clusters.find((c) => c.markers.includes(marker));
            if (!cluster || cluster.markers.length === 1 || attempts >= maxAttempts) {
                // Clean up listeners when operation completes
                this._terminateAnyZoomOperations();
                this._handleZoomAtMarker(marker);
                return;
            }

            const currentZoom = this.googleMap.getZoom();
            this.googleMap.setCenter(position);
            const counter = attempts === 0 ? 4 : 2;
            this._handleSmoothZoomToMarker(currentZoom + counter, currentZoom, 200);
            attempts += 1;

            this._currentZoomOperation = google.maps.event.addListenerOnce(this.googleMap, 'idle', checkAndZoom);
        };

        const cluster = this.markerClusterer.clusters.find((c) => c.markers.includes(marker));
        if (cluster && cluster.markers.length > 1) {
            checkAndZoom();
        } else {
            this._terminateAnyZoomOperations();
            this._handleZoomAtMarker(marker);
        }
    }

    /**
     * Final positioning and interaction handler for a marker.
     * Smoothly pans to the marker, triggers its click event to show info window,
     * and ensures a minimum zoom level for visibility.
     *
     * @private
     * @param {google.maps.Marker} marker - The Google Maps marker to focus on
     */
    _handleZoomAtMarker(marker) {
        const position = marker.position;
        this.googleMap.panTo(position);
        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
            this._handleAfterZoomAtMarker(marker);
        });
    }

    _handleAfterZoomAtMarker(marker) {
        // Use Google Maps event trigger so subclasses that register a different
        // gmp-click handler (e.g. CRM's toggleMarkerHighlight) are dispatched correctly
        google.maps.event.trigger(marker, 'gmp-click');
        const { ZOOM, TILT } = MARKER_CONFIG.VISUAL;
        this.googleMap.setTilt(TILT);
        if (this.googleMap.getZoom() < ZOOM.DEFAULT) {
            this.googleMap.setZoom(ZOOM.DEFAULT);
        }
    }

    /**
     * Performs a smooth zoom animation using requestAnimationFrame with ease-in-out easing.
     * Cancels any existing zoom animation before starting a new one.
     * Falls back to instant zoom if an error occurs during animation.
     *
     * The animation uses a quadratic ease-in-out easing function for smooth acceleration
     * and deceleration, providing a professional user experience.
     *
     * @private
     * @param {number} targetZoom - The desired zoom level to animate to
     * @param {number} currentZoom - The current zoom level to animate from
     * @param {number} [duration=1000] - Animation duration in milliseconds
     */
    _handleSmoothZoomToMarker(targetZoom, currentZoom, duration = 1000) {
        if (this._zoomAnimationFrame) {
            cancelAnimationFrame(this._zoomAnimationFrame);
        }
        try {
            const startZoom = currentZoom;
            const zoomDiff = targetZoom - startZoom;
            const startTime = performance.now();

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function (ease-in-out)
                const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                const newZoom = startZoom + zoomDiff * eased;
                this.googleMap.setZoom(newZoom);

                if (progress < 1) {
                    this._zoomAnimationFrame = requestAnimationFrame(animate);
                } else {
                    this._zoomAnimationFrame = null;
                }
            };

            this._zoomAnimationFrame = requestAnimationFrame(animate);
        } catch (error) {
            console.error('Error during smooth zoom:', error);
            this.googleMap.setZoom(targetZoom);
        }
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

        // Process records in batches for better UI responsiveness
        return this._processSelectionInBatches(recordsToUpdate, shouldSelect);
    }

    /**
     * Toggle selection of a record
     * @param {Object} record Record to toggle selection
     * @param {boolean} [pointInMap=false] Whether to center the map on the record
     */
    toggleRecordSelection(record, pointInMap = false) {
        this.markerInfoWindow.close();
        if (!record || !this.canSelectRecord) return;

        record.toggleSelection().then(() => {
            this._updateMarkerSelectionState(record);
            if (pointInMap && record._marker) {
                this.googleMap.panTo(record._marker.position);
            }
        });
    }

    //--------------------------------------------------------------------------
    // Getters
    //--------------------------------------------------------------------------

    get isGrouped() {
        return !!this.props.list.isGrouped;
    }

    get sidebarToggleTooltip() {
        return this.state.sidebarIsFolded ? _t('Expand side panel') : _t('Collapse side panel');
    }

    /**
     * Get sidebar props for the sidebar component
     */
    get sidebarProps() {
        const { viewTitle } = this.props.archInfo;
        return {
            header: viewTitle,
            unLocatedCount: this.props.unLocatedCount,
            title: this.props.archInfo.sidebarTitleField,
            getGroupsOrRecords: this.getGroupsOrRecords.bind(this),
            toggleGroup: this.toggleGroup.bind(this),
            renderGroupedRecordsFitBounds: this._renderGroupedRecordsFitBounds.bind(this),
            openRecord: this.props.openRecord.bind(this),
            showRecordsByDomain: this.props.showRecordsByDomain.bind(this),
            showNearbyRecords: this.searchNearbyRecords.bind(this),
            showUnlocatedRecords: this.props.showUnlocatedRecords.bind(this),
            pointInMap: this.pointInMap.bind(this),
            deleteGroupRecords: this.deleteGroupRecords.bind(this),
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
     * Get CSS class for selected marker
     */
    get markerSelectedClass() {
        return MARKER_CONFIG.VISUAL.MARKER.SELECTED_CLASS;
    }

    /**
     * Get CSS class for default marker
     */
    get markerDefaultClass() {
        return MARKER_CONFIG.VISUAL.MARKER.DEFAULT_CLASS;
    }

    /**
     * Get data view for a record, with caching
     * @param {*} record
     * @returns Object Data view for the record
     */
    getRecordDataView(record) {
        if (this.cacheRecordDataView.has(record.resId)) {
            const cachedDataView = this.cacheRecordDataView.get(record.resId);
            return cachedDataView;
        }
        const dataView = getRecordDataView(record, this.props.viewAttrs || {});
        this.cacheRecordDataView.set(record.resId, dataView);
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

        const title = other.title || '';
        const subTitle = other.subTitle || '';
        return {
            title: other.title || '',
            destination: geolocation ? `${geolocation.lat},${geolocation.lng}` : '',
            subTitle: this.formatAddressForInfoWindow(title, subTitle),
        };
    }

    formatAddressForInfoWindow(title, address) {
        if (!address) return '';
        let formattedAddress = address;
        if (typeof formattedAddress === 'string') {
            // Split subtitle into lines and trim whitespace
            formattedAddress = formattedAddress
                .trim()
                .split('\n')
                .map((line) => line.trim());
            // Remove empty lines and lines that are the same as the title
            formattedAddress = formattedAddress.filter((line) => line !== '' && line !== title).join('\n');
        }
        return formattedAddress;
    }

    //--------------------------------------------------------------------------
    // Private Methods
    //--------------------------------------------------------------------------

    /**
     * Apply visual changes to a selected marker
     * @private
     * @param {Object} marker Marker object
     */
    _selectMarker(marker) {
        if (!marker || !this.isMapLoaded()) return;

        if (marker._pin) {
            marker._pin.scale = MARKER_CONFIG.VISUAL.SELECTED_SCALE;
            marker._pin.borderColor = MARKER_CONFIG.VISUAL.SELECTED_COLOR;
        } else {
            marker.content.className = this.markerSelectedClass;
        }

        try {
            this.googleMap.panTo(marker.position);
            if (this.googleMap.getZoom() < 14) {
                this.googleMap.setZoom(14);
            }
        } catch (error) {
            console.error('Error selecting marker:', error);
        }
    }

    /**
     * Apply visual changes to a deselected marker
     * @private
     * @param {Object} marker Marker object
     */
    _deselectMarker(marker) {
        if (!marker || !this.isMapLoaded()) return;

        if (marker._pin) {
            marker._pin.scale = MARKER_CONFIG.VISUAL.DEFAULT_SCALE;
            marker._pin.borderColor = marker._elementValues?.borderColor;
        } else {
            marker.content.className = this.markerDefaultClass;
        }

        try {
            this.googleMap.panTo(marker.position);
            if (this.googleMap.getZoom() < 14) {
                this.googleMap.setZoom(14);
            }
        } catch (error) {
            console.error('Error deselecting marker:', error);
        }
    }

    /**
     * Enhanced batch processing with configuration
     * @private
     * @param {Array} records Records to process
     * @param {boolean} shouldSelect Whether to select or deselect
     * @returns {Promise} Promise resolving when complete
     */
    async _processSelectionInBatches(records, shouldSelect) {
        const { SELECTION_SIZE } = MARKER_CONFIG.BATCH;
        let processedCount = 0;

        while (processedCount < records.length) {
            const batch = this._getBatchSlice(records, processedCount, SELECTION_SIZE);
            await this._processBatchRecords(batch, shouldSelect);
            processedCount += batch.length;
            // Yield to the browser between batches so UI stays responsive
            if (processedCount < records.length) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }
    }

    /**
     * Get a slice of records for batch processing
     * @private
     * @param {Array} records All records
     * @param {number} startIndex Starting index
     * @param {number} batchSize Size of the batch
     * @returns {Array} Batch slice
     */
    _getBatchSlice(records, startIndex, batchSize) {
        return records.slice(startIndex, Math.min(startIndex + batchSize, records.length));
    }

    /**
     * Process a batch of records for selection
     * @private
     * @param {Array} batch Batch of records to process
     * @param {boolean} shouldSelect Whether to select or deselect
     * @returns {Promise} Promise resolving when batch is processed
     */
    async _processBatchRecords(batch, shouldSelect) {
        const batchPromises = batch.map((record) =>
            record.toggleSelection(shouldSelect).then(() => {
                this._updateMarkerSelectionState(record);
            })
        );

        await Promise.all(batchPromises);
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
        const borderColor = darkenColor(color);

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
        } else if (this.googleMapBounds && !this.googleMapBounds.isEmpty()) {
            this._fitMapBoundsWithLimit(this.googleMapBounds);
        }
    }

    /**
     * Enhanced ungrouped markers rendering with better error handling
     * @private
     * @param {Array} datas Record data array
     * @returns {Promise} Promise that resolves when all markers are rendered
     */
    _renderUngroupedMarkers(datas) {
        if (!datas.length) {
            return Promise.resolve();
        }

        return this._processBatchedMarkerCreation(datas);
    }

    /**
     * Process marker creation in batches for better performance
     * @private
     * @param {Array} datas Record data array
     * @returns {Promise} Promise that resolves when all markers are created
     */
    _processBatchedMarkerCreation(datas) {
        const { MARKER_SIZE, IDLE_TIMEOUT } = MARKER_CONFIG.BATCH;

        return new Promise((resolve, reject) => {
            const processBatch = async (startIndex) => {
                try {
                    const endIndex = Math.min(startIndex + MARKER_SIZE, datas.length);

                    // Create markers in current batch and wait for all to complete
                    const batchPromises = [];
                    for (let i = startIndex; i < endIndex; i++) {
                        // Markers are created without fitting bounds for performance
                        // Bounds will be fitted once all markers are created
                        batchPromises.push(this.createMarker(datas[i].record, undefined));
                    }
                    await Promise.all(batchPromises);

                    if (endIndex < datas.length) {
                        this._scheduleNextBatch(() => processBatch(endIndex), IDLE_TIMEOUT);
                    } else {
                        resolve();
                    }
                } catch (error) {
                    console.error('Error in batch marker creation:', error);
                    reject(error);
                }
            };

            this._scheduleNextBatch(() => processBatch(0), 0);
        });
    }

    /**
     * Schedule next batch using optimal timing method
     * @private
     * @param {Function} callback Callback to execute
     * @param {number} timeout Fallback timeout
     */
    _scheduleNextBatch(callback, timeout) {
        if (window.requestIdleCallback) {
            const handle = window.requestIdleCallback(() => {
                this._idleCallbackHandles.delete(handle);
                callback();
            });
            this._idleCallbackHandles.add(handle);
        } else {
            setTimeout(callback, timeout);
        }
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
                // Create all markers for this group and wait for them to complete
                const markerPromises = group.records.map((record) => {
                    // Markers are created without fitting bounds for performance
                    // Bounds will be fitted once all markers are created
                    return this.createMarker(record, group.groupColor);
                });
                await Promise.all(markerPromises);
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        });

        // Wait for all groups to finish creating their markers
        await Promise.all(groupPromises);
    }

    async _renderGroupedRecordsFitBounds(datas) {
        await this._renderGroupedMarkers(datas);
        this._fitBoundsWhenReady();
    }

    /**
     * Update map bounds with a new marker position
     * Note: This method only extends bounds, it doesn't fit them.
     * The caller should handle fitting bounds after all markers are created.
     * @private
     * @param {Object} marker Marker to include in bounds
     */
    _updateMapBounds(marker) {
        if (!this.isMapLoaded() || !marker) return;
        // Update marker clustering
        this._updateMarkerClusterer(marker);

        // Only extend bounds, don't fit during batch operations
        if (marker._odooRecord?.selected) {
            this.googleMapBoundsSelected.extend(marker.position);
        } else {
            this.googleMapBounds.extend(marker.position);
        }

        // Never fit bounds here - let the caller handle it after all markers are created
        // This prevents constant re-centering during batch marker creation
    }

    /**
     * Enhanced bounds fitting with configuration
     * @private
     * @param {Object} bounds Bounds to fit
     * @param {number} [padding] Padding in pixels
     */
    _fitMapBoundsWithLimit(bounds, padding = MARKER_CONFIG.BOUNDS.DEFAULT_PADDING) {
        if (!this.isMapLoaded() || bounds.isEmpty()) return;

        // Add padding to prevent markers from being pushed to the edge
        // Padding is in pixels and creates space between markers and viewport edges
        this.googleMap.fitBounds(bounds, padding);

        // Apply zoom limit after bounds fit
        this._applyZoomLimitAfterBoundsFit();
    }

    /**
     * Apply zoom limit after bounds are fitted
     * @private
     */
    _applyZoomLimitAfterBoundsFit() {
        if (google.maps?.event) {
            google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                const currentZoom = this.googleMap?.getZoom();
                if (currentZoom && currentZoom > MARKER_CONFIG.BOUNDS.MAX_AUTO_ZOOM) {
                    this.googleMap.setZoom(MARKER_CONFIG.BOUNDS.MAX_AUTO_ZOOM);
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
                    // set padding to prevent zooming too much on close clusters
                    const padding = MARKER_CONFIG.BOUNDS.DEFAULT_PADDING;
                    map.fitBounds(cluster.bounds, padding);
                },
            });
        } catch (error) {
            console.error(error);
            this.notificationService.add(
                _t(
                    "Something went wrong. Marker Clusterer couldn't be created. See Javascript console for technical details."
                ),
                { type: 'danger' }
            );
        }
    }

    /**
     * Update an existing marker
     * @private
     * @param {Object} record Record data
     * @param {Object} geolocation Position data
     * @returns {Object} Updated marker
     */
    _updateExistingMarker(record, geolocation) {
        // Invalidate cached dataView so stale coordinates are not returned after geocoding updates
        this.cacheRecordDataView.delete(record.resId);
        const marker = this.cache.get(record.resId);

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
     * Create a new marker with proper setup and positioning
     * @private
     * @param {Object} record Record data
     * @param {Object} geolocation Position data
     * @param {Object} data Additional marker data
     * @param {Object} elementValues Values for marker styling
     * @returns {Object} New marker
     */
    async _createNewMarker(record, geolocation, data, elementValues) {
        const marker = await this._buildAdvancedMarker(record, geolocation, data, elementValues);
        this._setupMarkerMetadata(marker, record, geolocation, elementValues);
        this._attachMarkerEventListeners(marker, record);
        this._handleMarkerPositioning(marker);
        this._updateMapBounds(marker);

        return marker;
    }

    /**
     * Build the actual AdvancedMarkerElement
     * @private
     * @param {Object} record Record data
     * @param {Object} geolocation Position data
     * @param {Object} data Additional marker data
     * @param {Object} elementValues Values for marker styling
     * @returns {Object} AdvancedMarkerElement
     */
    async _buildAdvancedMarker(record, geolocation, data, elementValues) {
        const { AdvancedMarkerElement, PinElement } = await this.apiLoader.importLibrary('marker');
        const pinElOptions = {
            background: elementValues.background,
            borderColor: elementValues.borderColor,
            glyphColor: elementValues.glyphColor,
            scale: MARKER_CONFIG.VISUAL.DEFAULT_SCALE,
        };
        if (data.title) {
            pinElOptions.glyphText = data.title.charAt(0).toUpperCase();
            if (pinElOptions.glyphColor) {
                pinElOptions.glyphColor = lightenColor(pinElOptions.glyphColor, 0.9);
            }
        }
        if (record.selected) {
            pinElOptions.scale = MARKER_CONFIG.VISUAL.SELECTED_SCALE;
            pinElOptions.borderColor = MARKER_CONFIG.VISUAL.SELECTED_COLOR;
        }
        const pin = new PinElement(pinElOptions);
        const options = this._createMarkerOptions(geolocation, data);
        options.content = pin;

        const marker = new AdvancedMarkerElement(options);
        marker._pin = pin;
        return marker;
    }

    /**
     * Setup marker metadata and relationships
     * @private
     * @param {Object} marker The marker to setup
     * @param {Object} record Record data
     * @param {Object} geolocation Position data
     * @param {Object} elementValues Values for marker styling
     */
    _setupMarkerMetadata(marker, record, geolocation, elementValues) {
        marker._recordId = record.id;
        marker._odooRecord = record;
        marker._markerOptionValues = marker.options;
        marker._elementValues = elementValues;
        marker._originalPosition = {
            lat: geolocation.lat,
            lng: geolocation.lng,
        };
        marker._isShifted = false;

        // Establish bidirectional relationship
        record._marker = marker;

        // Store in cache
        this.cache.set(record.resId, marker);
    }

    /**
     * Attach event listeners to marker
     * @private
     * @param {Object} marker The marker to attach listeners to
     * @param {Object} record Record data
     */
    _attachMarkerEventListeners(marker, record) {
        const clickListener = marker.addListener('gmp-click', this._handleMarkerClick.bind(this, marker));
        this._storeMarkerEventListener(record.resId, 'gmp-click', clickListener);
    }

    /**
     * Handle marker positioning including overlap management
     * @private
     * @param {Object} marker The marker to position
     */
    _handleMarkerPositioning(marker) {
        this._handleMarkersOverlapAt(marker);
    }

    /**
     * Handle overlapping markers by shifting their positions
     * @private
     * @param {Object} marker The marker to check for overlaps
     */
    _handleMarkersOverlapAt(marker) {
        if (!this._isValidMarkerForOverlapHandling(marker)) {
            return;
        }

        const overlapIndex = this._calculateOverlapIndex(marker);

        if (overlapIndex > 0) {
            this._applyOverlapOffset(marker, overlapIndex);
            this._drawConnectionLine(marker);
        }
    }

    /**
     * Validate if marker is ready for overlap handling
     * @private
     * @param {Object} marker The marker to validate
     * @returns {boolean} True if marker is valid
     */
    _isValidMarkerForOverlapHandling(marker) {
        if (!marker || !marker._originalPosition) {
            console.warn('Marker missing original position data');
            return false;
        }
        return true;
    }

    /**
     * Calculate how many markers already exist at the same original position
     * @private
     * @param {Object} marker The marker to check
     * @returns {number} Number of overlapping markers
     */
    _calculateOverlapIndex(marker) {
        const { lat: originalLat, lng: originalLng } = marker._originalPosition;
        let overlapIndex = 0;

        for (const [, existingMarker] of this.cache) {
            if (this._areMarkersAtSameOriginalPosition(existingMarker, marker, originalLat, originalLng)) {
                overlapIndex++;
            }
        }

        return overlapIndex;
    }

    /**
     * Check if two markers are at the same original position
     * @private
     * @param {Object} existingMarker Existing marker to compare
     * @param {Object} currentMarker Current marker being positioned
     * @param {number} targetLat Target latitude
     * @param {number} targetLng Target longitude
     * @returns {boolean} True if markers are at same position
     */
    _areMarkersAtSameOriginalPosition(existingMarker, currentMarker, targetLat, targetLng) {
        if (existingMarker?._recordId === currentMarker?._recordId || !existingMarker?._originalPosition) {
            return false;
        }

        const { POSITION_TOLERANCE } = MARKER_CONFIG.OVERLAP;
        const latDiff = Math.abs(existingMarker._originalPosition.lat - targetLat);
        const lngDiff = Math.abs(existingMarker._originalPosition.lng - targetLng);

        return latDiff < POSITION_TOLERANCE && lngDiff < POSITION_TOLERANCE;
    }

    /**
     * Apply circular offset to overlapping marker
     * @private
     * @param {Object} marker The marker to offset
     * @param {number} overlapIndex Index in the overlap sequence
     */
    _applyOverlapOffset(marker, overlapIndex) {
        const { lat: originalLat, lng: originalLng } = marker._originalPosition;
        const { OFFSET_RADIUS } = MARKER_CONFIG.OVERLAP;

        // Golden angle (137.5°) — optimal spread for any number of co-located markers
        const angle = overlapIndex * (Math.PI * (3 - Math.sqrt(5)));

        // Calculate offset using polar coordinates
        const offsetLat = Math.sin(angle) * OFFSET_RADIUS;
        const offsetLng = Math.cos(angle) * OFFSET_RADIUS;

        // Apply the offset
        marker.position = {
            lat: originalLat + offsetLat,
            lng: originalLng + offsetLng,
        };

        marker._isShifted = true;
    }

    /**
     * Draw connection line from shifted marker to original position
     * @private
     * @param {Object} marker The shifted marker
     */
    _drawConnectionLine(marker) {
        if (!this._shouldDrawConnectionLine(marker)) {
            return;
        }

        const line = this._createConnectionLinePolyline(marker);
        this._attachConnectionLineToMarker(marker, line);
    }

    /**
     * Check if connection line should be drawn
     * @private
     * @param {Object} marker The marker to check
     * @returns {boolean} True if line should be drawn
     */
    _shouldDrawConnectionLine(marker) {
        return marker.map && marker._isShifted && marker._originalPosition;
    }

    /**
     * Create the polyline for connection line
     * @private
     * @param {Object} marker The marker to create line for
     * @returns {Object} Google Maps Polyline
     */
    _createConnectionLinePolyline(marker) {
        const { CONNECTION_LINE } = MARKER_CONFIG.VISUAL;

        return new google.maps.Polyline({
            path: [marker._originalPosition, { lat: marker.position.lat, lng: marker.position.lng }],
            strokeColor: CONNECTION_LINE.STROKE_COLOR,
            strokeOpacity: CONNECTION_LINE.STROKE_OPACITY,
            strokeWeight: CONNECTION_LINE.STROKE_WEIGHT,
            icons: [
                {
                    icon: CONNECTION_LINE.SYMBOL,
                    offset: CONNECTION_LINE.ICON_OFFSET,
                    repeat: CONNECTION_LINE.ICON_REPEAT,
                },
            ],
            map: this.googleMap,
        });
    }

    /**
     * Attach connection line to marker for cleanup
     * @private
     * @param {Object} marker The marker to attach line to
     * @param {Object} line The polyline to attach
     */
    _attachConnectionLineToMarker(marker, line) {
        marker._connectionLine = line;
    }

    /**
     * Handle marker creation errors
     * @private
     * @param {Error} error The error that occurred
     */
    _handleMarkerError(error) {
        console.error('Marker creation error:', error);

        this.notificationService.add(
            _t("Something went wrong. Marker couldn't be created. See Javascript console for technical details."),
            { type: 'danger' }
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
     * Store element event listener for later cleanup
     * @param {*} element
     * @param {*} eventType
     * @param {*} listener
     */
    _storeElementEventListener(element, eventType, listener) {
        if (!this._elementEventListeners.has(element)) {
            this._elementEventListeners.set(element, new Map());
        }

        this._elementEventListeners.get(element).set(eventType, listener);
    }

    /**
     * Remove all event listeners for an element
     * @param {*} element
     */
    _removeElementEventListeners(element) {
        const listeners = this._elementEventListeners.get(element);
        if (listeners) {
            listeners.forEach((listener, eventType) => {
                element.removeEventListener(eventType, listener);
            });

            this._elementEventListeners.delete(element);
        }
    }

    /**
     * Remove all event listeners from elements within a container
     * @private
     * @param {HTMLElement} content - Container element to clean up
     */
    _removeContentEventListeners(content) {
        if (!content) return;
        for (const element of this._elementEventListeners.keys()) {
            if (content.contains(element)) {
                this._removeElementEventListeners(element);
            }
        }
    }

    /**
     * Invalidate the marker position index
     * @private
     */
    _invalidateMarkerPositionIndex() {
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
            const currentContent = this.markerInfoWindow.getContent();
            if (currentContent instanceof HTMLElement) {
                // Remove all event listeners from previous content
                this._removeContentEventListeners(currentContent);
            }

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
            const divContent = new DOMParser().parseFromString(content, 'text/html').querySelector('div');

            if (!divContent) return null;

            const openButton = divContent.querySelector('[data-role="btn-open_form"]');
            if (openButton) {
                const eventHandler = this.props.showRecord.bind(this, record);
                openButton.addEventListener('click', eventHandler);
                this._storeElementEventListener(openButton, 'click', eventHandler);
            }

            const nearbyButton = divContent.querySelector('[data-role="btn-show_nearby"]');
            if (nearbyButton) {
                const eventHandler = this.searchNearbyRecords.bind(this, record);
                nearbyButton.addEventListener('click', eventHandler);
                this._storeElementEventListener(nearbyButton, 'click', eventHandler);
            }

            const streetViewButton = divContent.querySelector('[data-role="btn-open_street_view"]');
            if (streetViewButton) {
                const eventHandler = this.props.showGoogleStreetViewSideBySide.bind(this, record);
                streetViewButton.addEventListener('click', eventHandler);
                this._storeElementEventListener(streetViewButton, 'click', eventHandler);
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
        values.recordId = record.resId;
        return renderToString(this.constructor.templateInfoWindow, { ...values, isShifted });
    }

    /**
     * Update marker appearance based on selection state
     * @private
     * @param {Object} record Record object
     */
    _updateMarkerSelectionState(record) {
        if (record.selected) {
            this._selectMarker(this.cache.get(record.resId));
        } else {
            this._deselectMarker(this.cache.get(record.resId));
        }
    }

    _cleanUp() {
        super._cleanUp();
        this._terminateAnyZoomOperations();

        // Cancel any pending idle callbacks to prevent post-destroy access
        if (window.cancelIdleCallback) {
            for (const handle of this._idleCallbackHandles) {
                window.cancelIdleCallback(handle);
            }
        }
        this._idleCallbackHandles.clear();

        // Remove all element event listeners
        for (const [element] of this._elementEventListeners) {
            this._removeElementEventListeners(element);
        }

        // Remove nearby search marker if exists
        this.clearNearbySearchCoverageArea();

        // Remove all markers from the map and clear event listeners
        for (const [id, marker] of this.cache) {
            this._cleanUpMarker(id, marker);
        }

        // Clean up marker clusterer
        if (this.markerClusterer) {
            this.markerClusterer.clearMarkers();
            this.markerClusterer.setMap(null);
            this.markerClusterer = null;
        }

        this.cacheRecordDataView.clear();
        this.cache.clear();

        this._invalidateMarkerPositionIndex();
        this._markerEventListeners.clear();

        if (this.mapBoxSelector) {
            this.mapBoxSelector.destroy();
            this.mapBoxSelector = null;
        }
    }

    _cleanUpMarker(id, marker) {
        if (marker) {
            if (this.markerClusterer) {
                this.markerClusterer.removeMarker(marker);
            }
            // Remove connection line if exists
            if (marker._connectionLine) {
                marker._connectionLine.setMap(null);
                delete marker._connectionLine;
            }
            marker.map = null;
            this._removeMarkerEventListeners(id);
        }
    }
}
