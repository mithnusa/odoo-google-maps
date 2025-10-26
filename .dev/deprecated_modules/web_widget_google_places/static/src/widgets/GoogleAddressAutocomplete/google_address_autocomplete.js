import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import {
    GoogleAddressAutocompleteField,
    googleAddressAutocompleteField,
} from '@web_widget_google_map/widgets/GoogleAddressAutocomplete/google_address_autocomplete';
import { getPlaceProperties } from '../utils';

export class GoogleAddressAutocompleteExtendedField extends GoogleAddressAutocompleteField {
    getGoogleFieldsRestriction() {
        const fields = super.getGoogleFieldsRestriction();
        const new_fields = new Set(
            fields.concat([
                'formattedAddress',
                'plusCode',
                'id',
                'websiteURI',
                'types',
            ])
        );
        return Array.from(new_fields);
    }
    async populateAddress(place, parse_address) {
        console.log(' GoogleAddressAutocompleteExtendedField.populateAddress ');
        await super.populateAddress(place, parse_address);
        const gplaces = await getPlaceProperties(
            this.env.model.orm,
            this.props.record.fields,
            place
        );
        console.log('gplaces: ', gplaces);
        this._update(gplaces);
    }
}

export const googleAddressAutocompleteExtendedField = {
    ...googleAddressAutocompleteField,
    component: GoogleAddressAutocompleteExtendedField,
    displayName: _t('Google Address Form Autocomplete Extended'),
};

registry
    .category('fields')
    .add('gplaces_address_autocomplete_extended', googleAddressAutocompleteExtendedField);
