import { useRef, onWillUnmount, useState } from '@odoo/owl';
import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { LOADER_STATUS } from '@base_google_map/utils/loader_google_map';

export class GoogleMapFormRenderer extends BaseGoogleMapComponent {
    static template = 'web_view_google_map.GoogleMapFormRenderer';
    static props = ['*'];

    setup() {
        super.setup();
        this.mapRef = useRef('map');

        const { latitudeField, longitudeField } = this.props.archInfo;
        this.fieldLat = latitudeField;
        this.fieldLng = longitudeField;

        this.state = useState({
            loaderStatus: LOADER_STATUS.NOT_LOADED,
        });

        onWillUnmount(this._cleanupListeners);
    }

    _cleanupListeners() {
        if (this.marker) {
            google.maps.event.clearListeners(this.marker, 'dragend');
            this.marker.map = null;
            this.marker = null;
        }
        if (this.googleMap) {
            google.maps.event.clearListeners(this.googleMap, 'idle');
        }
    }

    updateLoaderState(status) {
        this.state.loaderStatus = status;
    }

    mapDivElement() {
        return this.mapRef.el;
    }

    onMapReady() {
        this.renderMarker();
    }

    async renderMarker() {
        const { record } = this.props;
        if (this.props.record && this.fieldLat && this.fieldLng) {
            const canEdit = this.props.archInfo.activeActions.edit || false;

            const lat = record.data[this.fieldLat] || 0.0;
            const lng = record.data[this.fieldLng] || 0.0;

            const isZoomIn = lat !== 0.0 || lng !== 0.0;
            const markerOptions = {
                position: { lat, lng },
                map: this.googleMap,
                gmpDraggable: canEdit,
            };

            try {
                const { AdvancedMarkerElement } = await this.apiLoader.importLibrary('marker');
                this.marker = new AdvancedMarkerElement(markerOptions);
                if (isZoomIn) {
                    this.googleMap.panTo({ lat, lng });
                    google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                        if (this.googleMap.getZoom() < 18) this.googleMap.setZoom(18);
                    });
                }
                if (canEdit && this.marker) {
                    this.marker.addListener('dragend', this._handleMarkerDragend.bind(this));
                }
            } catch (error) {
                console.error('Error loading Google Maps API:', error);
                return;
            }
        }
    }

    _handleMarkerDragend() {
        const position = this.marker.position;
        this.googleMap.panTo(position);
        this.props.record.update({
            [this.fieldLat]: position.lat,
            [this.fieldLng]: position.lng,
        });
    }
}
