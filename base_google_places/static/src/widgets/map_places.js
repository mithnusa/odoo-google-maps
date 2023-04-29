odoo.define('base_google_places.GoogleMapRenderer', function (require) {
    'use strict';

    const core = require('web.core');
    const session = require('web.session');
    const Dialog = require('web.Dialog');
    const viewRegistry = require('web.view_registry');
    const GoogleMapRenderer = require('web_google_maps.GoogleMapRenderer').GoogleMapRenderer;
    const GoogleMapController = require('web_google_maps.GoogleMapController');
    const GoogleMapView = require('web_google_maps.GoogleMapView');
    const GoogleMapModel = require('web_google_maps.GoogleMapModel');
    const Places = require('base_google_places.Places');
    const WidgetSearchAutocomplete = require('base_google_places.WidgetSearchAutocomplete');

    const QWeb = core.qweb;
    const _t = core._t;

    const GoogleMapModelSearchPlaces = GoogleMapModel.extend({
        googlePlaceQuickCreate: function (modelName, values, context) {
            context = _.extend({}, session.user_context, context);
            return this._rpc({
                model: modelName,
                method: 'action_google_place_quick_create',
                args: [values],
                kwargs: { context: context },
            });
        },
    });

    const GoogleMapControllerSearchPlaces = GoogleMapController.extend({
        custom_events: _.extend({}, GoogleMapController.prototype.custom_events, {
            google_place_quick_create: 'onGooglePlaceQuickCreate',
        }),
        onGooglePlaceQuickCreate: async function (ev) {
            const values = {
                place: ev.data.place,
            };
            const context = ev.data.context;
            const data = await Places.funcGetPlaceProperties(
                this.renderer.state.fields,
                ev.data.place
            );
            values['values'] = data;
            this.model.googlePlaceQuickCreate(this.modelName, values, context).then(() => {
                this.displayNotification({ title: 'Google places', message: _t('Place is created successfully'), type: 'success' });
                this.update({}, { reload: true });
            });
        },
    });

    const GoogleMapRendererSearchPlaces = GoogleMapRenderer.extend({
        template: 'GoogleMapView.MapViewSearchPlaces',
        events: _.extend({}, GoogleMapRenderer.prototype.events, {
            'click .toggle_left_sidenav': 'onToggleLeftSidenav',
        }),
        config: {
            WidgetSearchAutocomplete: WidgetSearchAutocomplete,
        },
        onToggleLeftSidenav: function () {
            this.$('.o_map_left_sidenav').toggleClass('closed').toggleClass('opened');
            this.$('.o_map_left_sidenav')
                .find('.toggle_left_sidenav > button')
                .toggleClass('closed');
            if (this.$('.o_map_left_sidenav').hasClass('opened')) {
                if (!this.widgetAutoComplete) {
                    this.widgetAutoComplete = new this.config.WidgetSearchAutocomplete(this);
                    this.widgetAutoComplete.start();
                }
                this.$('.o_map_left_sidenav').find('input').focus();
            }
        },
        displayLoading: function (message) {
            const msg = message || _t('Fetching place detail, please wait..');
            $.blockUI({
                message:
                    '<h2 class="text-white"><img src="/web/static/img/spin.png" class="fa-pulse"/>' +
                    '<br />' +
                    msg +
                    '</h2>',
            });
        },
        placeDialogContent: function (place) {
            const $content = $('<div>', { 'class': 'container' });
            $content.append(
                $('<p>').append(
                    $('<a>', {
                        class: 'btn btn-light',
                        text: _t('View on Google Maps'),
                        title: _t('View on Google Maps'),
                        href: place.url,
                        target: '_blank',
                    })
                )
            );
            $content.append($('<p>').text(_t('Address: ') + place.formatted_address));
            $content.append(
                $('<p>').text(_t('Phone: ') + (place.international_phone_number || '-'))
            );
            $content.append($('<p>').text(_t('Rating: ') + (place.rating || '-')));
            $content.append(
                $('<p>').text(
                    _t('User rating total: ') + (place.user_ratings_total || '-')
                )
            );
            $content.append($('<p>').text(_t('Price level: ') + (place.price_level || '-')));
            if (place.website) {
                $content.append(
                    $('<p>').append(
                        $('<a>', {
                            class: 'btn btn-link',
                            text: place.website,
                            title: _t('open website'),
                            href: place.website,
                            target: '_blank',
                        })
                    )
                );
            }
            return $content;
        },
        handlePlaceDialog: function (place) {
            const $content = this.placeDialogContent(place);
            const dialog = new Dialog(this, {
                title: place.name,
                buttons: [
                    {
                        text: _t('Save'),
                        classes: 'btn-primary',
                        close: true,
                        click: () => {
                            const context =
                                this.state.data.length > 0
                                    ? this.state.data[0].context
                                    : {};
                            this.trigger_up('google_place_quick_create', {
                                place: place,
                                context: context,
                            });
                        },
                    },
                    { text: _t('Discard'), close: true },
                ],
                $content: $content,
            });
            dialog.open();
        },
        _getPlaceDetails: function (ev) {
            const service = new google.maps.places.PlacesService(this.gmap, {
                fields: [
                    'formatted_address',
                    'internation_phone_number',
                    'rating',
                    'user_ratings_total',
                    'price_level',
                    'website',
                    'name',
                    'url',
                    'type',
                ],
            });
            const request = {
                placeId: ev.placeId,
            };
            service.getDetails(request, (place, status) => {
                $.unblockUI();
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    this.handlePlaceDialog(place);
                } else {
                    console.warn(status);
                    this.do_warn(_t('Failed to fetch place detail.'));
                }
            });
        },
        _placeReverseGeocoding: function (ev) {
            if (!this.geocoder) {
                this.geocoder = new google.maps.Geocoder();
            }
            const latLng = ev.latLng;
            this.geocoder
                .geocode({ location: latLng }, (results, status) => {
                    $.unblockUI();
                    if (status === google.maps.GeocoderStatus.OK && results.length > 0) {
                        const result = results[0];
                        const content = QWeb.render('GoogleMapView.FormUnknownPlace', {
                            place_name: result.formatted_address,
                            address: result.formatted_address,
                        });
                        const dialog = new Dialog(this, {
                            title: _t('Unknown place'),
                            buttons: [
                                {
                                    text: _t('Save'),
                                    classes: 'btn-primary',
                                    close: true,
                                    click: () => {
                                        const context =
                                            this.state.data.length > 0
                                                ? this.state.data[0].context
                                                : {};
                                        const place_name = dialog
                                            .$('input[name="unknown_name"]')
                                            .val();
                                        result.name = place_name
                                            ? place_name
                                            : result.formatted_address;
                                        this.trigger_up('google_place_quick_create', {
                                            place: result,
                                            context: context,
                                        });
                                    },
                                },
                                { text: _t('Discard'), close: true },
                            ],
                            $content: content,
                        });
                        dialog.open();
                    } else {
                        console.warn(status);
                        this.displayNotification({ title: 'Google places', message: _t('Failed to fetch place detail'), type: 'warning' });
                    }
                })
                .catch((err) => {
                    $.unblockUI();
                    console.warn(err);
                    this.displayNotification({ title: 'Google places', message: _t('Failed to fetch place detail'), type: 'error' });
                });
        },
        _registerMapEvents: function () {
            if (!this.gmapClickEventHandler) {
                this.gmapClickEventHandler = this.gmap.addListener('click', (ev) => {
                    ev.stop();
                    ev.cancelBubble = true;
                    const zoomLevel = this.gmap.getZoom();
                    if (zoomLevel >= 18) {
                        if (ev.placeId) {
                            this.displayLoading();
                            this._getPlaceDetails(ev);
                        } else {
                            this.displayLoading('Reverse geocoding.. Please wait');
                            this._placeReverseGeocoding(ev);
                        }
                    }
                });
            }
            if (!this.gmapPlaceCreationInfoHandler) {
                this.gmapPlaceCreationInfoHandler = this.gmap.addListener('idle', () => {
                    const zoomLevel = this.gmap.getZoom();
                    let indicator = $(
                        QWeb.render('GoogleMapView.PlaceCreationIndicator', { widget: this })
                    );
                    if (!this.color_indicator_added) {
                        this.color_indicator_added = true;
                        this.gmap.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(
                            indicator.get(0)
                        );
                    } else {
                        if (
                            this.gmap.controls &&
                            this.gmap.controls.forEach &&
                            this.gmap.controls.forEach instanceof Function
                        ) {
                            this.gmap.controls.forEach((control) => {
                                if (control && control.forEach instanceof Function) {
                                    control.forEach((elem) => {
                                        if (elem.classList.contains('place-creation-indicator')) {
                                            let button = elem.querySelector('button');
                                            if (zoomLevel >= 18) {
                                                if (button.classList.contains('btn-light')) {
                                                    button.classList.remove('btn-light');
                                                    button.classList.add('btn-warning');
                                                }
                                            } else {
                                                if (!button.classList.contains('btn-light')) {
                                                    button.classList.toggle('btn-light');
                                                }
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            }
        },
        renderGoogleMap: function () {
            this._super.apply(this, arguments);
            this._registerMapEvents();
        },
        destroy: function () {
            google.maps.event.removeListener(this.gmapClickEventHandler);
            google.maps.event.removeListener(this.gmapPlaceCreationInfoHandler);
            this._super.apply(this, arguments);
        },
    });

    const GoogleMapSearchPlacesView = GoogleMapView.extend({
        config: _.extend({}, GoogleMapView.prototype.config, {
            Renderer: GoogleMapRendererSearchPlaces,
            Model: GoogleMapModelSearchPlaces,
            Controller: GoogleMapControllerSearchPlaces,
        }),
    });

    viewRegistry.add('google_map_search_places', GoogleMapSearchPlacesView);
});
