import { _t } from '@web/core/l10n/translation';
import { Component, onRendered } from '@odoo/owl';

import { GooglePlacesItem } from './google_places_item';

export class GooglePlacesResult extends Component {
    static template = 'base_google_places.PlacesResult';
    static components = { GooglePlacesItem };
    static props = [
        'places',
        'googleMap',
        'markerInfoWindow',
        'centerMapToCurrentSearchResult',
        'actionPageNext',
        'searchHasNext',
        'actionAddPlace',
        'handleAfterAction',
        'addPlace',
        'handleClickItemAdd',
    ];

    setup() {
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
                '<div class="infoWindow p-3"><div style="font-weight:400;width:350px;font-size:14px;"><h5>' +
                    place.name +
                    '</h5><p>' +
                    displayAddress +
                    '</p><button role="button" class="btn btn-sm btn-primary" id="add-place" tabindex="-1"><i class="fa fa-plus-circle"></i><span> ' +
                    _t('Add') +
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
