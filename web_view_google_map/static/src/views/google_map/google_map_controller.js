/** @odoo-module **/

import { Layout } from '@web/search/layout';
import { useModel } from '@web/views/model';
import { usePager } from '@web/search/pager_hook';
import { useService } from '@web/core/utils/hooks';
import { standardViewProps } from '@web/views/standard_view_props';
import { useSetupView } from '@web/views/view_hook';
import { Component, useRef, useState, onWillDestroy } from '@odoo/owl';

import { GoogleMapRenderer } from './google_map_renderer';
import { MAP_THEMES } from './utils';

export class GoogleMapController extends Component {
    setup() {
        console.log(' [GoogleMapController] ');
        console.log(this);
        this.actionService = useService('action');
        this.user = useService('user');

        this.markerCluster = null;
        this.markers = [];

        // we will re-using the google map instance
        this.state = useState({ googleMap: null });

        const rootRef = useRef('root');
        const { Model, resModel, fields, archInfo, limit, state } = this.props;
        const { rootState } = state || {};

        this.model = useModel(Model, {
            activeFields: archInfo.activeFields,
            fields,
            resModel,
            handleField: archInfo.handleField,
            limit: archInfo.limit || limit,
            onCreate: archInfo.onCreate,
            viewMode: 'google_map',
            rootState,
        });

        useSetupView({
            rootRef,
            getGlobalState: () => {
                return {
                    resIds: this.model.root.records.map((rec) => rec.resId), // WOWL: ask LPE why?
                };
            },
            getLocalState: () => {
                return {
                    rootState: this.model.root.exportState(),
                };
            },
        });
        usePager(() => {
            const root = this.model.root;
            const { count, hasLimitedCount, limit, offset } = root;
            return {
                offset: offset,
                limit: limit,
                total: count,
                onUpdate: async ({ offset, limit }) => {
                    this.model.root.offset = offset;
                    this.model.root.limit = limit;
                    await this.model.root.load();
                    await this.onUpdatedPager();
                    this.render(true);
                },
                updateTotal: hasLimitedCount ? () => root.fetchCount() : undefined,
            };
        });
        onWillDestroy(() => {
            if (this.state.googleMap) {
                console.log(' =============> CLEAR INSTANCE LISTENERS ');
                google.maps.event.clearInstanceListeners(this.state.googleMap);
            }
        });
    }

    _setMapTheme(style) {
        if (!Object.prototype.hasOwnProperty.call(MAP_THEMES, style) || style === 'default') {
            return;
        }
        const styledMapType = new google.maps.StyledMapType(MAP_THEMES[style], {
            name: 'Styled Map',
        });
        this.state.googleMap.setOptions({
            mapTypeControlOptions: {
                mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain', 'styled_map'],
            },
        });
        // Associate the styled map with the MapTypeId and set it to display.
        this.state.googleMap.mapTypes.set('styled_map', styledMapType);
        this.state.googleMap.setMapTypeId('styled_map');
    }

    async getTheme() {
        const data = await this.model.rpc('/web/base_google_map/theme', { context: this.user.context });
        if (data.theme) {
            this._setMapTheme(data.theme);
        }
    }

    initializeGoogleMap(el) {
        console.log(' [GoogleMapController::instantiateGoogleMap] ');
        if (!this.state.googleMap) {
            console.log(' --------------> Create instance of GMaps ');
            this.state.googleMap = new google.maps.Map(el, {
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                minZoom: 2,
                maxZoom: 20,
                fullscreenControl: true,
                mapTypeControl: true,
                gestureHandling: 'auto',
            });
            this.getTheme();
        } else {
            console.log(' Using existing instance of GMaps ');
        }
        this.markerInfoWindow = new google.maps.InfoWindow();
        return this.state.googleMap;
    }

    clearMarkers() {
        if (this.markerCluster) {
            this.markerCluster.clearMarkers();
        }
        this.markers = [];
    }

    centerMap() {
        console.log(' [GoogleMapController::centerMap] ');
        const mapBounds = new google.maps.LatLngBounds();
        this.markers.forEach((marker) => {
            mapBounds.extend(marker.getPosition());
        });
        this.state.googleMap.fitBounds(mapBounds);
        google.maps.event.addListenerOnce(this.state.googleMap, 'idle', () => {
            google.maps.event.trigger(this.state.googleMap, 'resize');
            if (this.state.googleMap.getZoom() > 17) this.state.googleMap.setZoom(17);
        });
    }

    handleMarker(marker) {
        const markers = this.markers;
        const existingRecords = [];
        if (markers.length > 0) {
            const position = marker.getPosition();
            markers.forEach((_cMarker) => {
                if (position && position.equals(_cMarker.getPosition())) {
                    marker.setMap(null);
                    existingRecords.push(_cMarker._odooRecord);
                }
            });
        }
        this.markers.push(marker);
        google.maps.event.addListener(marker, 'click', this.handleMarkerInfoWindow.bind(this, marker, existingRecords));
    }

    handleMarkerClusterer() {
        const markers = this.markers;
        if (!this.markerCluster) {
            this.markerCluster = new markerClusterer.MarkerClusterer({
                map: this.state.googleMap,
                markers,
            });
        } else {
            this.markerCluster.addMarkers(markers);
        }
    }

    handleMarkerInfoWindow(marker, existingRecords) {
        const markerDiv = '<div>Hello There!</div>';
        this.markerInfoWindow.setContent(markerDiv);
        this.markerInfoWindow.open(this.state.googleMap, marker);
    }

    handlePointInMap(marker) {
        if (marker) {
            this.state.googleMap.panTo(marker.getPosition());
            google.maps.event.addListenerOnce(this.state.googleMap, 'idle', () => {
                google.maps.event.trigger(this.state.googleMap, 'resize');
                if (this.state.googleMap.getZoom() < 12) this.state.googleMap.setZoom(12);
                google.maps.event.trigger(marker, 'click');
            });
        }
    }

    getMarkers() {
        return this.markers;
    }

    async openRecord(record, mode) {
        const activeIds = this.model.root.records.map((datapoint) => datapoint.resId);
        this.props.selectRecord(record.resId, { activeIds, mode });
    }

    get className() {
        return this.props.className;
    }

    async createRecord() {
        await this.props.createRecord();
    }

    get display() {
        return this.props.display;
    }

    get canCreate() {
        const { create } = this.props.archInfo.activeActions;
        return create;
    }

    async onUpdatedPager() {
        console.log(' <[GoogleMapController::onUpdatedPager]> ');
        console.log(this);
    }
}

GoogleMapController.template = 'web_view_google_map.GoogleMapView';
GoogleMapController.components = { Layout, GoogleMapRenderer };
GoogleMapController.props = {
    ...standardViewProps,
    showButtons: { type: Boolean, optional: true },
    Model: Function,
    Renderer: Function,
    buttonTemplate: String,
    archInfo: Object,
};
GoogleMapController.defaultProps = {
    createRecord: () => {},
    selectRecord: () => {},
    centerMap: () => {},
    showButtons: true,
};
