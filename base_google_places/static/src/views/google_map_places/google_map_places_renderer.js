import { useState, useChildSubEnv } from '@odoo/owl';
import { GooglePlacesAutocompleteSidebar } from './google_places_autocomplete';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';

export class GoogleMapPlacesRenderer extends GoogleMapRenderer {
    static template = 'base_google_places.GoogleMapRenderer';
    static components = {
        ...GoogleMapRenderer.components,
        GooglePlacesAutocompleteSidebar,
    };
    static props = {
        ...GoogleMapRenderer.props,
        createNewRecordFromPlaces: Function,
    };

    setup() {
        super.setup();

        this.state = useState({
            ...this.state,
            sidebarPlacesIsFolded: true,
        });
        this.placesService = null;

        useChildSubEnv({
            model: this.props.list.model,
            fields: this.props.list.fields,
            getPlacesService: this.getPlacesService.bind(this),
            openRecord: this.props.openRecord.bind(this),
            createNewRecordFromPlaces: this.props.createNewRecordFromPlaces.bind(this),
            showRecord: this.props.showRecord.bind(this),
            placeFields: this.placeFields,
        });
    }

    getPlacesService() {
        return this.placesService;
    }

    togglePlacesSidebar() {
        this._isSidebarAction = true;
        this.state.sidebarPlacesIsFolded = !this.state.sidebarPlacesIsFolded;
    }

    get placeFields() {
        // return [
        //     'name',
        //     'geometry',
        //     'formatted_address',
        //     'place_id',
        //     'icon',
        //     'plus_code',
        //     'type',
        //     'vicinity',
        //     'user_ratings_total',
        //     'url',
        //     'business_status',
        // ]
        return [
            'businessStatus',
            'formattedAddress',
            'addressComponents',
            'location',
            'displayName',
            'id',
            'plusCode',
            'types',
            'rating',
            'websiteURI',
            'userRatingCount',
        ]
    }

    /**
     * @override
     */
    // async onMapReady() {
    //     await super.onMapReady();
    //     if (!this.placesService) {
    //         const { Place } = await this.apiLoader.importLibrary("places");
    //         // this.placesService = new PlacesService(this.googleMap, {
    //         //     fields: [
    //         //         'name',
    //         //         'geometry',
    //         //         'formatted_address',
    //         //         'photos',
    //         //         'place_id',
    //         //         'icon',
    //         //         'plus_code',
    //         //         'type',
    //         //         'vicinity',
    //         //         'user_ratings_total',
    //         //         'url',
    //         //         'business_status',
    //         //     ],
    //         // });
    //     }
    // }
}
