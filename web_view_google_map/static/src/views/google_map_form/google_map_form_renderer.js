/** @odoo-module **/

import { useRef, onWillUnmount } from '@odoo/owl';
import { BaseGoogleMap } from '@base_google_map/utils/base_google_map';

export class GoogleMapFormRenderer extends BaseGoogleMap {
    setup() {
        super.setup();
        this.mapRef = useRef('map');

        this.fieldLat = this.props.archInfo.latitudeField;
        this.fieldLng = this.props.archInfo.longitudeField;

        onWillUnmount(() => {
            if (this.editableMarkerDragEnd) {
                google.maps.event.removeListener(this.editableMarkerDragEnd);
            }
        });
    }

    createMarker(options) {
        return new google.maps.Marker(options);
    }

    initialize() {
        if (!this.googleMap) {
            const options = this.getMapOptions();
            this.googleMap = new google.maps.Map(this.mapRef.el, options);
            this.setMapTheme();
        }
        this.renderMarker();
    }

    prepareMarkerOptions(lat, lng) {
        let options = {
            position: { lat, lng },
            map: this.googleMap,
        };
        const canEdit = this.props.archInfo.activeActions.edit;
        if (canEdit) {
            options.draggable = true;
            options.animation = google.maps.Animation.BOUNCE;
        }
        return options;
    }

    renderMarker() {
        const { record } = this.props;
        if (this.props.record && this.fieldLat && this.fieldLng) {
            const canEdit = this.props.archInfo.activeActions.edit;
            const lat = record.data[this.fieldLat] || 0.0;
            const lng = record.data[this.fieldLng] || 0.0;
            const isZoomIn = lat !== 0.0 || lng !== 0.0;
            const markerOptions = this.prepareMarkerOptions(lat, lng);
            this.marker = this.createMarker(markerOptions);
            if (isZoomIn) {
                this.googleMap.panTo({ lat, lng });
                google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
                    if (this.googleMap.getZoom() < 14) this.googleMap.setZoom(14);
                });
            }

            if (canEdit) {
                google.maps.event.addListenerOnce(this.marker, 'dragend', () => {
                    this.googleMap.setCenter(this.marker.getPosition());
                    if (this.googleMap.getZoom() < 14) this.googleMap.setZoom(14);
                });

                this.editableMarkerDragEnd = google.maps.event.addListener(
                    this.marker,
                    'dragend',
                    this._handleMarkerDragend.bind(this)
                );
            }
        }
    }

    _handleMarkerDragend() {
        this.googleMap.panTo(this.marker.getPosition());
        const position = this.marker.getPosition();
        this.props.record.update({
            [this.fieldLat]: position.lat(),
            [this.fieldLng]: position.lng(),
        });
    }
}

GoogleMapFormRenderer.template = 'web_view_google_map.GoogleMapFormRenderer';
