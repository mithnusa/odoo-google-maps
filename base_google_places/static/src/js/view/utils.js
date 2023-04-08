/** @odoo-module **/

export async function preparePlaces(orm, fields, place) {
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

    if (_.intersection(_.keys(fields), places_fields).length === places_fields.length) {
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
                const records = await orm.call('google.places.type', 'search_read', [
                    [['code', 'in', place.types]],
                    ['id'],
                ]);
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
