import { _t } from '@web/core/l10n/translation';
import { Component, onRendered, onWillUnmount } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { renderToString } from '@web/core/utils/render';

export class GoogleMapGeolocate extends Component {
    static template = 'web_view_google_map.Geolocate';
    static props = ['googleMap'];

    setup() {
        this.notificationService = useService('notification');
        // Store bound reference for proper cleanup
        this._boundGeolocation = this.geolocation.bind(this);
        onRendered(this._onRendered);
        onWillUnmount(this._cleanup);
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

            this.geolocateBtn.addEventListener('click', this._boundGeolocation);
        }
    }

    /**
     * Get current user location using browser's geolocation API
     * @returns {Promise<void>}
     */
    async geolocation() {
        try {
            if (!navigator.geolocation) {
                this.notificationService.add(_t('Geolocation is not supported by your browser.'), { type: 'warning' });
                return;
            }

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000, // 10 seconds
                    maximumAge: 0,
                });
            });

            this._geolocationSuccess(position);
        } catch (error) {
            console.warn('Geolocation error:', error);
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

            const markerContent = renderToString('web_view_google_map.GeolocateMarker', {});
            const content = new DOMParser()
                .parseFromString(markerContent, 'text/html')
                .querySelector('svg');

            this.marker = new AdvancedMarkerElement({
                map: this.props.googleMap,
                position: latLng,
                content,
            });

            this.marker.addListener('click', this._onMarkerClick.bind(this));

            // Hide marker when info window is closed
            this.infoWindow.addListener('closeclick', () => {
                this.marker.map = null;
            });
        }

        if (this.marker.map === null) {
            this.marker.map = this.props.googleMap;
        }

        this.props.googleMap.panTo(this.marker.position);

        google.maps.event.addListenerOnce(this.props.googleMap, 'idle', () => {
            if (this.props.googleMap.getZoom() < 16) this.props.googleMap.setZoom(16);
            google.maps.event.trigger(this.marker, 'gmp-click');
        });
    }

    _onMarkerClick() {
        const content = document.createElement('div');
        content.classList.add('infoWindow', 'p-3', 'mt-3');
        content.innerText = _t('Your location');
        
        this.infoWindow.setOptions({ content });
        this.infoWindow.open(this.props.googleMap, this.marker);
    }

    /**
     * Handle geolocation errors and display appropriate notifications
     * @param {GeolocationPositionError|Error} error - The error object from geolocation API
     * @returns {void}
     * @private
     */
    _geolocationFailed(error) {
        let message = _t('An unknown error occurred. Please check Javascript console for details.');

        if (typeof error.code === 'number') {
            switch (error.code) {
                case 1: // PERMISSION_DENIED
                    message = _t('Geolocation is disabled. Please enable it in your browser settings if you want browser to detect your location.');
                    break;
                case 2: // POSITION_UNAVAILABLE
                    message = _t('Location information is unavailable.');
                    break;
                case 3: // TIMEOUT
                    message = _t('The request to get user location timed out.');
                    break;
                default:
                    message = _t('An unknown error occurred. Please check Javascript console for details.');
            }
        } else if (error.message) {
            message = error.message;
        }

        this.notificationService.add(message, { type: 'danger' });
    }

    /**
     * Cleanup method to remove markers, info windows, and event listeners
     * @returns {void}
     * @private
     */
    _cleanup() {
        if (this.marker) {
            this.marker.map = null;
            google.maps.event.clearListeners(this.marker, 'click');
        }
        if (this.infoWindow) {
            this.infoWindow.close();
            google.maps.event.clearListeners(this.infoWindow, 'closeclick');
        }
        if (this.geolocateBtn && this._boundGeolocation) {
            this.geolocateBtn.removeEventListener('click', this._boundGeolocation);
            // Remove button from map controls
            if (this.props.googleMap) {
                const controls = this.props.googleMap.controls[google.maps.ControlPosition.RIGHT_BOTTOM];
                const index = controls ? (controls.getArray() || []).indexOf(this.geolocateBtn) : -1;
                if (index > -1) {
                    controls.removeAt(index);
                }
            }
        }
    }
}
