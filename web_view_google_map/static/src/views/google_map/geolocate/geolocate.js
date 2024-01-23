/** @odoo-module **/
import { _t } from '@web/core/l10n/translation';
import { Component, onRendered } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { renderToString } from '@web/core/utils/render';

export class GoogleMapGeolocate extends Component {
    static template = 'web_view_google_map.Geolocate';
    static props = ['googleMap'];

    setup() {
        this.notification = useService('notification');
        onRendered(this._onRendered);
    }
    _onRendered() {
        if (this.props.googleMap && !this.geolocateBtn) {
            this.infoWindow = new google.maps.InfoWindow();
            const content = renderToString('web_view_google_map.GeolocateBtn', {});
            this.geolocateBtn = new DOMParser()
                .parseFromString(content, 'text/html')
                .querySelector('div');

            this.props.googleMap.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(
                this.geolocateBtn
            );

            this.geolocateBtn.addEventListener('click', () => {
                this.geolocation();
            });
        }
    }
    geolocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this._geolocationSuccess(position);
                },
                (error) => {
                    this._geolocationFailed(error);
                },
                { enableHighAccuracy: true }
            );
        } else {
            this.notification.add(_t('Geolocation is not supported by this browser.'), {
                type: 'warning',
            });
        }
    }
    _geolocationSuccess(position) {
        const latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

        if (!this.marker) {
            this.marker = new google.maps.Marker({
                position: latLng,
                map: this.props.googleMap,
            });
            const content = new DOMParser()
                .parseFromString(
                    '<div class="infoWindow p-3">' + _t('Your location') + '</div>',
                    'text/html'
                )
                .querySelector('div');

            this.marker.addListener('click', () => {
                this.infoWindow.setOptions({ content });
                this.infoWindow.open(this.props.googleMap, this.marker);
            });
            this.infoWindow.addListener('closeclick', () => {
                this.marker.setMap(null);
            });
        }

        if (this.marker.getMap() === null) {
            this.marker.setMap(this.props.googleMap);
        }

        this.props.googleMap.panTo(this.marker.getPosition());
        this.marker.setAnimation(google.maps.Animation.DROP);

        google.maps.event.addListenerOnce(this.props.googleMap, 'idle', () => {
            google.maps.event.trigger(this.props.googleMap, 'resize');
            if (this.props.googleMap.getZoom() < 16) this.props.googleMap.setZoom(16);
            google.maps.event.trigger(this.marker, 'click');
        });
    }
    _geolocationFailed(error) {
        let message = '';
        console.error(error);
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Unable to access your location. Please allow location access to use this feature.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Your location information is currently unavailable.';
                break;
            case error.TIMEOUT:
                message = 'The request to get your location timed out. Please try again later.';
                break;
            case error.UNKNOWN_ERROR:
                message = 'An unknown error occurred while trying to get your location.';
                break;
        }
        this.notification.add(message, { type: 'warning' });
    }
}
