import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import {
    useRef,
    useSubEnv,
    useState,
    onWillStart,
} from '@odoo/owl';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { loadJS } from '@web/core/assets';

import { BaseGoogleMapComponent } from '@base_google_map/utils/base_google_map';
import { GoogleMapGeolocate } from '@web_view_google_map/views/google_map/components/geolocate/geolocate';
import { GoogleMapSearchPlaces } from '@web_view_google_map/views/google_map/components/search_places/search_places';

import { DeckGlEditor } from '../../views/components/deck-gl-editor/deck-gl-editor';
import { MapConfig } from '../../utils/map_config';


export class DeckGlField extends BaseGoogleMapComponent {
    static template = 'web_view_google_map_drawing.DeckGlField';
    static components = {
        Geolocate: GoogleMapGeolocate,
        InMapSearchPlaces: GoogleMapSearchPlaces,
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
        options: { type: Object, optional: true },
    };

    setup() {
        super.setup();
        this.mapRef = useRef('map');
        this.googleMapBounds = null;

        this.state = useState({
            ...this.state,
            sidebarIsFolded: false,
        });

        onWillStart(() => {
            this._loadDeckGLAndNebulaGlAssets();
        });

        useSubEnv({
            apiLoader: this.apiLoader,
            isMapLoaded: this.isMapLoaded.bind(this),
        });

        // Setup lifecycle hooks
        // onRendered(this._handleRendered);
    }

    _handleRendered() {
        if (this.isMapLoaded()) {
            this.renderMap();
        }
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
        options.mapTypeId = google.maps.MapTypeId.HYBRID;
        return options;
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
    }

    renderMap() {
        if (!this.isMapLoaded()) return;
        // this._loadExistingShape();
    }

    /**
     * Load Deck.gl and Nebula GL assets and dependencies
     * @private
     */
    async _loadDeckGLAndNebulaGlAssets() {
        if (window.deck) {
            return;
        }

        try {
            // Load Deck.gl core and Google Maps integration
            await loadJS('/web_view_google_map_drawing/static/src/libs/deck-gl/9.1.14/dist.min.js');

            if (!window.deck) {
                throw new Error('Deck.gl failed to load correctly.');
            }
        } catch (error) {
            console.error('Error loading Deck.gl and Nebula GL assets:', error);
            throw new Error('Failed to load Deck.gl and Nebula GL assets: ' + error.message);
        }
    }

    get geoJson() {
        const value = this.props.record.data[this.props.name];
        if (!value) return {};
        try {
            return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (error) {
            console.error('Invalid GeoJSON data:', error);
            return {};
        }
    }

    async handleSave(features) {
        if (features) {
            try {
                await this.props.record.update({[this.props.name]: features});
                // Add notification for successful save
                this.notificationService.add(_t('Shape changes saved successfully'), {
                    type: 'success',
                    title: _t('Success'),
                });
            } catch (error) {
                console.error('Failed to save shape changes:', error);
                this.notificationService.add(_t('Failed to save shape changes'), {
                    type: 'danger',
                    title: _t('Error'),
                });
            }
        }
    }

    getMapOptions() {
        return MapConfig.MAP_OPTIONS;
    }
}

export const deckGlField = {
    component: DeckGlField,
    displayName: _t('Deck GL Editor'),
    supportedTypes: ['json'],
    extractProps: ({ attrs, options }) => ({
        placeholder: attrs.placeholder,
        dynamicPlaceholder: options?.dynamic_placeholder || false,
        options,
    }),
};

registry.category('fields').add('deckgl_editor', deckGlField);
