import { useService } from '@web/core/utils/hooks';
import { useLayoutEffect, useRef } from '@web/owl2/utils';
import { Component, onWillUnmount, props, proxy, t } from '@odoo/owl';
import { Dialog } from '@web/core/dialog/dialog';
import { _t } from '@web/core/l10n/translation';
import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';

// Lazily-built `OverlayView` subclass used to mark the target location when
// Street View isn't available. Built on first use (after the `maps` library
// has loaded) rather than at module scope, since `google.maps.OverlayView`
// doesn't exist until then. Avoids `AdvancedMarkerElement` (needs a `mapId`,
// which this dialog's map intentionally doesn't set) and the deprecated
// `google.maps.Marker`.
let LocationPinOverlay;
function getLocationPinOverlay() {
    if (!LocationPinOverlay) {
        LocationPinOverlay = class extends google.maps.OverlayView {
            constructor(position, map) {
                super();
                this.position = position;
                this.div = null;
                this.setMap(map);
            }
            onAdd() {
                this.div = document.createElement('div');
                Object.assign(this.div.style, {
                    position: 'absolute',
                    width: '18px',
                    height: '18px',
                    marginLeft: '-8px',
                    marginTop: '-8px',
                    borderRadius: '50%',
                    background: '#ea4335',
                    border: '2px solid #ffffff',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
                });
                this.getPanes().overlayMouseTarget.appendChild(this.div);
            }
            draw() {
                const point = this.getProjection()?.fromLatLngToDivPixel(this.position);
                if (point && this.div) {
                    this.div.style.left = `${point.x}px`;
                    this.div.style.top = `${point.y}px`;
                }
            }
            onRemove() {
                this.div?.parentNode?.removeChild(this.div);
                this.div = null;
            }
        };
    }
    return LocationPinOverlay;
}

export class GoogleMapStreetViewSideBySideDialog extends Component {
    static template = 'web_widget_google_map.GoogleMapStreetViewSideBySideDialog';
    static components = { Dialog };
    static props = {
        close: t.function(),
        lat: t.number(),
        lng: t.number(),
        title: t.string().optional(_t('Street View')),
        heading: t.number().optional(),
        pitch: t.number().optional(10),
        zoom: t.number().optional(0),
    };

    setup() {
        this.mapRef = useRef('map');
        this.streetViewRef = useRef('streetView');
        this.notificationService = useService('notification');
        this._isMounted = true;
        this.googleMap = null;
        this.panorama = null;
        this._locationMarker = null;
        this._initInProgress = false;

        this.state = proxy({ isGoogleLoaded: false, streetViewAvailable: true });

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

        useLayoutEffect(
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

        try {
            this._validateProps();
        } catch (error) {
            this.notificationService.add(error.message, { type: 'danger' });
            Promise.resolve().then(() => this.props.close());
            return;
        }
    }

    _cleanup() {
        if (this._locationMarker) {
            this._locationMarker.setMap(null);
            this._locationMarker = null;
        }
        if (this.panorama) {
            // Stop active tile fetching before removing. Without setVisible(false)
            // the panorama keeps requesting imagery tiles even after the dialog
            // closes, which causes 429s on rapid open/close cycles.
            this.panorama.setVisible(false);
            if (this.googleMap) {
                // Break the MVC binding created by map.setStreetView(panorama).
                // Without this, both objects stay alive in the Maps API internals
                // even after we null our references.
                this.googleMap.setStreetView(null);
            }
            google.maps.event.clearInstanceListeners(this.panorama);
            this.panorama.unbindAll();
            this.panorama = null;
        } else if (this.googleMap) {
            // No explicit panorama was bound (Street View unavailable branch),
            // but the user may still have dragged pegman onto the left map —
            // a nearby road can have coverage even if the exact address
            // doesn't. In that case the SDK lazily creates its own default
            // panorama for the pegman control that we hold no other
            // reference to; fetch and dispose of it explicitly here.
            const defaultStreetView = this.googleMap.getStreetView();
            if (defaultStreetView) {
                defaultStreetView.setVisible(false);
                google.maps.event.clearInstanceListeners(defaultStreetView);
                defaultStreetView.unbindAll();
            }
        }
        if (this.googleMap) {
            google.maps.event.clearInstanceListeners(this.googleMap);
            this.googleMap.unbindAll();
            this.googleMap = null;
        }
        // _cleanup() — defer the destructive DOM clear to the next frame so it never
        // interrupts a live WebGL render pass on this (or a sibling) vector map.
        // The explicit teardown above (unbindAll/clearInstanceListeners/nulling refs)
        // still runs synchronously and immediately stops tile/imagery fetching.
        requestAnimationFrame(() => {
            if (this.mapRef.el) {
                this.mapRef.el.innerHTML = '';
            }
            if (this.streetViewRef.el) {
                this.streetViewRef.el.innerHTML = '';
            }
        });
    }

    async initializeMapAndStreetView() {
        if (this.googleMap || this._initInProgress) return;
        try {
            this._initInProgress = true;
            const [{ Map }, { StreetViewPanorama, StreetViewService, StreetViewStatus }, { spherical }] =
                await Promise.all([
                    this.apiLoader.importLibrary('maps'),
                    this.apiLoader.importLibrary('streetView'),
                    this.apiLoader.importLibrary('geometry'),
                ]);

            if (!this._isMounted) return;

            const { lat, lng, heading, pitch, zoom } = this.props;
            const position = { lat, lng };

            // Always create the map so the left panel is usable regardless.
            // No mapId: this map is intentionally plain/raster, not vector-rendered
            // (WebGL). Vector maps sharing a mapId with other maps on the page were
            // implicated in the parent view's map going blank after this dialog
            // closes; going raster here avoids that shared WebGL context entirely.
            const map = new Map(this.mapRef.el, {
                center: position,
                zoom: 14,
            });
            this.googleMap = map;

            // Check coverage before creating the panorama.
            // StreetViewPanorama silently renders black when no imagery exists.
            // Use the callback form to avoid Promise rejection on ZERO_RESULTS
            // (the Promise-based API rejects for any non-OK status, which would
            // be caught by the outer catch and wrongly show an error notification).
            // We also capture panoLatLng here: the camera lands on the nearest road,
            // not exactly on `position`, so we compute heading from camera → target
            // instead of using a hardcoded default.
            const { svStatus, panoLatLng } = await new Promise((resolve) => {
                new StreetViewService().getPanorama({ location: position, radius: 50 }, (data, status) =>
                    resolve({ svStatus: status, panoLatLng: data?.location?.latLng ?? null })
                );
            });

            if (!this._isMounted) return;

            if (svStatus !== StreetViewStatus.OK) {
                this.state.streetViewAvailable = false;
                const LocationPinOverlay = getLocationPinOverlay();
                this._locationMarker = new LocationPinOverlay(position, map);
                return;
            }

            // If the caller supplied an explicit heading use it; otherwise point
            // from the panorama camera toward the target location.
            const effectiveHeading =
                heading !== undefined ? heading : panoLatLng ? spherical.computeHeading(panoLatLng, position) : 0;

            const panorama = new StreetViewPanorama(this.streetViewRef.el, {
                position,
                pov: { heading: effectiveHeading, pitch: pitch ?? 10 },
                zoom: zoom ?? 0,
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

        if (heading !== undefined && !Number.isFinite(heading)) {
            throw new Error(_t('Invalid heading value.'));
        }

        if (pitch !== undefined && (!Number.isFinite(pitch) || !Number.isFinite(zoom))) {
            throw new Error(_t('Invalid pitch or zoom values.'));
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new Error(_t('Latitude must be between -90 and 90, and longitude must be between -180 and 180.'));
        }

        if (zoom < 0 || zoom > 5) {
            throw new Error(_t('Panorama zoom level must be between 0 and 5.'));
        }

        if (Number.isFinite(pitch) && (pitch < -90 || pitch > 90)) {
            throw new Error(_t('Pitch must be between -90 and 90.'));
        }

        if (heading !== undefined && (heading < 0 || heading >= 360)) {
            throw new Error(_t('Heading must be between 0 (inclusive) and 360 (exclusive).'));
        }
    }
}
