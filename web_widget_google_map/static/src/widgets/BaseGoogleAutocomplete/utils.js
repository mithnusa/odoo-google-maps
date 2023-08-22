/** @odoo-module **/

export const GOOGLE_PLACES_COMPONENT_FORM = {
    street_number: 'long_name',
    route: 'long_name',
    intersection: 'short_name',
    political: 'short_name',
    country: 'short_name',
    administrative_area_level_1: 'short_name',
    administrative_area_level_2: 'short_name',
    administrative_area_level_3: 'short_name',
    administrative_area_level_4: 'short_name',
    administrative_area_level_5: 'short_name',
    colloquial_area: 'short_name',
    locality: 'short_name',
    ward: 'short_name',
    sublocality_level_1: 'short_name',
    sublocality_level_2: 'short_name',
    sublocality_level_3: 'short_name',
    sublocality_level_5: 'short_name',
    neighborhood: 'short_name',
    premise: 'short_name',
    postal_code: 'short_name',
    natural_feature: 'short_name',
    airport: 'short_name',
    park: 'short_name',
    point_of_interest: 'long_name',
    floor: 'short_name',
    establishment: 'short_name',
    point_of_interest: 'short_name',
    parking: 'short_name',
    post_box: 'short_name',
    postal_town: 'short_name',
    room: 'short_name',
    bus_station: 'short_name',
    train_station: 'short_name',
    transit_station: 'short_name',
};

/**
 * Mapping field with an alias
 * key: alias
 * value: field
 */
export const ADDRESS_FORM = {
    street: 'street',
    street2: 'street2',
    city: 'city',
    zip: 'zip',
    state_id: 'state_id',
    country_id: 'country_id',
};

export const ADDRESS_MODE = ['address_format', 'no_address_format'];
export const AUTOCOMPLETE_TYPES = [
    'geocode',
    'address',
    'establishment',
    'regions',
    'cities',
];

/**
 *
 * @param {*} model
 * @param {*} field_name
 * @param {*} value
 */
export function fetchValues(ormService, model, field_name, value) {
    if (model && value) {
        return new Promise(async (resolve) => {
            const data = await ormService.searchRead(
                model,
                ['|', ['name', '=', value], ['code', '=', value]],
                ['display_name'],
                { limit: 1 }
            );
            resolve({
                [field_name]: data.length === 1 ? data[0] : false,
            });
        });
    } else {
        return new Promise((resolve) => {
            resolve({
                [field_name]: value,
            });
        });
    }
}

/**
 *
 * @param {*} model
 * @param {*} country
 * @param {*} state
 */
export function fetchCountryState(ormService, model, country, state) {
    if (model && country && state) {
        return new Promise(async (resolve) => {
            const data = await ormService.searchRead(
                model,
                [
                    ['country_id', '=', country],
                    '|',
                    ['code', '=', state],
                    ['name', '=', state],
                ],
                ['display_name'],
                { limit: 1 }
            );
            const result = data.length === 1 ? data[0] : {};
            resolve(result);
        });
    } else {
        return new Promise((resolve) => resolve([]));
    }
}

/**
 *
 * @param {*} place
 * @param {*} options
 */
export function gmaps_get_geolocation(place, options) {
    if (!place) return {};

    const vals = {};
    _.each(options, (alias, field) => {
        if (alias === 'latitude') {
            vals[field] = place.geometry.location.lat();
        } else if (alias === 'longitude') {
            vals[field] = place.geometry.location.lng();
        }
    });
    return vals;
}

/**
 *
 * @param {*} place
 * @param {*} place_options
 */
export function gmaps_populate_places(place, place_options) {
    if (!place) return {};

    const values = {};
    let vals;
    _.each(place_options, (option, field) => {
        if (option instanceof Array && !_.has(values, field)) {
            vals = _.filter(_.map(option, (opt) => place[opt] || false));
            values[field] = _.first(vals) || '';
        } else {
            values[field] = place[option] || '';
        }
    });
    return values;
}

/**
 *
 * @param {*} place
 * @param {*} address_options
 * @param {*} delimiter
 */
export function gmaps_populate_address(place, address_options, delimiter) {
    if (!place) return {};
    address_options = typeof address_options !== 'undefined' ? address_options : {};
    const fields_delimiter = delimiter || {
        street: ' ',
        street2: ', ',
    };
    const fields_to_fill = {};
    const result = {};
    let dlmter = null;
    let temp = null;

    // initialize object key and value
    _.each(address_options, (value, key) => {
        fields_to_fill[key] = [];
    });

    _.each(address_options, (options, field) => {
        // turn all fields options into an Array
        options = _.flatten([options]);
        temp = {};
        _.each(place.address_components, (component) => {
            _.each(_.intersection(options, component.types), (match) => {
                temp[match] = component[GOOGLE_PLACES_COMPONENT_FORM[match]] || false;
            });
        });
        fields_to_fill[field] = _.map(options, (item) => temp[item]);
    });

    _.each(fields_to_fill, (value, key) => {
        dlmter = fields_delimiter[key] || ' ';
        if (key === 'city') {
            result[key] = _.first(_.filter(value)) || '';
        } else {
            result[key] = _.filter(value).join(dlmter);
        }
    });

    return result;
}
