/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { GoogleAddressAutocomplete } from '@web_widget_google_map/widgets/GoogleAddressAutocomplete/google_address_autocomplete';
import { getPlaceProperties } from '../utils';

export class GoogleAddressAutocompleteExtended extends GoogleAddressAutocomplete {
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
    async populateAddress(place, parse_address) {
        await super.populateAddress(place, parse_address);
        const gplaces = await getPlaceProperties(
            this.env.model.orm,
            this.props.record.fields,
            place
        );
        this._update(gplaces);
    }
}
GoogleAddressAutocompleteExtended.displayName = _lt(
    'Google Address Form Autocomplete Extended'
);

registry
    .category('fields')
    .add('gplaces_address_autocomplete_extended', GoogleAddressAutocompleteExtended);
