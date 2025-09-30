export async function preparePlaces(orm, fields, place) {
    const placesFields = [
        'gplace_formatted_address',
        'gplace_id',
        'gplace_url',
        'gplace_opening_hours',
        'gplace_type_ids',
        'gplace_plus_code_global',
        'gplace_plus_code_compound',
        'gplace_vicinity',
    ];

    const odooFields = Object.keys(fields);
    const validateFields = placesFields.filter((v) => odooFields.includes(v));

    if (validateFields.length === placesFields.length) {
        const res = {
            gplace_formatted_address: place.formattedAddress || '',
            gplace_id: place.id || '',
            gplace_url: place.websiteURI || '',
        };
        if (place.regularOpeningHours) {
            res['gplace_opening_hours'] = place.regularOpeningHours.join('\n');
        }
        if (place.plusCode) {
            res['gplace_plus_code_global'] = place.plusCode.globalCode;
            res['gplace_plus_code_compound'] = place.plusCode.compoundCode;
        }
        return new Promise(async (resolve) => {
            if (place.types) {
                const records = await orm.call('google.places.type', 'search_read', [
                    [['code', 'in', place.types]],
                    ['display_name'],
                ]);
                res['gplace_type_ids'] = [[6, 0, records.map((val) => val.id)]];
            }
            resolve(res);
        });
    }
    return new Promise((resolve) => resolve({}));
}
