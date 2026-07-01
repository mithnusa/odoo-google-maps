import { _t } from '@web/core/l10n/translation';
import { Component, onWillUnmount, onMounted } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { renderToString } from '@web/core/utils/render';

export class GoogleMapGeolocate extends Component {
    static template = 'web_widget_google_map.Geolocate';
    static props = ['googleMap'];

    setup() {
        this.notificationService = useService('notification');
        this.geolocateBtn = null;
        this._idleListener = null;
        // Store bound reference for proper cleanup
        this._boundGeolocation = this.geolocation.bind(this);

        onMounted(() => {
            this._onMounted();
        });

        onWillUnmount(() => {
            this._cleanup();
        });
    }

    /**
     * Initialize geolocation button and info window when component is rendered
     * @returns {void}
     * @private
     */
    _onMounted() {
        if (this.props.googleMap && !this.geolocateBtn) {
            this.infoWindow = new google.maps.InfoWindow();
            const content = renderToString('web_widget_google_map.GeolocateBtn', {});
            this.geolocateBtn = new DOMParser().parseFromString(content, 'text/html').querySelector('div');

            this.props.googleMap.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(this.geolocateBtn);

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

            // Check permission state before calling getCurrentPosition.
            // When state is 'prompt', getCurrentPosition triggers the browser dialog.
            // When state is 'denied', the browser silently fires the error callback —
            // we intercept here to show a clear, actionable message instead.
            if (navigator.permissions) {
                const { state } = await navigator.permissions.query({ name: 'geolocation' });
                if (state === 'denied') {
                    this.notificationService.add(
                        _t(
                            'Location access is blocked. Click the lock icon in your browser address bar, allow location access, then try again.'
                        ),
                        { type: 'danger' }
                    );
                    return;
                }
            }

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                });
            });

            await this._geolocationSuccess(position);
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

            const markerContent = renderToString('web_widget_google_map.GeolocateMarker', {});
            const content = new DOMParser().parseFromString(markerContent, 'text/html').querySelector('svg');

            this.marker = new AdvancedMarkerElement({
                map: this.props.googleMap,
                position: latLng,
                content,
            });

            this.marker.addListener('gmp-click', this._onMarkerClick.bind(this));

            // Hide marker when info window is closed
            this.infoWindow.addListener('closeclick', () => {
                this.marker.map = null;
            });
        }

        // Always update the marker position to ensure it reflects the latest geolocation
        this.marker.position = latLng;

        if (this.marker.map === null) {
            this.marker.map = this.props.googleMap;
        }

        this.props.googleMap.panTo(latLng);

        if (this._idleListener) {
            google.maps.event.removeListener(this._idleListener);
        }

        this._idleListener = google.maps.event.addListenerOnce(this.props.googleMap, 'idle', () => {
            this._idleListener = null;
            if (this.props.googleMap.getZoom() < 16) this.props.googleMap.setZoom(16);
            this._onMarkerClick();
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
                    message = _t(
                        'Location access is blocked. Click the lock icon in your browser address bar, allow location access, then try again.'
                    );
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
        } else if (error) {
            console.error('Geolocation error:', error);
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
            google.maps.event.clearListeners(this.marker, 'gmp-click');
        }
        if (this.infoWindow) {
            this.infoWindow.close();
            google.maps.event.clearListeners(this.infoWindow, 'closeclick');
        }
        if (this._idleListener) {
            google.maps.event.removeListener(this._idleListener);
            this._idleListener = null;
        }
        if (this.geolocateBtn && this._boundGeolocation) {
            this.geolocateBtn.removeEventListener('click', this._boundGeolocation);
            // Remove button from map controls
            if (this.props.googleMap) {
                const controls = this.props.googleMap.controls[google.maps.ControlPosition.RIGHT_BOTTOM];
                const index = controls ? controls.getArray().indexOf(this.geolocateBtn) : -1;
                if (index > -1) {
                    controls.removeAt(index);
                }
            }
        }
    }
}
