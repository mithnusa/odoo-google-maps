/** @odoo-module **/

import { Component, useRef, useEffect, useState, onWillDestroy } from '@odoo/owl';
import { Pager } from '@web/core/pager/pager';
import { renderToString } from '@web/core/utils/render';
import { Widget } from '@web/views/widgets/widget';
import { useService } from '@web/core/utils/hooks';

import { GoogleMapSidebar } from './google_map_sidebar';
import {
    MARKER_ICON_SVG_PATH,
    MARKER_ICON_HEIGHT,
    MARKER_ICON_WIDTH,
    MAP_THEMES,
} from './utils';

export class GoogleMapRenderer extends Component {
    setup() {
        this.user = useService('user');
        this.rpc = useService('rpc');

        this.mapRef = useRef('map');
        this.searchPlacesRef = useRef('searchPlaces');
        this.markerCluster = null;
        this.isPlacesSearchEnable = null;
        this.markerPlacesSearch = null;
        this.googleMap = null;
        this.placesAutocomplete = null;
        this.markers = [];
        this.state = useState({ sidebarIsFolded: false });

        useEffect(() => this.renderMap());
        onWillDestroy(() => {
            if (this.googleMap) {
                google.maps.event.clearInstanceListeners(this.googleMap);
            }
        });
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
                mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain', 'styled_map'],
            },
        });
        // Associate the styled map with the MapTypeId and set it to display.
        this.googleMap.mapTypes.set('styled_map', styledMapType);
        this.googleMap.setMapTypeId('styled_map');
    }

    async getMapConf() {
        const data = await this.rpc('/web/base_google_map/settings', {
            context: this.user.context,
        });
        this.isPlacesSearchEnable = data.is_places_search_enable;
        if (data.theme) {
            this._setMapTheme(data.theme);
        }
        this.renderGooglePlaceSearch();
    }

    renderGooglePlaceSearch() {
        if (this.isPlacesSearchEnable) {
            if (!this.markerPlacesSearch) {
                this.markerPlacesSearch = new google.maps.Marker({
                    map: this.googleMap,
                    anchorPoint: new google.maps.Point(0, -29),
                });
            } else {
                this.markerPlacesSearch.setVisible(false);
            }

            if (!this.placesAutocomplete) {
                this.placesAutocomplete = new google.maps.places.Autocomplete(
                    this.searchPlacesRef.el,
                    {
                        fields: ['geometry', 'formatted_address'],
                        types: ['establishment'],
                    }
                );
                this.placesAutocomplete.bindTo('bounds', this.googleMap);
                this.searchPlacesRef.el.style.display = 'block';
                this.googleMap.controls[google.maps.ControlPosition.TOP_RIGHT].push(
                    this.searchPlacesRef.el
                );

                setTimeout(() => {
                    this.searchPlacesRef.el.style.opacity = 1;
                }, 800);

                google.maps.event.addListener(
                    this.placesAutocomplete,
                    'place_changed',
                    this.handleSearchPlaceResult.bind(this)
                );
            }
        }
    }

    handleSearchPlaceResult() {
        const place = this.placesAutocomplete.getPlace();
        if (place) {
            if (place.geometry.hasOwnProperty('viewport') && place.geometry.viewport) {
                this.googleMap.fitBounds(place.geometry.viewport);
            } else {
                this.googleMap.panTo(place.geometry.location);
            }
            this.markerPlacesSearch.setPosition(place.geometry.location);
            this.markerPlacesSearch.setVisible(true);

            const para = document.createElement('p');
            const node = document.createTextNode(place.formatted_address);
            para.appendChild(node);

            const divContent = document.createElement('div');
            divContent.appendChild(para);

            this.markerInfoWindow.setContent(divContent);
            this.markerInfoWindow.open(this.googleMap, this.markerPlacesSearch);

            this.markerInfoWindow.addListener('closeclick', () => {
                this.markerPlacesSearch.setVisible(false);
            });
        }
    }

    handleSearchPlaceBounds() {
        if (this.placesAutocomplete) {
            this.placesAutocomplete.bindTo('bounds', this.googleMap);
        }
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
            this.getMapConf();
        }
        this.markerInfoWindow = new google.maps.InfoWindow();
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
            this.googleMap.panTo(marker.getPosition());
            google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                google.maps.event.trigger(this.googleMap, 'resize');
                if (this.googleMap.getZoom() < 13) this.googleMap.setZoom(13);
                google.maps.event.trigger(marker, 'click');
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
