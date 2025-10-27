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
import { MapConfig } from '../../utils/map_config';


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
        if (this.props.mapTypeId && google.maps.MapTypeId[this.props.mapTypeId.toUpperCase()]) {
            values.mapTypeId = google.maps.MapTypeId[this.props.mapTypeId.toUpperCase()];
        }
        if (this.props.defaultCenter && this.props.defaultCenter.length === 2) {
            values.center = {
                lat: parseFloat(this.props.defaultCenter[0]),
                lng: parseFloat(this.props.defaultCenter[1]),
            };
        }
        if (this.props.defaultZoom) {
            values.zoom = this.props.defaultZoom;
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

    /**
     * @override
     * @returns {google.maps.MapOptions} Map options for Google Maps instance
     */
    getMapOptions() {
        return MapConfig.MAP_OPTIONS;
    }

    /**
     * Determine rendering mode based on feature support
     * Terra Draw doesn't support polygons with holes (interior rings), use DeckGL for those
     */
    determineRenderingMode(geojson) {
        const geoJson = typeof geojson === 'undefined' ? this.geoJson : geojson;

        if (!geoJson?.features?.length) {
            this.state.renderingMode = 'terra-draw';
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

        this.state.renderingMode = hasPolygonsWithHoles ? 'deckgl' : 'terra-draw';
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
