import { Component, useRef, useEffect, onWillUnmount, useState } from '@odoo/owl';
import { Dialog } from '@web/core/dialog/dialog';
import { useService } from '@web/core/utils/hooks';
import { _t } from '@web/core/l10n/translation';
import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';

export class GoogleMapStreetViewSideBySideDialog extends Component {
    static template = 'web_widget_google_map.GoogleMapStreetViewSideBySideDialog';
    static components = { Dialog };
    static props = {
        close: Function,
        lat: Number,
        lng: Number,
        title: { type: String, optional: true },
        heading: { type: Number, optional: true },
        pitch: { type: Number, optional: true },
        zoom: { type: Number, optional: true },
    };
    static defaultProps = {
        title: _t('Street View'),
        heading: 34,
        pitch: 10,
        zoom: 0,
    };

    setup() {
        this.notificationService = useService('notification');

        try {
            this._validateProps();
        } catch (error) {
            this.notificationService.add(error.message, { type: 'danger' });
            Promise.resolve().then(() => this.props.close());
            return;
        }

        this._isMounted = true;
        this.mapRef = useRef('map');
        this.streetViewRef = useRef('streetView');
        this.googleMap = null;
        this.panorama = null;
        this._locationMarker = null;
        this._initInProgress = false;

        this.state = useState({ isGoogleLoaded: false, streetViewAvailable: true });

        this.apiLoader = useGoogleMapsAPILoader(
            () => {
                this.state.isGoogleLoaded = true;
            },
            (error) => {
                this.state.isGoogleLoaded = false;
                this.notificationService.add(
                    _t('Failed to load Google Maps API.\n%(err)s', { err: error.message || error }),
                    { type: 'danger' }
                );
            }
        );

        useEffect(
            (isGoogleLoaded, mapEl, streetViewEl) => {
                if (isGoogleLoaded && mapEl && streetViewEl) {
                    this.initializeMapAndStreetView();
                }
            },
            () => [this.state.isGoogleLoaded, this.mapRef.el, this.streetViewRef.el]
        );

        onWillUnmount(() => {
            this._isMounted = false;
            this._cleanup();
        });
    }

    _cleanup() {
        if (this._locationMarker) {
            this._locationMarker.map = null;
            this._locationMarker = null;
        }
        if (this.panorama) {
            google.maps.event.clearInstanceListeners(this.panorama);
            this.panorama = null;
        }
        if (this.googleMap) {
            google.maps.event.clearInstanceListeners(this.googleMap);
            this.googleMap = null;
        }
    }

    async initializeMapAndStreetView() {
        if (this.googleMap || this._initInProgress) return;
        try {
            this._initInProgress = true;
            const [
                { Map },
                { StreetViewPanorama, StreetViewService, StreetViewStatus },
                { AdvancedMarkerElement },
            ] = await Promise.all([
                this.apiLoader.importLibrary('maps'),
                this.apiLoader.importLibrary('streetView'),
                this.apiLoader.importLibrary('marker'),
            ]);

            if (!this._isMounted) return;

            const settings = this.apiLoader.getSettings();
            const { lat, lng, heading, pitch, zoom } = this.props;
            const position = { lat, lng };

            // Always create the map so the left panel is usable regardless.
            const map = new Map(this.mapRef.el, {
                center: position,
                mapId: settings.map_id,
                zoom: 14,
            });
            this.googleMap = map;

            // Check coverage before creating the panorama.
            // StreetViewPanorama silently renders black when no imagery exists.
            // Use the callback form to avoid Promise rejection on ZERO_RESULTS
            // (the Promise-based API rejects for any non-OK status, which would
            // be caught by the outer catch and wrongly show an error notification).
            const svStatus = await new Promise((resolve) => {
                new StreetViewService().getPanorama(
                    { location: position, radius: 50 },
                    (_data, status) => resolve(status)
                );
            });

            if (!this._isMounted) return;

            if (svStatus !== StreetViewStatus.OK) {
                this.state.streetViewAvailable = false;
                this._locationMarker = new AdvancedMarkerElement({ map, position });
                return;
            }

            const panorama = new StreetViewPanorama(this.streetViewRef.el, {
                position,
                pov: { heading, pitch },
                zoom,
            });

            map.setStreetView(panorama);
            this.panorama = panorama;
        } catch (error) {
            this.notificationService.add(
                _t('Failed to initialize Street View.\n%(err)s', { err: error.message || error }),
                { type: 'danger' }
            );
        } finally {
            this._initInProgress = false;
        }
    }

    get streetViewUnavailableText() {
        return _t('Street View is not available for this location.');
    }

    _validateProps() {
        const { lat, lng, heading, pitch, zoom } = this.props;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error(_t('Invalid latitude or longitude values.'));
        }

        if (!Number.isFinite(heading) || !Number.isFinite(pitch) || !Number.isFinite(zoom)) {
            throw new Error(_t('Invalid heading, pitch, or zoom values.'));
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new Error(
                _t(
                    'Latitude must be between -90 and 90, and longitude must be between -180 and 180.'
                )
            );
        }

        if (zoom < 0 || zoom > 5) {
            throw new Error(_t('Panorama zoom level must be between 0 and 5.'));
        }

        if (pitch < -90 || pitch > 90) {
            throw new Error(_t('Pitch must be between -90 and 90.'));
        }

        if (heading < 0 || heading >= 360) {
            throw new Error(_t('Heading must be between 0 and 360.'));
        }
    }
}
