/** @odoo-module **/

import { useRef, useState, onRendered, onWillUpdateProps, onPatched } from '@odoo/owl';
import { Pager } from '@web/core/pager/pager';
import { renderToString } from '@web/core/utils/render';
import { Widget } from '@web/views/widgets/widget';

import { BaseGoogleMap, LOADER_STATUS } from '@base_google_map/utils/base_google_map';

import { GoogleMapSidebar } from './google_map_sidebar';
import { getFontAwesomeIcon  } from './utils';


export class GoogleMapRenderer extends BaseGoogleMap {
    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.searchPlacesRef = useRef('searchPlaces');
        this.markerCluster = null;
        this.markers = [];

        this.state = useState({ ...this.state, sidebarIsFolded: false });

        // The following lifecycle hooks are to maintain the data rendered on the map
        // When the same list ID is rendered, I won't re-render the markers and also won't change the current map center
        onRendered(this.handleOnRendered);
        onPatched(this.handleOnPatched);
        onWillUpdateProps(this.handleOnWillUpdateProps);
    }

    handleOnWillUpdateProps() {
        // Reset the flag 'currentDatapointId' so that on the next render, lifecycle `onRendered` will do it's job
        this.currentDatapointId = null;
    }

    handleOnRendered() {
        // I render the markers only when the GoogleLoader is success and new list ID is loaded
        if (
            this.state.loaderStatus === LOADER_STATUS.SUCCESS &&
            this.currentDatapointId != this.props.list.id
        ) {
            this.currentDatapointId = this.props.list.id;
            this.renderMap(true);
        }
    }

    handleOnPatched() {
        // I keep the current map bounds unless new list ID is loaded
        if (this.currentDatapointId != this.props.list.id) {
            this.centerMap();
        }
    }

    renderMap(isCentered) {
        isCentered = isCentered || false;
        this.clearMarkers();
        this.renderMarkers();
        this.renderMarkerClusterer();
        if (isCentered) {
            this.centerMap();
        }
    }

    getMapOptions() {
        const gestureHandling =
            ['cooperative', 'greedy', 'none', 'auto'].indexOf(
                this.props.archInfo.gestureHandling
            ) === -1
                ? 'auto'
                : this.props.archInfo.gestureHandling;

        return {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            center: { lat: 0, lng: 0 },
            zoom: 2,
            minZoom: 2,
            maxZoom: 22,
            fullscreenControl: true,
            mapTypeControl: true,
            gestureHandling,
        };
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
            this.setMapTheme();
        }
        this.markerInfoWindow = new google.maps.InfoWindow();
        this.renderGooglePlaceSearch(this.searchPlacesRef, this.markerInfoWindow);
    }

    /**
     * Reset the markers
     */
    clearMarkers() {
        if (this.markerCluster) {
            this.markerCluster.clearMarkers();
            this.markerCluster.setMap(null);
        }
        this.markers.forEach((marker) => marker.setMap(null));
        this.markers.splice(0);
    }

    /**
     * Center the map
     */
    centerMap() {
        const mapBounds = new google.maps.LatLngBounds();
        this.markers.forEach((marker) => {
            mapBounds.extend(marker.getPosition());
        });
        this.googleMap.fitBounds(mapBounds);
        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
            google.maps.event.trigger(this.googleMap, 'resize');
            if (this.googleMap.getZoom() > 17) this.googleMap.setZoom(17);
        });
    }

    /**
     * Add event 'click' listener to marker and
     * manage marker located at the same coordinate
     * @param {Object} marker
     */
    handleMarker(marker) {
        const otherRecords = [];
        if (this.markers.length > 0) {
            const position = marker.getPosition();
            this.markers.forEach((_cMarker) => {
                if (position && position.equals(_cMarker.getPosition())) {
                    marker.setMap(null);
                    otherRecords.push(_cMarker._odooRecord);
                }
            });
        }
        this.markers.push(marker);
        google.maps.event.addListener(
            marker,
            'click',
            this.handleMarkerInfoWindow.bind(this, marker, otherRecords)
        );
    }

    renderMarkerClusterer() {
        const markers = this.markers;
        if (!this.markerCluster) {
            this.markerCluster = new markerClusterer.MarkerClusterer({
                map: this.googleMap,
                markers,
            });
            this.markerCluster.addListener('click', () => {
                this.markerInfoWindow.close();
            });
        } else {
            this.markerCluster.setMap(this.googleMap);
            this.markerCluster.addMarkers(markers);
        }
    }

    /**
     *
     * @param {Object} record
     * @param {boolean} isMulti
     * @returns {HTMLElement} Marker content
     */
    getMarkerContent(record, isMulti) {
        const {
            latitudeField,
            longitudeField,
            sidebarTitleField,
            sidebarSubtitleField,
        } = this.props.archInfo;
        const content = renderToString('web_view_google_map.MarkerInfoWindow', {
            record: JSON.stringify({
                id: record.id,
                resId: record.resId,
                resModel: record.resModel,
            }),
            title: record.data[sidebarTitleField],
            destination: `${record.data[latitudeField]},${record.data[longitudeField]}`,
            subTitle: record.data[sidebarSubtitleField],
            isMulti: isMulti,
        });

        const divContent = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');
        divContent.querySelector('#btn-open_form').addEventListener(
            'click',
            (ev) => {
                const data = ev.target.getAttribute('data-record');
                if (data) {
                    const values = JSON.parse(data);
                    this.props.showRecord(values);
                }
            },
            false
        );
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
            otherRecords.forEach((record) => {
                let markerOtherContent = this.getMarkerContent(record, true);
                bodyContent.appendChild(markerOtherContent);
            });
        }

        this.markerInfoWindow.setContent(bodyContent);
        this.markerInfoWindow.open(this.googleMap, marker);
    }

    /**
     *
     * @param {Object} record
     * @returns {String} color of marker
     */
    handleMarkerColor(record) {
        // color can be a hex color
        // or integer (an index) represent color from widget `color_picker`
        const color =
            record.data[this.props.archInfo.markerColor] ||
            this.props.archInfo.markerColor;
        let markerColor = 'red';
        if (typeof color === 'number') {
            const ColorList = [
                null,
                '#F06050', // Red
                '#F4A460', // Orange
                '#F7CD1F', // Yellow
                '#6CC1ED', // Light blue
                '#814968', // Dark purple
                '#EB7E7F', // Salmon pink
                '#2C8397', // Medium blue
                '#475577', // Dark blue
                '#D6145F', // Fuchsia
                '#30C381', // Green
                '#9365B8', // Purple
            ];
            markerColor = ColorList[color] || markerColor;
        } else if (
            /(?:#|0x)(?:[a-f0-9]{3}|[a-f0-9]{6})\b|(?:rgb|hsl)a?\([^\)]*\)/gi.test(
                color
            )
        ) {
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
                strokeColor: '#444',
                scale: 0.067 * markerIconScale,
                anchor: new google.maps.Point(iconFa[0] / 2, iconFa[1]),
            },
        };

        const title = this.props.archInfo.sidebarTitleField
            ? record.data[this.props.archInfo.sidebarTitleField]
            : record.data.name || record.data.display_name;
        if (title) {
            markerOptions['title'] = title;
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

    renderMarkers() {
        let lat;
        let lng;
        let marker;
        let color;
        let markerOptions;

        this.props.list.records.map((record) => {
            color = this.handleMarkerColor(record);
            lat =
                typeof record.data[this.props.archInfo.latitudeField] === 'number'
                    ? record.data[this.props.archInfo.latitudeField]
                    : 0.0;
            lng =
                typeof record.data[this.props.archInfo.longitudeField] === 'number'
                    ? record.data[this.props.archInfo.longitudeField]
                    : 0.0;
            if (lat !== 0.0 || lng !== 0.0) {
                markerOptions = this._prepareMarkerOptions({ lat, lng }, record, color);
                marker = this.createMarker(markerOptions);
                record._marker = marker;
                record._markerColor = color;
                this.handleMarker(marker);
            }
            return record;
        });
    }

    add(params) {
        if (this.canCreate) {
            this.props.onAdd(params);
        }
    }

    toggleSidebar() {
        this.state.sidebarIsFolded = !this.state.sidebarIsFolded;
    }

    pointInMap(marker) {
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

    get isEmpty() {
        return this.props.list.records.length <= 0;
    }

    get sidebarKey() {
        return Math.random().toString(36).substring(2, 12);
    }

    get sidebarComponent() {
        return GoogleMapSidebar;
    }

    get sidebarProps() {
        return {
            handleOpenRecord: this.props.openRecord.bind(this),
            handlePointInMap: this.pointInMap.bind(this),
            string: this.props.archInfo.viewTitle,
            records: this.props.list.records,
            fieldTitle: this.props.archInfo.sidebarTitleField,
            fieldSubtitle: this.props.archInfo.sidebarSubtitleField,
        };
    }
}

GoogleMapRenderer.template = 'web_view_google_map.GoogleMapRenderer';
GoogleMapRenderer.components = { Pager, Widget };
GoogleMapRenderer.props = [
    'archInfo',
    'openRecord',
    'showRecord',
    'readonly',
    'list',
    'onAdd?',
];
