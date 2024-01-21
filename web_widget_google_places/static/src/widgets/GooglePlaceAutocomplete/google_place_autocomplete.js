/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import {
    GooglePlaceAutocompleteField,
    googlePlaceAutocompleteField,
} from '@web_widget_google_map/widgets/GooglePlaceAutocomplete/google_place_autocomplete';
import { getPlaceProperties } from '../utils';

export class GooglePlaceAutocompleteExtendedField extends GooglePlaceAutocompleteField {
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

export const googlePlaceAutocompleteExtendedField = {
    ...googlePlaceAutocompleteField,
    component: GooglePlaceAutocompleteExtendedField,
    displayName: _t('Google Places Autocomplete Extended'),
};

registry
    .category('fields')
    .add('gplaces_autocomplete_extended', googlePlaceAutocompleteExtendedField);
