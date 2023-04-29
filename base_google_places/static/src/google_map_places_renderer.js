odoo.define('base_google_places.WidgetSearchAutocomplete', function (require) {
    'use strict';

    const core = require('web.core');
    const Widget = require('web.Widget');

    const QWeb = core.qweb;
    const _t = core._t;

    const WidgetSearchAutocomplete = Widget.extend({
        init: function (parent) {
            this._super(parent);
            this.parent = parent;
            this.placeAutocomplete = false;
            this.markerPlace = false;
            this.quickCreateEnabled = this.parent.quickCreateEnabled || false;
            this.autocomplete_settings = null;
            this.places_result = [];
            this.action_update_search = false;
            this.has_searched = false;
            this.placeService = false;
            this.markerInfoWindow = false;
            this.funcGetNextPage = null;
            this.searchHasNext = false;
        },
        _getAutocompleteSettings: function () {
            return this._rpc({
                route: '/web/google_autocomplete_conf',
            });
        },
        /**
         * @override
         */
        start: function () {
            return this._super.apply(this, arguments).then(this._initialize.bind(this));
        },
        /**
         * Initialize place autocomplete
         */
        _initialize: function () {
            // Initialize place autocomplete
            if (!this.placeAutocomplete) {
                this.placeAutocomplete = new google.maps.places.SearchBox(
                    this.parent.$('input#searchinputbox').get(0),
                    {
                        fields: [
                            'formatted_address',
                            'address_components',
                            'geometry',
                            'name',
                            'opening_hours',
                            'photos',
                            'place_id',
                            'plus_code',
                            'scope',
                            'type',
                            'website',
                            'url',
                            'user_rating_total',
                            'rating',
                        ],
                    }
                );
            }
            if (!this.placeService) {
                this.placeService = new google.maps.places.PlacesService(
                    this.parent.gmap,
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
            if (!this.markerInfoWindow) {
                this.markerInfoWindow = new google.maps.InfoWindow({
                    content: '',
                });
            }
            this.placeAutocomplete.setBounds(this.parent.gmap.getBounds());
            this.listenerBoundChanged = this.parent.gmap.addListener(
                'bounds_changed',
                () => {
                    this.placeAutocomplete.setBounds(this.parent.gmap.getBounds());
                }
            );
            this.listenerMapCenterChanged = this.parent.gmap.addListener(
                'center_changed',
                this._addActionUpdateSearch.bind(this)
            );
            this.listenerPlaceChanged = this.placeAutocomplete.addListener(
                'places_changed',
                this.onPlacesChanged.bind(this)
            );
        },
        _addActionUpdateSearch: function () {
            if (!this.action_update_search && this.has_searched) {
                this.action_update_search = $(
                    QWeb.render('GoogleMapView.SearchButtonUpdateBounds', {
                        widget: this,
                    })
                );
                this.parent.gmap.controls[google.maps.ControlPosition.TOP_CENTER].push(
                    this.action_update_search.get(0)
                );
                this.action_update_search
                    .find('#search')
                    .get(0)
                    .addEventListener('click', (ev) => {
                        ev.preventDefault();
                        const search_terms = this.parent
                            .$('input#searchinputbox')
                            .val()
                            .trim();
                        if (search_terms) {
                            const request = {
                                keyword: search_terms,
                                bounds: this.parent.gmap.getBounds(),
                                radius: 3000,
                            };
                            this.placeService.nearbySearch(
                                request,
                                (places, status, pagination) => {
                                    if (status !== 'OK' || !places) {
                                        this.displayNotification({
                                            title: 'Google places',
                                            message: _t('Search failed'),
                                            type: 'warning',
                                        });
                                        return;
                                    }
                                    this.placeAutocomplete.set('places', places);
                                    this.searchHasNext = pagination.hasNextPage;
                                    if (pagination && pagination.hasNextPage) {
                                        this.funcGetNextPage = function () {
                                            pagination.nextPage();
                                        };
                                    } else {
                                        this.funcGetNextPage = null;
                                    }
                                }
                            );
                        }
                    });
                this.action_update_search
                    .find('#clear')
                    .get(0)
                    .addEventListener('click', (ev) => {
                        ev.preventDefault();
                        this._resetPlacesResult();
                    });
            }
        },
        _resetPlacesResult: function () {
            this.action_update_search = null;
            this.has_searched = null;
            this._cleanPlacesResult();
            this.parent.gmap.controls[google.maps.ControlPosition.TOP_CENTER].pop();
            this.parent._map_center_geometry();
            google.maps.event.removeListener(this.listenerMapCenterChanged);
            this.parent
                .$('.o_map_left_sidenav')
                .toggleClass('closed')
                .toggleClass('opened');
            this.parent.$('.o_map_left_sidenav').find('input').val('');
        },
        _cleanPlacesResult: function () {
            this.parent.$('.sidenav-body').find('.search-result > #content').empty();
            if (this.places_result.length) {
                this.places_result.forEach((place) => {
                    place._marker.setMap(null);
                });
                this.places_result.splice(0);
            }
        },
        /**
         * Place autocomplete listener
         */
        onPlacesChanged: function () {
            const places = this.placeAutocomplete.getPlaces();
            this._resetActionSearchArea();
            this._cleanPlacesResult();
            if (places.length > 0) {
                places.forEach((place) => {
                    // None of the options is selected
                    if (place.geometry || place.geometry.location) {
                        this.places_result.push(place);
                    }
                });
                this._displayPlacesResult();
            }
        },
        /**
         * Handle the flag variable for action search current area
         * In order to re-appear the button after user clean the search
         */
        _resetActionSearchArea: function () {
            this.has_searched = true;
            if (!this.action_update_search) {
                this.action_update_search = null;
                this._addActionUpdateSearch();
            }
        },
        _displayPlacesResult: function () {
            if (!this.places_result) {
                return;
            }
            const bounds = new google.maps.LatLngBounds();
            this.places_result.forEach((place) => {
                const marker_options = {
                    map: this.parent.gmap,
                    draggable: false,
                    animation: google.maps.Animation.DROP,
                    position: place.geometry.location,
                };
                if (place.icon) {
                    marker_options.icon = {
                        url: place.icon,
                        size: new google.maps.Size(71, 71),
                        origin: new google.maps.Point(0, 0),
                        anchor: new google.maps.Point(17, 34),
                        scaledSize: new google.maps.Size(25, 25),
                    };
                }
                const marker = new google.maps.Marker(marker_options);
                place._marker = marker;
                if (place.geometry.viewport) {
                    // Only geocodes have viewport.
                    bounds.union(place.geometry.viewport);
                } else {
                    bounds.extend(place.geometry.location);
                }
            });
            this.parent.gmap.fitBounds(bounds);
            this._displayPlacesResultContent();
        },
        _displayPlacesResultContent: function () {
            const funcGetPhoto = function (photo, size) {
                if (photo && photo.length) {
                    if (!size) {
                        return photo[0].getUrl({ maxWidth: 60, maxHeight: 60 });
                    } else {
                        return photo[0].getUrl({ maxWidth: 400, maxHeight: 200 });
                    }
                }
                return false;
            };
            const places_total = this.places_result.length;
            const $pac = $(
                QWeb.render('GoogleMapView.SearchPlacesResult', {
                    widget: this,
                    places: this.places_result,
                    funcGetPhoto: funcGetPhoto,
                    places_total: places_total,
                })
            );
            $pac.on('click', '#place-item', (ev) => {
                const placeID = $(ev.currentTarget).data('placeid');
                const place = _.find(this.places_result, (p) => p.place_id === placeID);
                if (placeID && place) {
                    this.parent.gmap.panTo(place.geometry.location);
                    this.placeMarkerListenerCenter = google.maps.event.addListenerOnce(
                        this.parent.gmap,
                        'idle',
                        () => {
                            google.maps.event.trigger(this.parent.gmap, 'resize');
                            if (this.parent.gmap.getZoom() < 16)
                                this.parent.gmap.setZoom(16);
                        }
                    );
                    this.markerInfoWindow.setOptions({
                        content:
                            '<div style="font-weight:400;font-size:14px;">' +
                            place.name +
                            '</div>',
                        pixelOffset: new google.maps.Size(-25, 0),
                    });
                    this.markerInfoWindow.open(this.parent.gmap, place._marker);
                }
            });
            $pac.on('click', 'a#search-result-add', (ev) => {
                ev.preventDefault();
                const placeID = $(ev.currentTarget).data('placeid');
                if (placeID) {
                    this.parent._getPlaceDetails({ placeId: placeID });
                }
            });

            $pac.appendTo(
                this.parent.$('.sidenav-body').find('.search-result > #content')
            );

            setTimeout(() => {
                if (this.funcGetNextPage && this.searchHasNext) {
                    $pac.find('button#search-more').removeClass('o_hidden');
                    $pac.on('click', 'button#search-more', (ev) => {
                        ev.preventDefault();
                        this.funcGetNextPage();
                        $(ev.currentTarget)
                            .attr('disabled', true)
                            .text(_t('Loading..'));
                    });
                } else if (this.funcGetNextPage && !this.searchHasNext) {
                    $pac.find('button#search-more')
                        .removeClass('o_hidden')
                        .attr('disabled', true)
                        .text(_('No more results'));
                }
            }, 500);
        },
        destroy: function () {
            google.maps.event.removeListener(this.listenerBoundChanged);
            google.maps.event.removeListener(this.listenerPlaceChanged);
            google.maps.event.removeListener(this.listenerMapCenterChanged);
            google.maps.event.removeListener(this.placeMarkerListenerCenter);
            this._cleanPlacesResult();
            this._super();
        },
    });

    return WidgetSearchAutocomplete;
});