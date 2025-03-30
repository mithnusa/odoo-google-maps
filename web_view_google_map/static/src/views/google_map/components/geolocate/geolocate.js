import { _t } from '@web/core/l10n/translation';
import { Component, onRendered, onWillDestroy } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { renderToString } from '@web/core/utils/render';

export class GoogleMapGeolocate extends Component {
    static template = 'web_view_google_map.Geolocate';
    static props = ['googleMap'];

    setup() {
        this.notificationService = useService('notification');
        onRendered(this._onRendered);
        onWillDestroy(this._cleanup);
    }

    /**
     * Initialize geolocation button and info window when component is rendered
     * @returns {void}
     * @private
     */
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

            this.geolocateBtn.addEventListener('click', this.geolocation.bind(this));
        }
    }

    /**
     * Get current user location using browser's geolocation API
     * @returns {Promise<void>}
     */
    async geolocation() {
        try {
            if (!navigator.geolocation) {
                throw new Error('Geolocation not supported');
            }

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                });
            });

            this._geolocationSuccess(position);
        } catch (error) {
            this._geolocationFailed(error);
        }
    }

    /**
     * Handle successful geolocation request
     * @param {GeolocationPosition} position - The position object returned by geolocation API
     * @returns {Promise<void>}
     * @private
     */
    async _geolocationSuccess(position) {
        const latLng = { lat: position.coords.latitude, lng: position.coords.longitude };

        if (!this.marker) {
            const { AdvancedMarkerElement } = await this.env.apiLoader.importLibrary('marker');

            const mapPinElement = document.createElement('div');
            mapPinElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-map-pin"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

            this.marker = new AdvancedMarkerElement({
                map: this.props.googleMap,
                position: latLng,
                content: mapPinElement,
            });

            const content = new DOMParser()
                .parseFromString(
                    '<div class="infoWindow p-3 mt-3">' + _t('Your location') + '</div>',
                    'text/html'
                )
                .querySelector('div');

            this.marker.addListener('gmp-click', () => {
                this.infoWindow.setOptions({ content });
                this.infoWindow.open(this.props.googleMap, this.marker);
            });
            this.infoWindow.addListener('closeclick', () => {
                this.marker.map = null;
            });
        }

        if (this.marker.map === null) {
            this.marker.map = this.props.googleMap;
        }

        this.props.googleMap.panTo(this.marker.position);

        google.maps.event.addListenerOnce(this.props.googleMap, 'idle', () => {
            google.maps.event.trigger(this.props.googleMap, 'resize');
            if (this.props.googleMap.getZoom() < 16) this.props.googleMap.setZoom(16);
            google.maps.event.trigger(this.marker, 'gmp-click');
        });
    }

    /**
     * Handle geolocation errors and display appropriate notifications
     * @param {GeolocationPositionError} error - The error object from geolocation API
     * @returns {void}
     * @private
     */
    _geolocationFailed(error) {
        let message = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = _t('User denied the request for Geolocation.');
                break;
            case error.POSITION_UNAVAILABLE:
                message = _t('Location information is unavailable.');
                break;
            case error.TIMEOUT:
                message = _t('The request to get user location timed out.');
                break;
            case error.UNKNOWN_ERROR:
                message = _t('An unknown error occurred.');
                break;
        }
        this.notificationService.add(message, { type: 'error' });
    }

    /**
     * Cleanup method to remove markers, info windows, and event listeners
     * @returns {void}
     * @private
     */
    _cleanup() {
        if (this.marker) {
            this.marker.map = null;
            google.maps.event.clearListeners(this.marker, 'gmp-click');
        }
        if (this.infoWindow) {
            this.infoWindow.close();
        }
        if (this.geolocateBtn) {
            this.geolocateBtn.removeEventListener('click', this.geolocation);
        }
    }
}
