/** @odoo-module **/
import { Component, onWillStart } from '@odoo/owl';
import { _lt } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { MAP_THEMES } from './themes';

export class BaseGoogleMap extends Component {
    setup() {
        this.user = useService('user');
        this.rpc = useService('rpc');

        this.loader = null;
        this.settings = {};
        this.isPlacesSearchEnable = null;
        this.markerPlacesSearch = null;
        this.googleMap = null;
        this.placesAutocomplete = null;

        onWillStart(this._onWillStart);
    }

    async _onWillStart() {
        if (!this.loader) {
            const settings = await this._fetchSettings();
            this.settings = { ...settings };
            this.loader = new google.maps.plugins.loader.Loader({
                apiKey: settings.api_key,
                version: settings.version,
                libraries: settings.libraries,
            });
        }
    }

    async _fetchSettings() {
        const data = await this.rpc('/web/base_google_map/settings', {
            context: this.user.context,
        });
        return data;
    }

    setMapTheme() {
        const style = this.settings.theme || 'default';
        if (
            !Object.prototype.hasOwnProperty.call(MAP_THEMES, style) ||
            style === 'default'
        ) {
            return;
        }
        const styledMapType = new google.maps.StyledMapType(MAP_THEMES[style], {
            name: _lt('Custom'),
        });
        this.googleMap.setOptions({
            mapTypeControlOptions: {
                mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain', 'styled_map'],
            },
        });
        // Associate the styled map with the MapTypeId and set it to display.
        this.googleMap.mapTypes.set('styled_map', styledMapType);
        this.googleMap.setMapTypeId('styled_map');
    }

    renderGooglePlaceSearch(searchRef, markerInfoWindow) {
        if (this.settings.is_places_search_enable) {
            if (!this.markerPlacesSearch) {
                this.markerPlacesSearch = new google.maps.Marker({
                    map: this.googleMap,
                    anchorPoint: new google.maps.Point(0, -29),
                });
            } else {
                this.markerPlacesSearch.setVisible(false);
            }

            if (!this.placesAutocomplete) {
                this.placesAutocomplete = new google.maps.places.Autocomplete(
                    searchRef.el.querySelector('input#search'),
                    {
                        fields: ['geometry', 'formatted_address'],
                        types: ['establishment'],
                    }
                );
                this.placesAutocomplete.bindTo('bounds', this.googleMap);
                this.googleMap.controls[google.maps.ControlPosition.TOP_RIGHT].push(
                    searchRef.el
                );
                google.maps.event.addListener(
                    this.placesAutocomplete,
                    'place_changed',
                    this.handleSearchPlaceResult.bind(this, markerInfoWindow)
                );
            }
        }
    }

    handleSearchPlaceResult(markerInfoWindow) {
        const place = this.placesAutocomplete.getPlace();
        if (place) {
            if (place.geometry.hasOwnProperty('viewport') && place.geometry.viewport) {
                this.googleMap.fitBounds(place.geometry.viewport);
            } else {
                this.googleMap.panTo(place.geometry.location);
            }
            this.markerPlacesSearch.setPosition(place.geometry.location);
            this.markerPlacesSearch.setVisible(true);

            const para = document.createElement('p');
            const node = document.createTextNode(place.formatted_address);
            para.appendChild(node);

            const divContent = document.createElement('div');
            divContent.appendChild(para);

            markerInfoWindow.setContent(divContent);
            markerInfoWindow.open(this.googleMap, this.markerPlacesSearch);

            markerInfoWindow.addListener('closeclick', () => {
                this.markerPlacesSearch.setVisible(false);
            });
        }
    }

    handleSearchPlaceBounds() {
        if (this.placesAutocomplete) {
            this.placesAutocomplete.bindTo('bounds', this.googleMap);
        }
    }
}
