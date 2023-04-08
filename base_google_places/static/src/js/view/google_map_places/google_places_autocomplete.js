/** @odoo-module **/

import { Component, useRef, onRendered, useState } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { GooglePlacesResult } from './google_places_result';

export class GooglePlacesAutocompleteSidebar extends Component {
    setup() {
        this.searchBoxRef = useRef('searchBox');
        this.searchResultRef = useRef('searchResultBox');
        this.notification = useService('notification');

        this.state = useState({ places: [] });
        this.placesResult = [];
        this.markerInfoWindow = null;
        this.placeService = null;
        onRendered(this.onRendered);
    }

    onRendered() {
        if (!this.props.isComponentFolded) {
            if (!this.placeAutocomplete) {
                this.placeAutocomplete = new google.maps.places.SearchBox(
                    this.searchBoxRef.el.querySelector('input#searchinputbox'),
                    {
                        fields: [
                            'formatted_address',
                            'geometry',
                            'name',
                            'photos',
                            'place_id',
                            'scope',
                            'type',
                            'user_rating_total',
                            'rating',
                            'business_status',
                        ],
                    }
                );
            }

            if (!this.placeService) {
                this.placeService = new google.maps.places.PlacesService(
                    this.props.googleMap,
                    {
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
                    }
                );
            }

            this.markerInfoWindow = new google.maps.InfoWindow({ content: '' });

            if (!this.listenerPlaceChanged) {
                this.listenerPlaceChanged = this.placeAutocomplete.addListener(
                    'places_changed',
                    this.onPlacesChanged.bind(this)
                );
            }
        }
    }

    onPlacesChanged() {
        const places = this.placeAutocomplete.getPlaces();
        this._cleanPlacesResult();
        if (places) {
            this.placeAutocomplete.bindTo('bounds', this.props.googleMap);
            const bounds = new google.maps.LatLngBounds();
            places.forEach((place) => this.handlePlace(bounds, place));
            this.props.googleMap.fitBounds(bounds);
            this.state.places = [...this.placesResult];
        } else {
            this.notification.add(this.env._t('No places is found'), {
                type: 'warning',
            });
        }
    }

    handlePlace(bounds, place) {
        if (place.geometry || place.geometry.location) {
            const markerOption = {
                map: this.props.googleMap,
                draggable: false,
                animation: google.maps.Animation.DROP,
                position: place.geometry.location,
            };
            if (place.icon) {
                markerOption.icon = {
                    url: place.icon,
                    size: new google.maps.Size(71, 71),
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point(17, 34),
                    scaledSize: new google.maps.Size(25, 25),
                };
            }
            const marker = new google.maps.Marker(markerOption);
            place._marker = marker;
            this.placesResult.push(place);
            if (place.geometry.viewport) {
                bounds.union(place.geometry.viewport);
            } else {
                bounds.union(place.geometry.location);
            }
        }
    }

    _cleanPlacesResult() {
        if (this.placesResult.length) {
            this.placesResult.forEach((place) => {
                place._marker.setMap(null);
            });
            this.placesResult.splice(0);
        }
    }
}

GooglePlacesAutocompleteSidebar.template =
    'base_google_places.SidebarPlacesAutocomplete';
GooglePlacesAutocompleteSidebar.components = { GooglePlacesResult };
GooglePlacesAutocompleteSidebar.props = [
    'loader',
    'settings',
    'isComponentFolded',
    'googleMap',
];
