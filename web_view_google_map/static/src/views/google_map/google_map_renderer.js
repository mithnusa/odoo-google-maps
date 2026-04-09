/** @odoo-module **/

import { _t } from '@web/core/l10n/translation';
import { DynamicRecordList } from '@web/model/relational_model/dynamic_record_list';
import { useRef, useState, useChildSubEnv, onRendered, useEffect } from '@odoo/owl';
import { renderToString } from '@web/core/utils/render';
import { useBus, useService } from '@web/core/utils/hooks';

import { BaseGoogleMap, LOADER_STATUS } from '@base_google_map/utils/base_google_map';
import { GoogleMapSidebar } from './google_map_sidebar';
import { GoogleMapGeolocate } from './geolocate/geolocate';
import { getFontAwesomeIcon, getCurrentActionId } from './utils';

export class GoogleMapRenderer extends BaseGoogleMap {
    static template = 'web_view_google_map.GoogleMapRenderer';
    static components = { Geolocate: GoogleMapGeolocate, Sidebar: GoogleMapSidebar };
    static props = [
        'archInfo',
        'openRecord',
        'showRecord',
        'readonly',
        'list',
        'onAdd?',
        'activeActions?',
        'allowSelectors',
    ];

    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.searchPlacesRef = useRef('searchPlaces');
        this.markerCluster = null;
        this.isShiftKeyPressed = false;
        this.cache = new Map();

        this.state = useState({
            ...this.state,
            isMapReady: null,
            sidebarIsFolded: false,
        });

        if (this.props.allowSelectors) {
            const ui = useService('ui');
            useBus(ui.bus, 'google-map-center-map', this.centerMap);
        }

        useChildSubEnv({
            getRecordMarker: (recordId) => this.cache.get(recordId),
            hasGeolocation: (record) => this.getLatLng(record),
            getMarkerColor: (record) => this.getMarkerColor(record),
            googleMap: () => this.googleMap,
        });

        useEffect(
            (mapEl, loaderStatus) => {
                // Allow you to select a marker in the map, by pressing a Shift key + click the marker
                if (mapEl && loaderStatus === LOADER_STATUS.SUCCESS) {
                    this.addMapCustomEvListeners();
                    return () => this.removeMapCustomEvListeners();
                }
            },
            () => [this.mapRef.el, this.state.loaderStatus]
        );

        // The following lifecycle hooks are to maintain the data rendered on the map
        // When the same list ID is rendered, I won't re-render the markers and also won't change the current map center
        onRendered(this.handleOnRendered);
    }

    /**
     * Add custom event listeners to the map element
     */
    addMapCustomEvListeners() {
        // Allow you to select a marker in the map, by pressing a Shift key + click the marker
        this.mapRef.el.addEventListener('keydown', this.onMapKeydown.bind(this));
        this.mapRef.el.addEventListener('keyup', this.onMapKeyup.bind(this));
    }

    /**
     * Remove custom event listeners added to the map element
     */
    removeMapCustomEvListeners() {
        this.mapRef.el.removeEventListener('keydown', this.onMapKeydown.bind(this));
        this.mapRef.el.removeEventListener('keyup', this.onMapKeyup.bind(this));
    }

    onMapKeydown(ev) {
        if (ev.keyCode === 16 || ev.which === 16) {
            ev.preventDefault();
            this.isShiftKeyPressed = true;
        }
    }

    onMapKeyup(ev) {
        if (ev.keyCode === 16 || ev.which === 16) {
            ev.preventDefault();
            this.isShiftKeyPressed = false;
        }
    }

    handleOnRendered() {
        let isMarkerSelected = false;
        if (this.props.list && this.props.list instanceof DynamicRecordList) {
            isMarkerSelected = this.props.list.selection.length > 0;
        }
        this.isMarkerSelected = isMarkerSelected;
        if (this.state.loaderStatus === LOADER_STATUS.SUCCESS) {
            this.renderMap();
        }
    }

    /**
     * Renders the map and markers
     * Any markers selected won't trigger the map to be re-rendered
     */
    renderMap() {
        if (this.props.allowSelectors) {
            this._renderMapAllowSelector();
        } else {
            this._renderMapNoAllowSelector();
        }
    }

    _renderMapAllowSelector() {
        if (this.isMarkerSelected) {
            return;
        } else {
            this.clearMarkers();
            this.renderMarkers();
            this.renderMarkerClusterer();
            const noMapCenter = this.noMapCenter || false;
            if (!noMapCenter || typeof this.noMapCenter === 'undefined') {
                this.centerMap();
            }
        }
    }

    _renderMapNoAllowSelector() {
        this.clearMarkers();
        this.renderMarkers();
        this.renderMarkerClusterer();
        this.centerMap();
    }

    /**
     * Initialize Google Map instance & Google search places (if enabled)
     */
    initialize() {
        this._initializeGoogleMap();
        this.handleSearchPlaceBounds();
    }

    _initializeGoogleMap() {
        if (!this.googleMap) {
            const options = this.getMapOptions();
            this.googleMap = new google.maps.Map(this.mapRef.el, options);
            this.onMapReady(this.googleMap);
            this.setMapTheme();
        }
        this.markerInfoWindow = new google.maps.InfoWindow({ disableAutoPan: true });
        this.renderGooglePlaceSearch(this.searchPlacesRef, this.markerInfoWindow);
    }

    async onMapReady(map) {
        // Wait for map to be fully loaded
        await new Promise((resolve) => {
            google.maps.event.addListenerOnce(map, 'tilesloaded', resolve);
        });
        this.state.isMapReady = true;
        // Trigger resize to ensure proper rendering
        google.maps.event.trigger(map, 'resize');
    }

    /**
     * Reset the markers
     */
    clearMarkers() {
        if (this.markerCluster && !this.props.archInfo.disableMarkerCluster) {
            this.markerCluster.clearMarkers();
            this.markerCluster.setMap(null);
        }
        this.cache.forEach((marker) => marker.setMap(null));
        this.cache.clear();
    }

    /**
     * Center the map
     */
    centerMap() {
        if (!this.googleMap) return;
        const mapBounds = new google.maps.LatLngBounds();
        this.cache.forEach((marker) => mapBounds.extend(marker.getPosition()));
        this.googleMap.fitBounds(mapBounds);
        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
            google.maps.event.trigger(this.googleMap, 'resize');
            if (this.googleMap.getZoom() > 17) this.googleMap.setZoom(17);
        });
    }

    /**
     * Add event 'click' listener to marker and manage marker located at the same coordinate
     * @param {Object} marker
     */
    handleMarker(recordId, marker) {
        const otherRecords = [];
        if (this.cache.size) {
            const position = marker.getPosition();
            this.cache.forEach((_cMarker) => {
                if (position && position.equals(_cMarker.getPosition())) {
                    marker.setMap(null);
                    otherRecords.push(_cMarker._odooRecord);
                }
            });
        }
        this.cache.set(recordId, marker);
        google.maps.event.addListener(
            marker,
            'click',
            this.handleMarkerInfoWindow.bind(this, marker, otherRecords)
        );
    }

    /**
     * Load markers in cluster
     * @returns
     */
    renderMarkerClusterer() {
        if (this.props.archInfo.disableMarkerCluster) return;
        const markers = Array.from(this.cache.values());
        if (!this.markerCluster) {
            this.markerCluster = new markerClusterer.MarkerClusterer({
                map: this.googleMap,
                markers,
                onClusterClick: (_ev, cluster, map) => {
                    this.markerInfoWindow.close();
                    map.fitBounds(cluster.bounds);
                },
            });
            this.markerCluster.addListener('click', () => {
                this.markerInfoWindow.close();
            });
        } else {
            this.markerCluster.setMap(this.googleMap);
            this.markerCluster.addMarkers(markers);
        }
    }

    prepareInfoWindowValues(record, isMulti) {
        const { latitudeField, longitudeField, sidebarTitleField, sidebarSubtitleField } =
            this.props.archInfo;
        return {
            title: record.data[sidebarTitleField],
            destination: `${record.data[latitudeField]},${record.data[longitudeField]}`,
            subTitle: record.data[sidebarSubtitleField],
            isMulti,
        };
    }

    get infoWindowTemplate() {
        return 'web_view_google_map.MarkerInfoWindow';
    }

    markerInfoWindowContent(record, isMulti) {
        const values = this.prepareInfoWindowValues(record, isMulti);
        return renderToString(this.infoWindowTemplate, values);
    }

    /**
     *
     * @param {Object} record
     * @param {boolean} isMulti
     * @returns {HTMLElement} Marker content
     */
    getMarkerContent(record, isMulti) {
        const content = this.markerInfoWindowContent(record, isMulti);
        const divContent = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');
        divContent
            .querySelector('#btn-open_form')
            .addEventListener('click', this.props.showRecord.bind(this, record), false);
        return divContent;
    }

    /**
     *
     * @param {Object} marker
     * @param {Array} otherRecords
     */
    handleMarkerInfoWindow(marker, otherRecords) {
        let bodyContent = document.createElement('div');
        bodyContent.className = 'o_kanban_group';

        const markerContent = this.getMarkerContent(marker._odooRecord, false);

        bodyContent.appendChild(markerContent);

        if (otherRecords.length > 0) {
            // limit to 2 records
            otherRecords.slice(0, 2).forEach((record) => {
                let markerOtherContent = this.getMarkerContent(record, true);
                bodyContent.appendChild(markerOtherContent);
            });
        }

        if (otherRecords.length > 2) {
            let moreRecords = document.createElement('div');
            moreRecords.classList.add('pt-3', 'pb-3', 'text-center');
            moreRecords.innerHTML =
                '<button type="button" class="btn btn-link">' + _t('Show more') + '</button>';
            moreRecords.querySelector('button').addEventListener(
                'click',
                () => {
                    this.actionSeeMore(marker);
                },
                false
            );
            bodyContent.appendChild(moreRecords);
        }

        this.markerInfoWindow.setContent(bodyContent);
        this.markerInfoWindow.open(this.googleMap, marker);

        if (this.isShiftKeyPressed && marker._odooRecord) {
            this.toggleRecordSelection(marker._odooRecord);
        }
    }

    /**
     *
     * @param {Object} record
     * @returns {String} color of marker
     */
    getMarkerColor(record) {
        // color can be a hex color
        // or integer (an index) represent color from widget `color_picker`
        const color =
            record.data[this.props.archInfo.markerColor] || this.props.archInfo.markerColor;

        let markerColor = 'red';
        if (typeof color === 'number') {
            const ColorList = [
                null,
                '#ee2d2d', // Red
                '#dc8534', // Orange
                '#e8bc1d', // Yellow
                '#5793dd', // Light blue
                '#9f628f', // Dark purple
                '#db8865', // Salmon pink
                '#41a9a2', // Medium blue
                '#304ae0', // Dark blue
                '#ee2f8b', // Fuchsia
                '#61c36e', // Green
                '#9972e6', // Purple
            ];
            markerColor = ColorList[color] || markerColor;
        } else if (/(?:#|0x)(?:[a-f0-9]{3}|[a-f0-9]{6})\b|(?:rgb|hsl)a?\([^\)]*\)/gi.test(color)) {
            markerColor = color;
        }
        return markerColor;
    }

    /**
     *
     * @param {Object} latLng
     * @param {Object} record
     * @param {String} color
     * @returns {Object} marker options
     */
    _prepareMarkerOptions(latLng, record, color) {
        const markerIcon = this.props.archInfo.markerIcon || '';
        const markerIconScale = this.props.archInfo.markerIconScale || 1.0;
        const iconFa = getFontAwesomeIcon(markerIcon);
        const markerOptions = {
            position: latLng,
            map: this.googleMap,
            _odooRecord: record,
            _odooMarkerColor: color,
            icon: {
                path: iconFa[4],
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 0.75,
                strokeColor: '#f5f5f5',
                scale: 0.067 * markerIconScale,
                anchor: new google.maps.Point(iconFa[0] / 2, iconFa[1]),
            },
        };

        if (markerIcon && markerIcon.includes('circle')) {
            markerOptions.icon.strokeWeight = 2;
        }

        const title = this.props.archInfo.sidebarTitleField
            ? record.data[this.props.archInfo.sidebarTitleField]
            : record.data.name || record.data.display_name;
        if (title) {
            markerOptions.title = title;
        }
        return markerOptions;
    }

    /**
     *
     * @param {*} options
     * @returns Google marker instance
     */
    createMarker(options) {
        return new google.maps.Marker(options);
    }

    /**
     * Get latitude and longitude value from the record
     * @param {Object} record
     * @returns
     */
    getLatLng(record) {
        const { latitudeField, longitudeField } = this.props.archInfo;
        const lat =
            typeof record.data[latitudeField] === 'number' ? record.data[latitudeField] : 0.0;
        const lng =
            typeof record.data[longitudeField] === 'number' ? record.data[longitudeField] : 0.0;
        if (lat !== 0.0 || lng !== 0.0) {
            return { lat, lng };
        } else {
            return false;
        }
    }

    /**
     * Create marker if not existed yet
     * @param {Object} record
     */
    createMarkerIfNotExists(record) {
        let hasGeolocation = false;
        let markerColor = null;
        if (!this.cache.has(record.id)) {
            const latLng = this.getLatLng(record);
            if (latLng) {
                hasGeolocation = true;
                markerColor = this.getMarkerColor(record);
                const markerOptions = this._prepareMarkerOptions(latLng, record, markerColor);
                const marker = this.createMarker(markerOptions);
                record._marker = marker;
                record._toggleMarkerSelection = (rec) => this.toggleSelectRecord(rec);
                this.handleMarker(record.id, marker);
            }
        }
        record._markerColor = markerColor;
        record._hasGeolocation = hasGeolocation;
    }

    /**
     * Create marker(s) from record(s)
     */
    renderMarkers() {
        this.props.list.records.map((record) => {
            this.createMarkerIfNotExists(record);
            return record;
        });
    }

    add(params) {
        if (this.canCreate) {
            this.props.onAdd(params);
        }
    }

    toggleSidebar() {
        this.noMapCenter = true;
        this.state.sidebarIsFolded = !this.state.sidebarIsFolded;
    }

    pointInMap(recordId) {
        const marker = this.cache.get(recordId);
        if (marker) {
            const position = marker.getPosition();
            this.markerInfoWindow.close();
            this.googleMap.panTo(position);
            google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                google.maps.event.trigger(marker, 'click');
                if (this.googleMap.getZoom() < 14) this.googleMap.setZoom(14);
                this.markerInfoWindow.setPosition(position);
            });
        }
    }

    get isGrouped() {
        return this.props.list.isGrouped;
    }

    get isEmpty() {
        return this.props.list.records.length <= 0;
    }

    get sidebarProps() {
        return {
            handleOpenRecord: this.props.openRecord.bind(this),
            handlePointInMap: this.pointInMap.bind(this),
            string: this.props.archInfo.viewTitle,
            records: this.props.list.records,
            fieldTitle: this.props.archInfo.sidebarTitleField,
            fieldSubtitle: this.props.archInfo.sidebarSubtitleField,
            handleToggleRecordSelection: this.toggleRecordSelection.bind(this),
            handleToggleSelection: this.toggleSelectionAll.bind(this),
            handleCanSelectRecord: this.canSelectRecord,
            handleSelectAll: this.props.allowSelectors ? this.selectAll : false,
            allowSelectors: this.props.allowSelectors,
        };
    }

    toggleSelectionAll() {
        const list = this.props.list;
        if (!this.canSelectRecord) {
            return;
        }
        if (list.selection.length === list.records.length) {
            list.records.forEach((record) => {
                record.toggleSelection(false).then(() => {
                    this.toggleSelectRecord(record);
                });
                list.selectDomain(false);
            });
        } else {
            list.records.forEach((record) => {
                record.toggleSelection(true).then(() => {
                    this.toggleSelectRecord(record);
                });
            });
        }
    }

    get canSelectRecord() {
        return !this.props.list.editedRecord && !this.props.list.model.useSampleModel;
    }

    get selectAll() {
        const list = this.props.list;
        const nbDisplayedRecords = list.records.length;
        if (list.isDomainSelected) {
            return true;
        } else {
            return nbDisplayedRecords > 0 && list.selection.length === nbDisplayedRecords;
        }
    }

    toggleSelectRecord(record) {
        if (record.selected) {
            this._selectMarker(record._marker);
        } else {
            this._deselectMarker(record._marker);
        }
    }

    _selectMarker(marker) {
        if (!marker) return;

        const _originIcon = marker.get('_originIcon');
        const iconOriginal = marker.getIcon();

        const icon = _originIcon ? _originIcon : Object.assign({}, iconOriginal);

        const selectedIcon = Object.assign({}, iconOriginal);
        selectedIcon.strokeColor = '#e31705'; // '#714b67';
        selectedIcon.strokeWeight = 2.5;

        marker.setOptions({ _originIcon: icon, icon: selectedIcon });
    }

    _deselectMarker(marker) {
        if (!marker) return;
        const _originIcon = marker.get('_originIcon');
        const icon = _originIcon ? _originIcon : marker.getIcon();
        marker.setIcon(icon);
    }

    toggleRecordSelection(record, pointInMap = false) {
        this.markerInfoWindow.close();
        record.toggleSelection().then(() => {
            this.toggleSelectRecord(record);
        });
        this.props.list.selectDomain(false);
        if (pointInMap && record._marker) {
            this.googleMap.panTo(record._marker.getPosition());
        }
    }

    _handleActionSeeMore(actionId, domain, context) {
        if (!actionId) return;
        this.props.list.model.orm
            .call('google.map.view.mixins', 'handle_find_action', [actionId])
            .then((actionKey) => {
                if (actionKey) {
                    this.props.list.model.orm
                        .call('google.map.view.mixins', 'handle_see_more', [
                            actionKey,
                            domain,
                            context,
                        ])
                        .then((action) => {
                            if (action) {
                                this.props.list.model.action.doAction(action);
                            }
                        });
                }
            });
    }

    async generateLatLngDomain(lat, lng) {
        const { latitudeField, longitudeField } = this.props.archInfo;
        const data = await this.props.list.model.orm.call(
            'google.map.view.mixins',
            'handle_get_geolocation_fields',
            [this.props.list.resModel, latitudeField, longitudeField]
        );
        let domain = [];
        if (data) {
            Object.keys(data).forEach((key) => {
                if (key === latitudeField) {
                    domain.push([data[key], '=', lat]);
                } else if (key === longitudeField) {
                    domain.push([data[key], '=', lng]);
                }
            });
        }
        return domain;
    }

    async actionSeeMore(marker) {
        let actionId = getCurrentActionId();
        if (actionId) {
            let position = marker.getPosition();
            let domain = await this.generateLatLngDomain(position.lat(), position.lng());
            if (!domain.length) {
                this.notification.add(
                    _t('Failed to construct domain. Please contact your administrator'),
                    { type: 'danger' }
                );
            } else {
                this._handleActionSeeMore(actionId, domain);
            }
        }
    }
}
