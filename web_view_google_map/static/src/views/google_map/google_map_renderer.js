/** @odoo-module **/

import { useRef, useEffect, useState } from '@odoo/owl';
import { Pager } from '@web/core/pager/pager';
import { renderToString } from '@web/core/utils/render';
import { Widget } from '@web/views/widgets/widget';

import { BaseGoogleMap } from '@base_google_map/utils/base_google_map';

import { GoogleMapSidebar } from './google_map_sidebar';
import { MARKER_ICON_SVG_PATH, MARKER_ICON_HEIGHT, MARKER_ICON_WIDTH } from './utils';

export class GoogleMapRenderer extends BaseGoogleMap {
    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.searchPlacesRef = useRef('searchPlaces');
        this.markerCluster = null;

        this.markers = [];
        this.state = useState({ sidebarIsFolded: false });

        useEffect(() => {
            this.loader.loadCallback((e) => {
                if (e) {
                    console.log(e);
                } else {
                    this.renderMap();
                }
            });
        });
    }

    renderMap() {
        this.clearMarkers();
        this.initialize();
        this.renderMarkers();
        this.renderMarkerClusterer();
        this.centerMap();
        this.handleSearchPlaceBounds();
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

    initialize() {
        if (!this.googleMap) {
            const options = this.getMapOptions();
            this.googleMap = new google.maps.Map(this.mapRef.el, options);
            this.setMapTheme();
        }
        this.markerInfoWindow = new google.maps.InfoWindow();
        this.renderGooglePlaceSearch(this.searchPlacesRef, this.markerInfoWindow);
    }

    clearMarkers() {
        if (this.markerCluster) {
            this.markerCluster.clearMarkers();
        }
        this.markers.splice(0);
    }

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
        } else {
            this.markerCluster.addMarkers(markers);
        }
    }

    getMarkerContent(record) {
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
        });

        const divContent = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');
        divContent.querySelector('#btn-open_form').addEventListener(
            'click',
            (ev) => {
                const data = ev.target.getAttribute('data-record');
                if (data) {
                    const record = JSON.parse(data);
                    this.props.openRecord(record);
                }
            },
            false
        );
        return divContent;
    }

    handleMarkerInfoWindow(marker, otherRecords) {
        let bodyContent = document.createElement('div');
        bodyContent.className = 'o_kanban_group';

        const markerContent = this.getMarkerContent(marker._odooRecord);

        bodyContent.appendChild(markerContent);

        if (otherRecords.length > 0) {
            otherRecords.forEach((record) => {
                let markerOtherContent = this.getMarkerContent(record);
                bodyContent.appendChild(markerOtherContent);
            });
        }

        this.markerInfoWindow.setContent(bodyContent);
        this.markerInfoWindow.open(this.googleMap, marker);
    }

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

    createMarker(latLng, record, color) {
        const options = {
            position: latLng,
            map: this.googleMap,
            optimized: true,
            _odooRecord: record,
            _odooMarkerColor: color,
            icon: {
                path: MARKER_ICON_SVG_PATH,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 0.75,
                strokeColor: '#444',
                scale: 0.067,
                anchor: new google.maps.Point(
                    MARKER_ICON_WIDTH / 2,
                    MARKER_ICON_HEIGHT
                ),
            },
        };

        const title = this.props.archInfo.sidebarTitleField
            ? record.data[this.props.archInfo.sidebarTitleField]
            : record.data.name || record.data.display_name;
        if (title) {
            options['title'] = title;
        }
        return new google.maps.Marker(options);
    }

    renderMarkers() {
        let latLng;
        let lat;
        let lng;
        let marker;
        let color;
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
                latLng = new google.maps.LatLng(lat, lng);
                marker = this.createMarker(latLng, record, color);
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
            fieldLat: this.props.archInfo.latitudeField,
            fieldLng: this.props.archInfo.longitudeField,
            fieldTitle: this.props.archInfo.sidebarTitleField,
            fieldSubtitle: this.props.archInfo.sidebarSubtitleField,
            markers: this.markers,
        };
    }
}

GoogleMapRenderer.template = 'web_view_google_map.GoogleMapRenderer';
GoogleMapRenderer.components = { Pager, Widget };
GoogleMapRenderer.props = ['archInfo', 'openRecord', 'readonly', 'list', 'onAdd?'];
