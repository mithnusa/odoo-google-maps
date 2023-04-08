odoo.define('base_google_places.Places', function (require) {
    'use strict';

    const core = require('web.core');
    const rpc = require('web.rpc');
    const qweb = core.qweb;
    const AbstractField = require('web.AbstractField');
    const registry = require('web.field_registry');
    const WidgetGoogleAutocomplete = require('web_google_maps.GplaceAutocompleteFields');

    const GplacePhotosGallery = AbstractField.extend({
        className: 'd-block w-100',
        gallery_template: 'GplacePhotosGallery',
        supportedFieldTypes: ['text'],
        getPhotos: function () {
            const values = this.attrs.text || this.value;
            if (values) {
                return values.split(',');
            }
            return [];
        },
        _renderReadonly: function () {
            const photos = this.getPhotos();
            setTimeout(() => {
                this.$el.html(qweb.render(this.gallery_template, { photos: photos, widget: this }));
            }, 500);
        },
    });

    function getPlaceProperties(record_fields, place) {
        const places_fields = [
            'gplace_formatted_address',
            'gplace_id',
            'gplace_url',
            'gplace_opening_hours',
            'gplace_type_ids',
            'gplace_plus_code_global',
            'gplace_plus_code_compound',
            'gplace_photos_url',
            'gplace_vicinity',
        ];

        if (_.intersection(_.keys(record_fields), places_fields).length === places_fields.length) {
            const res = {
                gplace_formatted_address: place.formatted_address || '',
                gplace_id: place.place_id || '',
                gplace_vicinity: place.vicinity || '',
                gplace_url: place.url || '',
            };
            if (place.opening_hours) {
                res['gplace_opening_hours'] = place.opening_hours.weekday_text.join('\n');
            }
            if (place.plus_code) {
                res['gplace_plus_code_global'] = place.plus_code.global_code;
                res['gplace_plus_code_compound'] = place.plus_code.compound_code;
            }
            if (place.photos) {
                const photos = [];
                _.map(place.photos, (photo, idx) => {
                    if (idx < 3) {
                        const photo_url = photo.getUrl({ maxWidth: 480 });
                        photos.push(photo_url);
                    }
                });
                res['gplace_photos_url'] = photos.join(',');
            }
            return new Promise(async (resolve) => {
                if (place.types) {
                    const records = await rpc.query({
                        model: 'google.places.type',
                        method: 'search_read',
                        args: [[['code', 'in', place.types]], ['id']],
                    });
                    res['gplace_type_ids'] = {
                        operation: 'REPLACE_WITH',
                        ids: _.map(records, function (val) {
                            return val.id;
                        }),
                    };
                }
                resolve(res);
            });
        }
        return new Promise((resolve) => resolve({}));
    }

    WidgetGoogleAutocomplete.GplacesAutocompleteField.include({
        get_google_fields_restriction: function () {
            const fields = this._super();
            // if you need 'photos', add it on the array below
            const new_fields = fields.concat([
                'formatted_address',
                'plus_code',
                'place_id',
                'vicinity',
                'url',
                'type',
                'opening_hours',
            ]);
            return new_fields;
        },
        handlePopulateAddress: async function () {
            this._super.apply(this, arguments);
            const place = this.places_autocomplete.getPlace();
            const values = await getPlaceProperties(this.record.fields, place);
            this._onUpdateWidgetFields(values);
        },
    });

    WidgetGoogleAutocomplete.GplacesAddressAutocompleteField.include({
        get_google_fields_restriction: function () {
            const fields = this._super();
            // if you need 'photos', add it on the array below
            const new_fields = fields.concat([
                'formatted_address',
                'plus_code',
                'place_id',
                'vicinity',
                'url',
                'type',
                'opening_hours',
            ]);
            return new_fields;
        },
        handlePopulateAddress: async function () {
            this._super.apply(this, arguments);
            const place = this.places_autocomplete.getPlace();
            const values = await getPlaceProperties(this.record.fields, place);
            this._onUpdateWidgetFields(values);
        },
    });

    registry.add('gplaces_photos_gallery', GplacePhotosGallery);

    return {
        GplacePhotosGallery: GplacePhotosGallery,
        funcGetPlaceProperties: getPlaceProperties,
    };
});
