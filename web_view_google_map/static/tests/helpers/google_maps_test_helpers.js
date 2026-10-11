// web_view_google_map/static/tests/helpers/google_maps_test_helpers.js
//
// Shared fakes for the one boundary that actually matters when testing any
// *_google_map view: the external google.maps library. Everything else
// (settings RPC, loader hook, map bootstrap in base_google_map.js) runs
// unmodified — real production code, not a bypass — because
// GoogleMapsAPILoader treats a pre-existing window.google.maps.importLibrary
// as "already loaded" and skips both the network settings fetch's
// script-injection path and any script tag.
//
// Used by web_view_google_map's own tests and reused (imported via
// @web_view_google_map/../tests/helpers/google_maps_test_helpers) by
// dependent modules — e.g. web_view_google_map_drawing — instead of
// duplicating this harness.

import { onRpc, patchWithCleanup } from '@web/../tests/web_test_helpers';

// A real google.maps.Map exposes `controls` as an array of MVCArray-like
// collections, one per ControlPosition, that widgets push their DOM
// elements (geolocate button, search box, ...) into on mount and remove
// from on cleanup via getArray()/removeAt().
export class FakeMVCArray extends Array {
    getArray() {
        return this;
    }
    removeAt(index) {
        this.splice(index, 1);
    }
}

export class FakeLatLngBounds {
    extend() {
        return this;
    }
    isEmpty() {
        return true;
    }
}

export class FakeMap {
    constructor(el, options) {
        this.el = el;
        this.options = options;
        this._tilt = 0;
        this.controls = new Proxy(
            {},
            {
                get: (target, key) => {
                    if (!(key in target)) {
                        target[key] = new FakeMVCArray();
                    }
                    return target[key];
                },
            }
        );
    }
    getDiv() {
        // AdvancedMarkerBoxSelector attaches its selection-box overlay here.
        return this.el;
    }
    getTilt() {
        return this._tilt;
    }
    setTilt(tilt) {
        this._tilt = tilt;
    }
    getBounds() {
        return new FakeLatLngBounds();
    }
    getZoom() {
        return this._zoom ?? 8;
    }
    setZoom(zoom) {
        this._zoom = zoom;
    }
    setCenter() {}
    panTo() {}
    fitBounds() {}
    setOptions() {}
    addListener() {
        return { remove() {} };
    }
}

export class FakeAdvancedMarkerElement {
    constructor(options = {}) {
        Object.assign(this, options);
        this._listeners = {};
    }
    addListener(eventName, cb) {
        this._listeners[eventName] = cb;
        return {
            remove: () => {
                delete this._listeners[eventName];
            },
        };
    }
    // Test helper — no real 'gmp-click' DOM event to dispatch against a fake
    // marker, so tests trigger the captured handler directly instead.
    fireClick() {
        this._listeners['gmp-click']?.();
    }
}

export class FakePinElement {
    constructor(options = {}) {
        Object.assign(this, options);
        this.element = document.createElement('div');
    }
}

export class FakeInfoWindow {
    constructor() {
        this.openCallCount = 0;
        this._content = null;
    }
    open() {
        this.openCallCount++;
    }
    close() {}
    getContent() {
        return this._content;
    }
    setContent(content) {
        this._content = content;
    }
    addListener() {
        return { remove() {} };
    }
}

export class FakePolyline {
    setMap() {}
}

export class FakeRectangle {
    setMap() {}
    setBounds() {}
}

export class FakeLatLng {
    constructor(lat, lng) {
        this.lat = () => lat;
        this.lng = () => lng;
    }
}

export const FAKE_GOOGLE_MAPS = {
    async importLibrary(name) {
        switch (name) {
            case 'maps':
                // Most callers read the bare google.maps.InfoWindow property
                // (below), but GoogleMapDeckGLRenderer.onMapReady destructures
                // it from importLibrary('maps') instead — both paths need it.
                return { Map: FakeMap, InfoWindow: FakeInfoWindow };
            case 'core':
                return {
                    ColorScheme: { LIGHT: 'LIGHT', DARK: 'DARK', FOLLOW_SYSTEM: 'FOLLOW_SYSTEM' },
                    LatLngBounds: FakeLatLngBounds,
                };
            case 'marker':
                return { AdvancedMarkerElement: FakeAdvancedMarkerElement, PinElement: FakePinElement };
            default:
                return {};
        }
    },
    event: {
        // onMapReady() awaits this exact call for the 'tilesloaded' event
        // before flipping state.isMapReady — fire it on the next microtask.
        addListenerOnce(target, eventName, cb) {
            if (eventName === 'tilesloaded') {
                Promise.resolve().then(cb);
            }
            return { remove() {} };
        },
        addListener() {
            return { remove() {} };
        },
        clearInstanceListeners() {},
        clearListeners() {},
        trigger() {},
        removeListener() {},
    },
    // All of the below are read directly as bare google.maps.X properties
    // throughout google_map_renderer.js / utils.js — not fetched through
    // importLibrary(), so they must be present up front rather than
    // resolved lazily. Covers the constructors/enums this view's initial
    // mount and marker rendering path touches.
    MapTypeId: { ROADMAP: 'ROADMAP', SATELLITE: 'SATELLITE', HYBRID: 'HYBRID', TERRAIN: 'TERRAIN' },
    ControlPosition: { RIGHT_BOTTOM: 'RIGHT_BOTTOM', TOP_RIGHT: 'TOP_RIGHT' },
    SymbolPath: { CIRCLE: 'CIRCLE' },
    InfoWindow: FakeInfoWindow,
    Polyline: FakePolyline,
    Rectangle: FakeRectangle,
    LatLng: FakeLatLng,
    LatLngBounds: FakeLatLngBounds,
};

/**
 * Mocks the /web/base_google_map/settings RPC and pre-seeds
 * window.google.maps so GoogleMapsAPILoader takes its "already loaded"
 * fast path. Call from a beforeEach() in any test that mounts a
 * *_google_map view.
 */
export function mockGoogleMapsApi() {
    onRpc('/web/base_google_map/settings', () => ({
        // validateParams() requires a string of at least 30 characters.
        api_key: 'test-api-key-0123456789012345678901234567890',
        map_id: 'test-map-id',
        version: 'beta',
        region: 'US',
        language: 'en',
    }));

    patchWithCleanup(window, { google: { maps: FAKE_GOOGLE_MAPS } });
}

/**
 * Polls a predicate until it's true. Needed anywhere marker/shape creation
 * is involved: it's batched behind a real requestIdleCallback and/or a
 * debounce, and fake markers/shapes never touch the real DOM, so there's
 * nothing for hoot-dom's waitFor() to poll — wait on the renderer's own
 * state instead of guessing a fixed number of animation frames.
 */
export async function waitUntil(predicate, { timeout = 2000, interval = 20 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) {
            throw new Error('waitUntil: condition not met within timeout');
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}
