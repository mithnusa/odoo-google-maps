import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { exprToBoolean } from '@web/core/utils/strings';
import {
    PartnerAutoCompleteCharField,
    partnerAutoCompleteCharField,
} from '@partner_autocomplete/js/partner_autocomplete_fieldchar';
import { useGooglePlaceAutocomplete } from '@web_widget_google_map/hooks/use_google_place_autocomplete';

/**
 * Combines PartnerAutoCompleteCharField with Google Place Autocomplete functionality
 * Uses composition via useGooglePlaceAutocomplete hook instead of inheritance
 */
export class PartnerAutoCompleteCharFieldWithGooglePlace extends PartnerAutoCompleteCharField {
    static template = 'contacts_gautocomplete_places.PartnerAutoCompleteCharFieldWithGooglePlace';
    static props = {
        ...PartnerAutoCompleteCharField.props,
        mappingCode: { type: String, optional: true },
        mappingMode: { type: String, optional: true },
    };

    setup() {
        super.setup();

        // Use the composable hook for Google Place functionality
        const googlePlace = useGooglePlaceAutocomplete();

        // Expose to component instance
        this.googlePlace = googlePlace;
        this.divInputRef = googlePlace.refs.divInputRef;
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

export const partnerAutoCompleteCharFieldWithGooglePlace = {
    ...partnerAutoCompleteCharField,
    component: PartnerAutoCompleteCharFieldWithGooglePlace,
    displayName: _t('Partner Autocomplete with Google Place'),
    extractProps: ({ attrs, options, placeholder }) => ({
        isPassword: exprToBoolean(attrs.password),
        dynamicPlaceholder: options.dynamic_placeholder || false,
        dynamicPlaceholderModelReferenceField:
            options.dynamic_placeholder_model_reference_field || '',
        autocomplete: attrs.autocomplete,
        placeholder,
        mappingCode: options.mapping_code || '',
        mappingMode: options.mapping_mode || 'places',
    }),
};

registry
    .category('fields')
    .add(
        'field_partner_autocomplete_with_google_place',
        partnerAutoCompleteCharFieldWithGooglePlace
    );
