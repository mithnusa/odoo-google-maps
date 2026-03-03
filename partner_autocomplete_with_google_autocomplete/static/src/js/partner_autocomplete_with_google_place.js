import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { exprToBoolean } from '@web/core/utils/strings';
import { useState, useRef, onWillUnmount, onWillUpdateProps, useEffect } from '@odoo/owl';
import { PartnerAutoCompleteCharField, partnerAutoCompleteCharField } from '@partner_autocomplete/js/partner_autocomplete_fieldchar';
import { useGooglePlaceAutocompleteMapping } from '@web_widget_google_place_autocomplete/hooks/use_google_place_autocomplete_mapping';
import { GooglePlaceAutocompleteElement } from '@web_widget_google_place_autocomplete/component/google_place_autocomplete';


/**
 * Extends Odoo's built-in `PartnerAutoCompleteCharField` with Google Place
 * Autocomplete support. When the user expands the widget, it fetches a
 * mapping configuration from the backend and passes it to the
 * `GooglePlaceAutocompleteElement` component. Upon place selection, the parsed
 * address and geolocation data are written back to the current record in a
 * single atomic update.
 *
 * Unlike `GooglePlaceAutocompleteCharField`, this widget inherits the partner
 * autocomplete behaviour from the parent class and adds the Google Place panel
 * alongside it. The default mapping mode is `'places'` when `mapping_mode` is
 * not explicitly set in the view XML options.
 *
 * Requires either `mapping_code` or `mapping_mode` to be provided as widget
 * options in the view XML for the Google Place panel to function.
 *
 * @extends PartnerAutoCompleteCharField
 */
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
        noManualEdit: { type: Boolean, optional: true }, // If true, the input field will be set to readonly to prevent manual edits. Other fields will still be populated based on the autocomplete selection. Default is false (manual edits allowed).
    };

    /**
     * Initialises services, reactive state, the place mapping hook, and
     * lifecycle callbacks. Does not fetch the mapping configuration here —
     * that is deferred until the user opens the autocomplete panel via
     * `toggleCollapse`.
     */
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

        useEffect(
            (inputRef, noManualEdit, readonly) => {
                if (inputRef.el && !readonly) {
                    if (noManualEdit) {
                        inputRef.el.setAttribute('readonly', 'readonly');
                    } else {
                        inputRef.el.removeAttribute('readonly');
                    }
                }
            },
            () => [this.inputRef, this.props.noManualEdit, this.props.readonly]
        );

        onWillUnmount(() => {
            this.closeGoogleAutocomplete();
            this.mappingConfig = {};
        });

        onWillUpdateProps((nextProps) => {
            if (nextProps.record?.id !== this.props.record?.id) {
                this.closeGoogleAutocomplete();
            }
        });
    }

    /**
     * Writes parsed place data from the autocomplete selection back to the
     * current Odoo record. Address fields and (in 'places' mode) additional
     * place fields are merged with geolocation fields into a single
     * `record.update()` call to avoid intermediate re-renders.
     *
     * Closes the autocomplete panel on success. Shows a warning notification
     * if the update fails.
     *
     * @param {Object} data - Parsed place data returned by `GooglePlaceAutocompleteElement`.
     * @param {Object} [data.address] - Address component values mapped to Odoo field names.
     * @param {Object} [data.other] - Additional place data, applied only in 'places' mode.
     * @param {Object} [data.geolocation] - Latitude/longitude values mapped to Odoo field names.
     * @returns {Promise<void>}
     */
    async saveChanges(data) {
        try {
            const values = {};
            if (data.address) {
                Object.assign(values, data.address);
            }
            if (data.other && this.mappingConfig.mode === 'places') {
                Object.assign(values, data.other);
            }

            const allValues = {
                ...this._prepareValues(values),
                ...this._prepareValues(data.geolocation),
            };

            if (Object.keys(allValues).length > 0) {
                await this.props.record.update(allValues);
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

    /**
     * Filters a map of field name → value pairs, keeping only keys that
     * correspond to actual fields on the current record. Applies `parse()`
     * to each value so that CharField trimming and other transformations are
     * respected.
     *
     * Unknown keys (fields returned by the mapping but not present on the
     * record) are silently dropped, preventing accidental writes to
     * non-existent fields.
     *
     * @param {Object} values - Raw field name → value map to filter.
     * @returns {Object} A new object containing only the valid field entries,
     *   or `{}` if `values` is empty, null, or an error occurs.
     */
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

    /**
     * Handles the collapse toggle button click. Updates `isCollapseOpen` to
     * reflect the new state, then — when opening — validates the widget
     * configuration and fetches the mapping config. Sets `mappingId` on the
     * reactive state so the template can render the autocomplete component,
     * or sets it to `-1` to signal that no valid mapping was found.
     *
     * @param {MouseEvent} ev - The click event from the toggle button.
     * @returns {Promise<void>}
     */
    async toggleCollapse(ev) {
        const isClosed = ev.currentTarget.classList.contains('collapsed');
        this.state.isCollapseOpen = !isClosed;
        if (!isClosed) {
            this.validateProps();
            const mappingConfig = await this.placeMapping.getMappingConfig();
            if (!mappingConfig || !mappingConfig.id) {
                this.state.mappingId = -1; // Indicate no valid mapping found
                this.notificationService.add(
                    _t(
                        'No valid mapping configuration found for Google Place Autocomplete. Please check the settings.'
                    ),
                    { type: 'warning' }
                );
            } else {
                const { id, ...restConfig } = mappingConfig;
                this.state.mappingId = id;
                Object.assign(this.mappingConfig, restConfig);
            }
        }
    }

    /**
     * Programmatically closes the Google Autocomplete panel by removing
     * Bootstrap's `show` class from the collapse element and updating the
     * toggle button's `aria-expanded` attribute. Also resets `isCollapseOpen`
     * on the reactive state to keep it in sync with the DOM.
     *
     * Does nothing if the toggle ref is not yet mounted or if the panel is
     * already closed.
     */
    closeGoogleAutocomplete() {
        if (!this.googleAutocompleteToggleRef.el) {
            return;
        }
        const isClosed = this.googleAutocompleteToggleRef.el.classList.contains('collapsed');
        const collapseEl = document.getElementById(
            this.googleAutocompleteToggleRef.el.getAttribute('href').substring(1)
        );
        if (!isClosed && collapseEl && collapseEl.classList.contains('show')) {
            this.state.isCollapseOpen = false;
            collapseEl.classList.remove('show');
            this.googleAutocompleteToggleRef.el.setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * Applies trimming to string values when `shouldTrim` is enabled on the
     * parent `CharField`. Passes non-string values through unchanged.
     *
     * @param {*} value - The value to parse.
     * @returns {*} The trimmed string, or the original value if not a string
     *   or trimming is disabled.
     */
    parse(value) {
        if (this.shouldTrim && typeof value === 'string') {
            return value.trim();
        }
        return value;
    }

    /**
     * Validates the widget's mapping configuration props and notifies the
     * user if there is a problem. Called at the start of `toggleCollapse` so
     * that feedback is shown at interaction time rather than on every mount.
     *
     * Checks performed:
     * - Neither `mappingCode` nor `mappingMode` is set (widget will not function).
     * - `mappingMode` is set but its value is not one of the accepted values
     *   (`'address'` or `'places'`).
     */
    validateProps() {
        if (!this.props.mappingCode && !this.props.mappingMode) {
            console.warn(
                'PartnerAutoCompleteCharFieldWithGooglePlace: neither mappingCode nor mappingMode is set. The widget will not function. Check the field options in the view XML'
            );
            this.notificationService.add(
                _t(
                    'Google Place Autocomplete widget requires a mapping code or mapping mode to function properly. Please check the configuration.'
                ),
                { type: 'warning' }
            );
        }
        if (this.props.mappingMode && !['address', 'places'].includes(this.props.mappingMode)) {
            this.notificationService.add(
                _t(
                    `Invalid mapping mode: "${this.props.mappingMode}" for Google Place Autocomplete widget`
                ),
                { type: 'warning' }
            );
        }
    }
}

export const partnerAutoCompleteCharFieldWithGooglePlace = {
    ...partnerAutoCompleteCharField,
    component: PartnerAutoCompleteCharFieldWithGooglePlace,
    displayName: _t('Partner Autocomplete with Google Place'),
    extractProps: ({ attrs, options, placeholder }) => ({
        ...partnerAutoCompleteCharField.extractProps({ attrs, options, placeholder }),
        mappingCode: options.mapping_code,
        mappingMode: options.mapping_mode || 'places',
        noManualEdit: exprToBoolean(options.no_manual_edit, false),
    }),
};

registry
    .category('fields')
    .add(
        'field_partner_autocomplete_with_google_place',
        partnerAutoCompleteCharFieldWithGooglePlace
    );
