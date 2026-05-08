import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { sprintf } from '@web/core/utils/strings';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import {
    useRef,
    useSubEnv,
    useState,
    onWillUpdateProps,
} from '@odoo/owl';

import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';

import { TerraDrawToolsUI } from '../../views/components/terra-tools-ui/terra-tools-ui';
import { DeckGlEditor } from '../../views/components/deck-gl-editor/deck-gl-editor';
import { MAP_OPTIONS } from '../../utils/map_config';
import { analyzeDatasetPerformance } from '../../utils/geometry_performance_utils';


export class GoogleMapTerraDrawField extends BaseGoogleMapComponent {
    static template = 'web_view_google_map_drawing.GoogleMapTerraDrawField';
    static components = {
        Geolocate: GoogleMapGeolocate,
        InMapSearchPlaces: GoogleMapSearchPlaces,
        TerraDrawToolsUI,
        DeckGlEditor,
    };
    static defaultProps = {
        dynamicPlaceholder: false,
        shouldTrim: true,
    };
    static props = {
        ...standardFieldProps,
        placeholder: { type: String, optional: true },
        dynamicPlaceholder: { type: Boolean, optional: true },
        defaultCenter: { type: Array, optional: true },
        defaultZoom: { type: Number, optional: true },
        mapTypeId: { type: String, optional: true },
        fieldArea: { type: String, optional: true },
    };

    setup() {
        super.setup();
        this.validateProps();

        this.mapRef = useRef('map');
        this.googleMapBounds = null;

        this.state = useState({
            ...this.state,
            sidebarIsFolded: false,
            renderingMode: 'terra-draw',
        });

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        onWillUpdateProps((nextProps) => {
            this.determineRenderingMode(nextProps.record.data[nextProps.name] || {});
        });
    }

    /**
     * @override
     */
    mapDivElement() {
        return this.mapRef.el;
    }

    /**
     * @override
     */
    _prepareMapOptions(options) {
        const values = super._prepareMapOptions(options);
        const mapTypeId = this.props.mapTypeId ? google.maps.MapTypeId[this.props.mapTypeId.toUpperCase()] : null;
        if (mapTypeId) {
            values.mapTypeId = mapTypeId;
        }
        if (this.props.defaultCenter && this.props.defaultCenter.length === 2) {
            const lat = parseFloat(this.props.defaultCenter[0]);
            const lng = parseFloat(this.props.defaultCenter[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                console.warn('Invalid defaultCenter coordinates, must be numbers.');
            } else {
                values.center = { lat, lng };
            }
        }
        const defaultZoom = this.props.defaultZoom ? parseInt(this.props.defaultZoom) : null;
        if (defaultZoom && !isNaN(defaultZoom)) {
            values.zoom = defaultZoom;
        }
        values.clickableIcons = false;
        return values;
    }

    /**
     * @override
     */
    async onMapReady(map) {
        await super.onMapReady(map);
        if (!this.googleMapBounds) {
            const { LatLngBounds } = await this.apiLoader.importLibrary('core');
            this.googleMapBounds = new LatLngBounds();
        }
        this.determineRenderingMode();
    }

    get geoJson() {
        const value = this.props.record.data[this.props.name];
        if (!value) return {};

        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;

            // Determine rendering mode if map is ready
            if (parsed?.features?.length > 0 && this.state.isMapReady) {
                this.determineRenderingMode(parsed);
            }

            return parsed;
        } catch (error) {
            console.error('Invalid GeoJSON data:', error);
            return {};
        }
    }

    async handleSave(features, totalArea) {
        if (features) {
            try {
                const values = { [this.props.name]: features };
                if (this.props.fieldArea && this.props.record.fields[this.props.fieldArea] !== undefined) {
                    values[this.props.fieldArea] = totalArea;
                }
                await this.props.record.update(values);
            } catch (error) {
                console.error('Failed to save shape changes:', error);
                this.notificationService.add(_t('Failed to save shape changes'), { type: 'danger' });
            }
        }
    }

    async handleSaveFeatureTotalArea(totalArea) {
        if (this.props.fieldArea && this.props.record.fields[this.props.fieldArea] !== undefined) {
            try {
                await this.props.record.update({ [this.props.fieldArea]: totalArea });
            } catch {
                this.notificationService.add(_t('Failed to save area calculation'), { type: 'danger' });
            }
        }
    }

    /**
     * @override
     * @returns {google.maps.MapOptions} Map options for Google Maps instance
     */
    getMapOptions() {
        return MAP_OPTIONS;
    }

    /**
     * Determine rendering mode based on feature support and performance
     * Terra Draw doesn't support:
     * - Polygons with holes (interior rings)
     * - 3D coordinates (coordinates with altitude)
     * - Large datasets (3000+ features, 5000+ vertices, 5000+ points)
     * Use DeckGL for those cases
     * @param {Object} [geojson] - Optional GeoJSON object to analyze. If not provided, uses this.geoJson
     */
    determineRenderingMode(geojson) {
        const geoJson = typeof geojson === 'undefined' ? this.geoJson : geojson;

        if (!geoJson?.features?.length) {
            this.state.renderingMode = 'terra-draw';
            return;
        }

        // Check dataset size limits first (most common performance issue)
        const datasetAnalysis = analyzeDatasetPerformance(geoJson.features);
        if (datasetAnalysis.shouldUseDeckGL) {
            console.warn(`Large dataset detected, switching to DeckGL: ${datasetAnalysis.reason}`);
            this.state.renderingMode = 'deckgl';
            return;
        }

        // Check if any feature has holes (interior rings)
        const hasPolygonsWithHoles = geoJson.features.some((feature) => {
            if (feature.geometry.type === 'Polygon') {
                return feature.geometry.coordinates.length > 1;
            } else if (feature.geometry.type === 'MultiPolygon') {
                return feature.geometry.coordinates.some(polygon => polygon.length > 1);
            }
            return false;
        });

        // Check if any feature has 3D coordinates (altitude/elevation)
        const has3DCoordinates = geoJson.features.some((feature) => {
            return this._hasAltitude(feature.geometry);
        });

        this.state.renderingMode = (hasPolygonsWithHoles || has3DCoordinates) ? 'deckgl' : 'terra-draw';
    }

    /**
     * Check if geometry contains 3D coordinates (with altitude)
     * @param {Object} geometry - GeoJSON geometry object
     * @returns {boolean} - True if any coordinate has altitude
     * @private
     */
    _hasAltitude(geometry) {
        if (!geometry || !geometry.coordinates) {
            return false;
        }

        const checkCoordinate = (coord) => {
            // A coordinate with altitude has 3 or more values [lng, lat, alt, ...]
            if (Array.isArray(coord) && typeof coord[0] === 'number') {
                return coord.length > 2;
            }
            // Recursively check nested arrays
            if (Array.isArray(coord)) {
                return coord.some(checkCoordinate);
            }
            return false;
        };

        return checkCoordinate(geometry.coordinates);
    }

    validateProps() {
        if (this.props.fieldsArea && this.props.record.fields[this.props.fieldsArea] === undefined) {
            this.notificationService.add(
                sprintf(_t('The field area "%s" does not exist on the model "%s". Please check the field configuration.'), this.props.fieldsArea, this.props.record.model),
                { type: 'warning'}
            );
        }
    }

}

export const googleMapTerraDrawField = {
    component: GoogleMapTerraDrawField,
    displayName: _t('Google Maps Terra Draw'),
    supportedTypes: ['json'],
    extractProps: ({ attrs, options }) => ({
        placeholder: attrs.placeholder,
        dynamicPlaceholder: options?.dynamic_placeholder || false,
        defaultCenter: options?.default_center || undefined,
        defaultZoom: options?.default_zoom || 5,
        mapTypeId: options?.map_type_id || 'hybrid',
        fieldArea: options?.field_area || undefined,
    }),
};

registry.category('fields').add('google_map_terra_draw', googleMapTerraDrawField);
