/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { GooglePlaceAutocomplete } from '@web_widget_google_map/widgets/GooglePlaceAutocomplete/google_place_autocomplete';
import { getPlaceProperties } from '../utils';

export class GooglePlaceAutocompleteExtended extends GooglePlaceAutocomplete {
    getGoogleFieldsRestriction() {
        const fields = super.getGoogleFieldsRestriction();
        return fields.concat([
            'formatted_address',
            'plus_code',
            'place_id',
            'vicinity',
            'url',
            'type',
            'opening_hours',
        ]);
    }
    async populateAddress(place) {
        await super.populateAddress(place);
        const gplaces = await getPlaceProperties(
            this.env.model.orm,
            this.props.record.fields,
            place
        );
        this._update(gplaces);
    }
}
GooglePlaceAutocompleteExtended.displayName = _lt(
    'Google Places Autocomplete Extended'
);

registry
    .category('fields')
    .add('gplaces_autocomplete_extended', GooglePlaceAutocompleteExtended);
