import { _t } from '@web/core/l10n/translation';
import { registry } from '@web/core/registry';
import { useService } from '@web/core/utils/hooks';
import { useRef, useState, onWillUnmount  } from '@odoo/owl';
import { CharField, charField } from '@web/views/fields/char/char_field';
import { GooglePlaceAutocompleteElement } from '../../component/google_place_autocomplete';
import { useGooglePlaceAutocompleteMapping } from '../../hooks/use_google_place_autocomplete_mapping';

export class GooglePlaceAutocompleteCharField extends CharField {
    static template = 'web_widget_google_place_autocomplete.GooglePlaceAutocompleteCharField';
    static components = { ...CharField.components, GooglePlaceAutocompleteElement };
    static props = {
        ...CharField.props,
        mappingCode: { type: String, optional: true },
        mappingMode: { type: String, optional: true }, // 'address' or 'places'
    };
    setup() {
        super.setup();
        this.validateProps();

        this.notificationService = useService('notification');

        this.googleAutocompleteToggleRef = useRef("googleAutocompleteToggle");

        this.state = useState({
            mappingId: 0,
            isCollapseOpen: false,
        });

        this.placeMapping = useGooglePlaceAutocompleteMapping();
        this.widgetId = this.placeMapping.getUniqueWidgetId();
        this.mappingConfig = {};


        onWillUnmount(() => {
            this.closeGoogleAutocomplete();
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
            try {
                const mappingConfig = await this.placeMapping.getMappingConfig();
                if (!mappingConfig || !mappingConfig.id) {
                    this.state.mappingId = -1; // Indicate no valid mapping found
                    this.notificationService.add(
                        _t('No valid mapping configuration found for Google Place Autocomplete. Please check the settings.'),
                        { type: 'warning' }
                    );
                } else {
                    this.state.mappingId = mappingConfig.id;
                    delete mappingConfig.id;
                    Object.assign(this.mappingConfig, mappingConfig);
                }
            } catch (error) {
                console.error('Error fetching mapping configuration:', { error });
                this.state.mappingId = -1; // Indicate error in fetching mapping
                this.notificationService.add(
                    _t('Error retrieving mapping configuration for Google Place Autocomplete. Please try again.'),
                    { type: 'danger' }
                );
            }
        }
    }

    closeGoogleAutocomplete() {
        if (!this.googleAutocompleteToggleRef.el) {
            return;
        }
        const isClosed = this.googleAutocompleteToggleRef.el.classList.contains('collapsed');
        const collapseEl = document.getElementById(this.googleAutocompleteToggleRef.el.getAttribute('href').substring(1));
        if (!isClosed && collapseEl && collapseEl.classList.contains('show')) {
            collapseEl.classList.remove('show');
            this.googleAutocompleteToggleRef.el.setAttribute('aria-expanded', 'false');
        }
    }

    validateProps() {
        if (this.props.mappingMode && !['address', 'places'].includes(this.props.mappingMode)) {
            this.notificationService.add(
                _t(`Invalid mapping mode: "${this.props.mappingMode}" for Google Place Autocomplete widget`),
                { type: 'warning' }
            );
        }
    }

    parse(value) {
        if (this.shouldTrim && typeof value === 'string') {
            return value.trim();
        }
        return value;
    }
}

export const googlePlaceAutocompleteCharField = {
    ...charField,
    component: GooglePlaceAutocompleteCharField,
    displayName: _t('Google Place Autocomplete Element'),
    supportedTypes: ['char', 'text'],
    extractProps: ({ attrs, options, placeholder }) => ({
        ...charField.extractProps({ attrs, options, placeholder }),
        mappingCode: options.mapping_code || '',
        mappingMode: options.mapping_mode || '',
    }),
};

registry.category('fields').add('gplace_autocomplete_el', googlePlaceAutocompleteCharField);
