/** @odoo-module **/

import { Component, onRendered } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { renderToString } from '@web/core/utils/render';

export class GoogleMapGeolocate extends Component {
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
            this.notification.add(this.env._t('Geolocation is not supported by this browser.'), {
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
                    '<div class="infoWindow p-3">' + this.env._t('Your location') + '</div>',
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
        console.log({ error });
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = this.env._t('User denied the request for Geolocation.');
                break;
            case error.POSITION_UNAVAILABLE:
                message = this.env._t('Location information is unavailable.');
                break;
            case error.TIMEOUT:
                message = this.env._t('The request to get user location timed out.');
                break;
            case error.UNKNOWN_ERROR:
                message = this.env._t('An unknown error occurred.');
                break;
        }
        this.notification.add(message, { type: 'warning' });
    }
}

GoogleMapGeolocate.template = 'web_view_google_map.Geolocate';
GoogleMapGeolocate.props = ['googleMap'];
