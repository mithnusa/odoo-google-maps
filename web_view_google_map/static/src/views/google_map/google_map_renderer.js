/** @odoo-module **/

import { Component, useRef, useEffect, useState, onMounted } from '@odoo/owl';
import { Pager } from "@web/core/pager/pager";
import { Widget } from "@web/views/widgets/widget";

import { GoogleMapSidebar } from './google_map_sidebar';
import { MARKER_ICON_SVG_PATH, MARKER_ICON_HEIGHT, MARKER_ICON_WIDTH } from './utils';

export class GoogleMapRenderer extends Component {
    setup() {
        console.log(' #[[GoogleMapRenderer::setup] ');
        this.mapRef = useRef('map');
        this.googleMap = null;
        this.state = useState({
            sidebarIsFolded: false,
            sidebarReload: false,
        });
        console.log(this);
        // useEffect(
        //     () => this.renderMap(),
        //     () => [this.props.list.id]
        // );
        useEffect(() => this.renderMap());
        onMounted(() => console.log('---------------<[onMounted]> '));
    }

    renderMap() {
        console.log(' #[[GoogleMapRenderer::renderMap] ');
        console.log(this);
        this.initialize();
        this.clearMarkers();
        this.renderMarkers();
        this.renderMarkerClusterer();
        this.centerMap();
    }

    initialize() {
        this.googleMap = this.props.onInitGoogleMap(this.mapRef.el);
    }

    renderMarkerClusterer() {
        this.props.onHandleMarkerClusterer();
    }

    clearMarkers() {
        this.props.onClearMarkers();
    }

    centerMap() {
        this.props.onCenterMap();
        // this.state.sidebarReload = new Date().toISOString();
    }

    createMarker(latLng, record, color) {
        const _color = color || 'red';
        const options = {
            position: latLng,
            map: this.googleMap,
            optimized: true,
            _odooRecord: record,
            _odooMarkerColor: _color,
            icon: {
                path: MARKER_ICON_SVG_PATH,
                fillColor: _color,
                fillOpacity: 1,
                strokeWeight: 0.75,
                strokeColor: '#444',
                scale: 0.067,
                anchor: new google.maps.Point(MARKER_ICON_WIDTH / 2, MARKER_ICON_HEIGHT),
            },
        };
        const marker = new google.maps.Marker(options);
        return marker;
    }

    renderMarkers() {
        let latLng;
        let lat;
        let lng;
        let marker;
        let color;

        this.props.list.records.map((record) => {
            color = 'red';
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
                this.props.onHandleMarker(marker);
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
                if (this.googleMap.getZoom() < 12) this.googleMap.setZoom(12);
                google.maps.event.trigger(marker, 'click');
            });
        }
    }

    get isEmpty() {
        return this.props.list.records.length <= 0;
    }
}

GoogleMapRenderer.template = 'web_view_google_map.GoogleMapRenderer';
GoogleMapRenderer.components = { GoogleMapSidebar, Pager, Widget };
GoogleMapRenderer.props = [
    'archInfo',
    'openRecord',
    'readonly',
    'list',
    'onAdd?',
    'model',
    'onInitGoogleMap',
    'onCenterMap',
    'onClearMarkers',
    'onHandleMarker',
    'onHandleMarkerClusterer',
    'onHandleGetMarkers',
];
