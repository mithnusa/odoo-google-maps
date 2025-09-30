import { _t } from '@web/core/l10n/translation';
import { registry } from '@web/core/registry';
import { CharField, charField } from '@web/views/fields/char/char_field';
import { useGooglePlaceAutocomplete } from '../../hooks/use_google_place_autocomplete';

/**
 *
 * widget options:
 *  * Google options
 *  - includedRegionCodes: Array
 *  - includedPrimaryTypes: Array
 *  - excludedPrimaryTypes: Array
 *  - fetchFields: Array
 *  * Odoo widget options
 *  - fieldsToFill: Object
 */

export class GooglePlaceAutocompleteElement extends CharField {
    static template = 'web_widget_google_map.GooglePlaceAutocompleteElement';
    static props = {
        ...CharField.props,
        mappingCode: { type: String, optional: true },
        mappingMode: { type: String, optional: true }, // 'address' or 'places'
    };
    setup() {
        super.setup();

        // Use the composable hook
        const googlePlace = useGooglePlaceAutocomplete();

        // Expose to component instance
        this.googlePlace = googlePlace;
    }

    get mappingUrl() {
        return this.googlePlace.methods.getMappingUrl();
    }

    get widgetId() {
        return this.googlePlace.methods.getWidgetId();
    }

    get mappingId() {
        const state = this.googlePlace.methods.getState();
        return state.mappingId;
    }

    get mappingMode() {
        const state = this.googlePlace.methods.getState();
        return state.mappingMode;
    }

    get mappingCode() {
        const state = this.googlePlace.methods.getState();
        return state.mappingCode;
    }


    openMappingConfig() {
        this.googlePlace.methods.openMappingConfig();
    }
}

export const googlePlaceAutocompleteElement = {
    ...charField,
    component: GooglePlaceAutocompleteElement,
    displayName: _t('Google Place Autocomplete Element'),
    supportedTypes: ['char', 'text'],
    extractProps: ({ attrs, options, placeholder }) => ({
        isPassword: false,
        dynamicPlaceholder: options.dynamic_placeholder || false,
        dynamicPlaceholderModelReferenceField:
            options.dynamic_placeholder_model_reference_field || '',
        autocomplete: attrs.autocomplete,
        mappingCode: options.mapping_code || '',
        mappingMode: options.mapping_mode || '',
        placeholder,
    }),
};

registry.category('fields').add('gplace_autocomplete_el', googlePlaceAutocompleteElement);
