/** @odoo-module **/

import { Component, onRendered } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';

import { GooglePlacesItem } from './google_places_item';

export class GooglePlacesResult extends Component {
    setup() {
        this.notification = useService('notification');
        onRendered(() => this.handleOnRendered());
    }

    handleOnRendered() {
        if (this.props.places) {
            this.props.places.forEach((place) => {
                google.maps.event.addListener(
                    place._marker,
                    'click',
                    this.handleMarkerPlaceClick.bind(this, place)
                );
            });
        }
    }

    handleMarkerPlaceClick(place) {
        const { googleMap, markerInfoWindow } = this.props;
        const displayAddress = place.vicinity || place.formatted_address;
        const content = new DOMParser()
            .parseFromString(
                '<div><div style="font-weight:400;width:350px;font-size:14px;"><h5>' +
                    place.name +
                    '</h5><p>' +
                    displayAddress +
                    '</p><button role="button" class="btn btn-sm btn-primary" id="add-place" tabindex="-1"><i class="fa fa-plus-circle"></i><span> ' +
                    this.env._t('Add') +
                    '</span></button></div></div>',
                'text/html'
            )
            .querySelector('div');

        content.querySelector('#add-place').addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this.props.handleClickItemAdd(place);
        });

        markerInfoWindow.setOptions({
            content: content,
            pixelOffset: new google.maps.Size(-25, 0),
        });
        markerInfoWindow.open(googleMap, place._marker);
    }

    /**
     * Pin point place in map
     * @param {Object} place
     */
    handleClickItem(place) {
        const { googleMap, markerInfoWindow } = this.props;
        if (place && googleMap && markerInfoWindow) {
            googleMap.panTo(place.geometry.location);
            google.maps.event.addListenerOnce(googleMap, 'idle', () => {
                google.maps.event.trigger(googleMap, 'resize');
                if (googleMap.getZoom() < 16) googleMap.setZoom(16);
            });
            this.handleMarkerPlaceClick(place);
        }
    }

    get isEmpty() {
        return this.props.places.length <= 0;
    }
}

GooglePlacesResult.template = 'base_google_places.PlacesResult';
GooglePlacesResult.components = { GooglePlacesItem };
GooglePlacesResult.props = [
    'places',
    'googleMap',
    'markerInfoWindow',
    'centerMapToCurrentSearchResult',
    'actionPageNext',
    'searchHasNext',
    'actionShowPlace',
    'actionAddPlace',
    'handleAfterAction',
    'addPlace',
    'handleClickItemAdd',
];
