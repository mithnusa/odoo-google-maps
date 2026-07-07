/**
 * @fileoverview "Validate Address" widget for the Contact form.
 *
 * Thin client: all communication with the Google Address Validation API
 * and response parsing happens server-side in the
 * `google.address.validation` abstract model. The widget only triggers
 * the validation, displays the result dialog, and asks the backend to
 * apply the outcome.
 *
 * @module contacts_google_address_validation/widgets/GoogleAddressValidation
 */

import { Component, useState, onMounted, onWillUpdateProps } from '@odoo/owl';
import { _t } from '@web/core/l10n/translation';
import { registry } from '@web/core/registry';
import { useService } from '@web/core/utils/hooks';
import { standardWidgetProps } from '@web/views/widgets/standard_widget_props';
import { KeepLast } from '@web/core/utils/concurrency';
import { AddressValidationDialog } from '../../components/address_validation_dialog/address_validation_dialog';
const { DateTime } = luxon;

/**
 * Supported region codes for the Address Validation API, used only to
 * disable the widget for out-of-coverage countries without a round-trip.
 * The authoritative check lives server-side in
 * `google.address.validation.is_region_supported()`.
 *
 * @see https://developers.google.com/maps/documentation/address-validation/coverage
 * @type {string[]}
 */
const SUPPORTED_REGIONS_CODES = [
    'AR', // Argentina
    'AT', // Austria
    'AU', // Australia
    'BE', // Belgium
    'BG', // Bulgaria
    'BR', // Brazil
    'CA', // Canada
    'CH', // Switzerland
    'CL', // Chile
    'CO', // Colombia
    'CZ', // Czechia
    'DE', // Germany
    'DK', // Denmark
    'EE', // Estonia
    'ES', // Spain
    'FI', // Finland
    'FR', // France
    'GB', // United Kingdom
    'HR', // Croatia
    'HU', // Hungary
    'IE', // Ireland
    'IN', // India
    'IT', // Italy
    'JP', // Japan
    'LT', // Lithuania
    'LU', // Luxembourg
    'LV', // Latvia
    'MX', // Mexico
    'MY', // Malaysia
    'NL', // Netherlands
    'NO', // Norway
    'NZ', // New Zealand
    'PL', // Poland
    'PR', // Puerto Rico
    'PT', // Portugal
    'SE', // Sweden
    'SG', // Singapore
    'SI', // Slovenia
    'SK', // Slovakia
    'US', // United States
];

/**
 * Granularity information for the Address Validation API, used only to
 * display a tooltip for the granularity badge. The authoritative check
 * lives server-side in `google.address.validation.get_granularity_info()`.
 *
 * Note: `GRANULARITY_UNSPECIFIED` is internal value, used when the API cannot determine the level of detail, but the record has been validated.
 * In this case, the tooltip will show "Granularity: Unspecified".
 *
 * @see https://developers.google.com/maps/documentation/javascript/reference/address-validation#Granularity
 * @type {Object<string, string>}
 */
const GRANULARITY_INFO = {
    SUB_PREMISE: _t('Granularity: Sub-premise (below-building level result, such as an apartment)'),
    PREMISE: _t('Granularity: Premise (building-level result, such as a house or business)'),
    PREMISE_PROXIMITY: _t(
        'Granularity: Premise Proximity (geocode that approximates the building-level location of the address)'
    ),
    BLOCK: _t(
        'Granularity: Block (the address or geocode indicates a block. Only used in regions which have block-level addressing, such as Japan)'
    ),
    ROUTE: _t('Granularity: Route (the geocode or address is granular to route, such as a street, road, or highway)'),
    OTHER: _t(
        'Granularity: Other (all other granularities, which are bucketed together since they are not deliverable.)'
    ),
    GRANULARITY_UNSPECIFIED: _t('Granularity: Unspecified (Google could not determine the level of detail)'),
};

/**
 * Extracts the id from a Many2one record value, tolerating the different
 * shapes used across Odoo versions ([id, name] tuple or {id, display_name}).
 *
 * @param {*} value - Many2one value from `record.data`
 * @returns {number|false} Database id or false
 */
function extractMany2oneId(value) {
    if (!value) {
        return false;
    }
    if (Array.isArray(value)) {
        return value[0] || false;
    }
    if (typeof value === 'object') {
        return value.id || false;
    }
    return value;
}

export class GoogleAddressValidation extends Component {
    static template = 'contacts_google_address_validation.GoogleAddressValidation';
    static props = { ...standardWidgetProps };

    setup() {
        this.ormService = useService('orm');
        this.dialogService = useService('dialog');
        this.notificationService = useService('notification');
        this.state = useState({ busy: false, disabled: false });

        onMounted(async () => {
            const regionCode = await this.getRegionCode();
            if (!regionCode || !SUPPORTED_REGIONS_CODES.includes(regionCode)) {
                this.state.disabled = true;
            }
        });

        this.keepLastRegion = new KeepLast();
        onWillUpdateProps(async (nextProps) => {
            if (nextProps.record.resId !== this.props.record.resId) {
                const regionCode = await this.keepLastRegion.add(this.getRegionCode(nextProps));
                if (regionCode === undefined) {
                    return;
                }
                this.state.disabled = !regionCode || !SUPPORTED_REGIONS_CODES.includes(regionCode);
            }
        });
    }

    get status() {
        return this.props.record.data.google_address_validation_status || 'not_validated';
    }

    get lastValidated() {
        const dt = this.props.record.data.google_address_validation_date;
        return dt && dt.isValid ? dt.toLocaleString(DateTime.DATETIME_MED) : '';
    }

    get statusLabel() {
        switch (this.status) {
            case 'valid':
                return _t('Validated');
            case 'needs_review':
                return _t('Needs Review');
            case 'invalid':
                return _t('Invalid');
            default:
                return _t('Not Validated');
        }
    }

    get statusClass() {
        switch (this.status) {
            case 'valid':
                return 'text-bg-success';
            case 'needs_review':
                return 'text-bg-warning';
            case 'invalid':
                return 'text-bg-danger';
            default:
                return 'text-bg-secondary';
        }
    }

    get statusIcon() {
        switch (this.status) {
            case 'valid':
                return 'fa-check-circle';
            case 'needs_review':
                return 'fa-question-circle';
            case 'invalid':
                return 'fa-exclamation-triangle';
            default:
                return 'fa-circle-o';
        }
    }

    get addressGranularity() {
        const granularity = this.props.record.data.google_address_validation_granularity || '';
        if (granularity) {
            return GRANULARITY_INFO[granularity] || _t('Granularity: Unknown');
        }
        return this.props.record.data.google_address_validation_status ? _t('Granularity: Unknown') : '';
    }

    /**
     * Resolves the ISO 3166-1 alpha-2 region code of the record's country.
     * Used only for the coverage-based disabled state of the widget.
     *
     * @returns {Promise<string>} Country code or empty string
     */
    async getRegionCode(props) {
        props = props || this.props;
        const countryId = extractMany2oneId(props.record.data.country_id);
        if (!countryId) {
            return '';
        }
        const rows = await this.ormService.read('res.country', [countryId], ['code']);
        return rows[0]?.code || '';
    }

    async onValidateClick() {
        if (this.state.busy) {
            return;
        }
        this.state.busy = true;
        try {
            const record = this.props.record;

            // The validation runs server-side against the stored record,
            // so pending edits must be persisted first.
            if (record.isNew || (await record.isDirty())) {
                const saved = await record.save();
                if (!saved) {
                    return;
                }
            }

            const { entered, result } = await this.ormService.call('res.partner', 'action_google_validate_address', [
                [record.resId],
            ]);

            this.dialogService.add(AddressValidationDialog, {
                enteredAddress: entered,
                result,
                onApply: (applyGoogleAddress) => this.applyResult(result, applyGoogleAddress),
            });
        } catch (error) {
            // UserErrors raised server-side (missing key, coverage,
            // transport, Google API errors) surface through Odoo's
            // standard RPC error dialog; anything else lands here.
            if (!error?.data) {
                console.error('Google Address Validation failed:', error);
                this.notificationService.add(_t('Address validation failed. Please try again.'), { type: 'danger' });
            } else {
                throw error;
            }
        } finally {
            this.state.busy = false;
        }
    }

    /**
     * Persists the validation outcome through the backend, then reloads
     * the form record.
     *
     * @param {Object} result - Normalized validation result
     * @param {boolean} applyGoogleAddress - Write the standardized address
     * @returns {Promise<void>}
     */
    async applyResult(result, applyGoogleAddress) {
        await this.ormService.call('res.partner', 'action_apply_google_address_validation', [
            [this.props.record.resId],
            result,
            applyGoogleAddress,
        ]);
        await this.props.record.load();
        this.notificationService.add(
            applyGoogleAddress
                ? _t("Google's standardized address has been applied.")
                : _t('The validation result has been saved.'),
            { type: 'success' }
        );
    }
}

export const googleAddressValidation = {
    component: GoogleAddressValidation,
    fieldDependencies: [
        { name: 'country_id', type: 'many2one' },
        { name: 'google_address_validation_status', type: 'selection' },
        { name: 'google_address_validation_granularity', type: 'selection' },
        { name: 'google_address_validation_date', type: 'datetime' },
    ],
};

registry.category('view_widgets').add('google_address_validation', googleAddressValidation);
