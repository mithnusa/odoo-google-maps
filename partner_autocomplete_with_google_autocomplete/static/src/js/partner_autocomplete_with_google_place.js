import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { useState, useRef, onWillUnmount } from '@odoo/owl';
import { PartnerAutoCompleteCharField, partnerAutoCompleteCharField } from '@partner_autocomplete/js/partner_autocomplete_fieldchar';
import { useGooglePlaceAutocompleteMapping } from '@web_widget_google_place_autocomplete/hooks/use_google_place_autocomplete_mapping';
import { GooglePlaceAutocompleteElement } from '@web_widget_google_place_autocomplete/component/google_place_autocomplete';


export class PartnerAutoCompleteCharFieldWithGooglePlace extends PartnerAutoCompleteCharField {
    static template =
        'partner_autocomplete_with_google_autocomplete.PartnerAutoCompleteCharFieldWithGooglePlace';
    static components = {
        ...PartnerAutoCompleteCharField.components,
        GooglePlaceAutocompleteElement,
    };
    static props = {
        ...PartnerAutoCompleteCharField.props,
        mappingCode: { type: String, optional: true },
        mappingMode: { type: String, optional: true },
    };

    setup() {
        super.setup();
        this.notificationService = useService('notification');
        this.googleAutocompleteToggleRef = useRef('googleAutocompleteToggle');
        this.state = useState({
            mappingId: 0,
            isCollapseOpen: false,
        });
        this.placeMapping = useGooglePlaceAutocompleteMapping();
        this.widgetId = this.placeMapping.getUniqueWidgetId();
        this.mappingConfig = {};

        onWillUnmount(() => {
            this.mappingConfig = {};
        });
    }

    async saveChanges(data) {
        try {
            const values = {};
            if (data.address) {
                Object.assign(values, data.address);
            }
            if (data.other && this.mappingConfig.mode === 'places') {
                Object.assign(values, data.other);
            }

            const preparedValues = this._prepareValues(values);
            if (Object.keys(preparedValues).length > 0) {
                await this.props.record.update(preparedValues);
            }

            const geolocationValues = this._prepareValues(data.geolocation);
            if (Object.keys(geolocationValues).length > 0) {
                await this.props.record.update(geolocationValues);
            }

            this.closeGoogleAutocomplete();
        } catch (error) {
            console.error('Failed to populate values from Google Place:', { error, data });
            this.notificationService.add(
                _t('Failed to populate values from Google Place. Please try again.'),
                { type: 'warning' }
            );
        }
    }

    _prepareValues(values) {
        try {
            if (!values || Object.keys(values).length === 0) return {};
            const fields = this.props.record.fields;
            const changes = {};
            for (const key in values) {
                if (Object.prototype.hasOwnProperty.call(fields, key)) {
                    changes[key] = this.parse(values[key]);
                }
            }
            return changes;
        } catch (error) {
            console.error('Error preparing values:', { error, values });
            return {}
        }
    }

    async toggleCollapse(ev) {
        const isClosed = ev.currentTarget.classList.contains('collapsed');
        this.state.isCollapseOpen = !isClosed;
        if (!isClosed) {
            const mappingConfig = await this.placeMapping.getMappingConfig();
            this.state.mappingId = mappingConfig?.id || -1; // Set to -1 if no valid mapping found
            if (!mappingConfig || !mappingConfig.id) {
                this.notificationService.add(
                    _t('No valid mapping configuration found for Google Place Autocomplete.'),
                    { type: 'warning' }
                );
            }
            delete mappingConfig.id;
            Object.assign(this.mappingConfig, mappingConfig);
        }
    }

    closeGoogleAutocomplete() {
        if (!this.googleAutocompleteToggleRef.el) {
            return;
        }
        const isClosed = this.googleAutocompleteToggleRef.el.classList.contains('collapsed');
        const collapseEl = document.getElementById(
            this.googleAutocompleteToggleRef.el.getAttribute('href').substring(1)
        );
        if (!isClosed && collapseEl && collapseEl.classList.contains('show')) {
            collapseEl.classList.remove('show');
            this.googleAutocompleteToggleRef.el.setAttribute('aria-expanded', 'false');
        }
    }

    parse(value) {
        if (this.shouldTrim && typeof value === 'string') {
            return value.trim();
        }
        return value;
    }
}

export const partnerAutoCompleteCharFieldWithGooglePlace = {
    ...partnerAutoCompleteCharField,
    component: PartnerAutoCompleteCharFieldWithGooglePlace,
    displayName: _t('Partner Autocomplete with Google Place'),
    extractProps: ({ attrs, options, placeholder }) => ({
        ...partnerAutoCompleteCharField.extractProps({ attrs, options, placeholder }),
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
