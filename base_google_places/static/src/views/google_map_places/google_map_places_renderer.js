/** @odoo-module **/

import { useState, useChildSubEnv } from '@odoo/owl';
import { GooglePlacesAutocompleteSidebar } from './google_places_autocomplete';

import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';

export class GoogleMapPlacesRenderer extends GoogleMapRenderer {
    setup() {
        super.setup();
        this.state = useState({
            ...this.state,
            sidebarPlacesIsFolded: true,
        });

        this.placeService = null;

        useChildSubEnv({
            model: this.props.list.model,
            fields: this.props.list.fields,
        });
    }

    togglePlacesSidebar() {
        this.state.sidebarPlacesIsFolded = !this.state.sidebarPlacesIsFolded;
    }

    initialize() {
        super.initialize();
        if (!this.placeService && this.googleMap) {
            this.placeService = new google.maps.places.PlacesService(this.googleMap, {
                fields: [
                    'business_status',
                    'formatted_address',
                    'geometry',
                    'icon',
                    'name',
                    'photos',
                    'place_id',
                    'plus_code',
                    'type',
                    'rating',
                    'vicinity',
                    'user_ratings_total',
                    'url',
                ],
            });
        }
    }
}

GoogleMapPlacesRenderer.template = 'base_google_places.GoogleMapRenderer';
GoogleMapPlacesRenderer.components = {
    ...GoogleMapRenderer.components,
    GooglePlacesAutocompleteSidebar,
};
