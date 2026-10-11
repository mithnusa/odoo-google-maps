import { registry } from '@web/core/registry';
import {
    GoogleMapTerraDrawField,
    googleMapTerraDrawField,
} from '@web_view_google_map_drawing/widget/terra_draw/terra_draw';
import { loadDeckGlAssets } from '@web_view_google_map_drawing/utils/utils';
import { hexToRgba } from '@web_view_google_map/views/google_map/utils';
import { DECKGL_CONFIG } from '@web_view_google_map_drawing/utils/map_config';

const PROJECT_GEOJSON_FIELD = 'project_geojson';
const PROJECT_COLOR = '#ff6a00';

/**
 * Task-specific Terra Draw field that shows the parent project's boundary as a
 * static, non-interactive backdrop so users can see where the project area is
 * while drawing the task's own shape on top of (or around) it.
 *
 * The backdrop lives in its own Deck.gl overlay, independent of whichever
 * editor (Terra Draw or Deck.gl) is active for the task's own geojson field —
 * it never participates in editing, selection, or undo/redo.
 */
export class GoogleMapTerraDrawProjectTaskField extends GoogleMapTerraDrawField {
    setup() {
        super.setup();
        this.projectBoundaryOverlay = null;
    }

    get projectGeoJson() {
        const value = this.props.record.data[PROJECT_GEOJSON_FIELD];
        if (!value) return null;
        try {
            return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
            console.error('Invalid project boundary GeoJSON data:', error);
            return null;
        }
    }

    /**
     * @override
     */
    async onMapReady(map) {
        await super.onMapReady(map);
        await loadDeckGlAssets();
        this._renderProjectBoundary();

        // No task shape drawn yet — focus the map on the project's area so the
        // user can see where to draw instead of landing on the world view.
        if (!this.geoJson?.features?.length) {
            this._fitBoundsToProjectBoundary();
        }
    }

    /**
     * Render the project's boundary as a static Deck.gl backdrop, underneath
     * whichever editor (Terra Draw or Deck.gl) renders the task's own shape.
     * The outline is dotted so it reads as a reference area, not a drawable shape.
     * @private
     */
    _renderProjectBoundary() {
        const geoJson = this.projectGeoJson;
        if (!window.deck || !this.googleMap || !geoJson?.features?.length) return;

        if (!this.projectBoundaryOverlay) {
            this.projectBoundaryOverlay = new window.deck.GoogleMapsOverlay({ interleaved: false, layers: [] });
            this.projectBoundaryOverlay.setMap(this.googleMap);
        }

        const fillColor = hexToRgba(PROJECT_COLOR, 0.12, DECKGL_CONFIG.DEFAULT_COLORS.FILL);
        const strokeColor = hexToRgba(PROJECT_COLOR, 0.9, DECKGL_CONFIG.DEFAULT_COLORS.STROKE);

        const polygonData = geoJson.features.filter((f) => ['Polygon', 'MultiPolygon'].includes(f.geometry.type));
        const lineData = geoJson.features.filter((f) => ['LineString', 'MultiLineString'].includes(f.geometry.type));

        const dottedLineProps = {
            extensions: [new window.deck.PathStyleExtension({ dash: true })],
            getDashArray: [1, 3],
            dashJustified: true,
            capRounded: true,
        };

        this.projectBoundaryOverlay.setProps({
            layers: [
                new window.deck.GeoJsonLayer({
                    id: 'projectBoundaryPolygonsLayer',
                    data: polygonData,
                    filled: true,
                    stroked: true,
                    wrapLongitude: true,
                    getFillColor: fillColor,
                    getLineColor: strokeColor,
                    getLineWidth: 2,
                    lineWidthUnits: 'pixels',
                    lineWidthMinPixels: 2,
                    lineWidthMaxPixels: 3,
                    pickable: false,
                    ...dottedLineProps,
                }),
                new window.deck.GeoJsonLayer({
                    id: 'projectBoundaryLinesLayer',
                    data: lineData,
                    filled: false,
                    stroked: true,
                    wrapLongitude: true,
                    getLineColor: strokeColor,
                    getLineWidth: 2,
                    lineWidthUnits: 'pixels',
                    lineWidthMinPixels: 2,
                    lineWidthMaxPixels: 3,
                    pickable: false,
                    ...dottedLineProps,
                }),
            ],
        });
    }

    /**
     * Fit the map bounds to the project's boundary geojson.
     * @private
     */
    async _fitBoundsToProjectBoundary() {
        const geoJson = this.projectGeoJson;
        if (!geoJson?.features?.length) return;

        const { LatLngBounds } = await this.apiLoader.importLibrary('core');
        const bounds = new LatLngBounds();
        for (const feature of geoJson.features) {
            this._extendBoundsWithGeometry(bounds, feature.geometry);
        }

        if (this.googleMap && !bounds.isEmpty()) {
            this.googleMap.fitBounds(bounds);
        }
    }

    /**
     * Extend a LatLngBounds instance with every coordinate of a GeoJSON geometry.
     * @param {google.maps.LatLngBounds} bounds
     * @param {Object} geometry - GeoJSON geometry object
     * @private
     */
    _extendBoundsWithGeometry(bounds, geometry) {
        if (!geometry?.coordinates) return;

        const extend = (coord) => bounds.extend({ lat: coord[1], lng: coord[0] });
        const { type, coordinates } = geometry;

        switch (type) {
            case 'Point':
                extend(coordinates);
                break;
            case 'LineString':
            case 'MultiPoint':
                coordinates.forEach(extend);
                break;
            case 'Polygon':
            case 'MultiLineString':
                coordinates.forEach((ring) => ring.forEach(extend));
                break;
            case 'MultiPolygon':
                coordinates.forEach((polygon) => polygon.forEach((ring) => ring.forEach(extend)));
                break;
        }
    }

    /**
     * @override
     */
    _cleanUp() {
        if (this.projectBoundaryOverlay) {
            try {
                this.projectBoundaryOverlay.setProps({ layers: [] });
                this.projectBoundaryOverlay.setMap(null);
                this.projectBoundaryOverlay.finalize();
            } catch (error) {
                console.warn('Error during project boundary overlay cleanup:', error);
            } finally {
                this.projectBoundaryOverlay = null;
            }
        }
        super._cleanUp();
    }
}

export const googleMapTerraDrawProjectTaskField = {
    ...googleMapTerraDrawField,
    component: GoogleMapTerraDrawProjectTaskField,
};

registry.category('fields').add('google_map_terra_draw_project_task', googleMapTerraDrawProjectTaskField);
