import { Component, useState } from '@odoo/owl';
import { _t } from '@web/core/l10n/translation';
import { Dialog } from '@web/core/dialog/dialog';

/**
 * Recommendation identifiers, aligned with Google's "build your validation
 * logic" guidance (accept / confirm / fix). The recommendation itself is
 * computed server-side by `google.address.validation`; these constants
 * only drive the dialog rendering.
 * @see https://developers.google.com/maps/documentation/javascript/address-validation/build-validation-logic
 */
export const RECOMMENDATIONS = {
    ACCEPT: 'ACCEPT',
    CONFIRM: 'CONFIRM',
    FIX: 'FIX',
};

/**
 * Dialog presenting the result of a Google Address Validation request.
 *
 * Shows the verdict summary with a recommendation, a side-by-side comparison
 * of the entered address and Google's standardized address, and a
 * component-level breakdown with confirmation levels. The user can apply
 * Google's standardized address, keep the entered address (storing only the
 * verdict), or discard the result entirely.
 */
export class AddressValidationDialog extends Component {
    static template = 'contacts_google_address_validation.AddressValidationDialog';
    static components = { Dialog };
    static props = {
        close: Function,
        enteredAddress: { type: String },
        result: { type: Object },
        onApply: { type: Function }, // async (applyGoogleAddress: boolean) => void
    };

    setup() {
        this.state = useState({ busy: false });
    }

    get dialogTitle() {
        return _t('Google Address Validation');
    }

    get verdict() {
        return this.props.result.verdict || {};
    }

    get recommendation() {
        return this.props.result.recommendation;
    }

    get recommendationInfo() {
        switch (this.recommendation) {
            case RECOMMENDATIONS.ACCEPT:
                return {
                    class: 'alert-success',
                    icon: 'fa-check-circle',
                    title: _t('Address is valid'),
                    message: _t('Google validated this address. You can safely apply the standardized version.'),
                };
            case RECOMMENDATIONS.CONFIRM:
                return {
                    class: 'alert-warning',
                    icon: 'fa-question-circle',
                    title: _t('Confirmation recommended'),
                    message: _t(
                        'Google could not confirm every part of this address. Review the components below before applying.'
                    ),
                };
            default:
                return {
                    class: 'alert-danger',
                    icon: 'fa-exclamation-triangle',
                    title: _t('Address may be wrong'),
                    message: this.props.result.missingComponentTypes?.length
                        ? _t(
                              'Google flagged this address as likely undeliverable because required information is missing (see below). Complete the entered address, then validate again.'
                          )
                        : _t(
                              'Google could not validate this address. Check the entered address and fix the highlighted components.'
                          ),
                };
        }
    }

    /**
     * Returns a badge object for a component confirmation level, including label, help text, and CSS class.
     * @param {*} component
     * @returns {{label: string, help: string, class: string}} Badge object
     */
    componentBadge(component) {
        const level = String(component.confirmationLevel || '').toUpperCase();
        if (level === 'CONFIRMED') {
            return {
                label: _t('Confirmed'),
                help: _t('Google confirmed this %(componentType)s as valid.', { componentType: component.type }),
                class: 'text-bg-success',
            };
        }
        if (level === 'UNCONFIRMED_BUT_PLAUSIBLE') {
            return {
                label: _t('Plausible'),
                help: _t('Google could not confirm this %(componentType)s, but it appears plausible.', {
                    componentType: component.type,
                }),
                class: 'text-bg-warning',
            };
        }
        if (level === 'UNCONFIRMED_AND_SUSPICIOUS') {
            return {
                label: _t('Suspicious'),
                help: _t('Google could not confirm this %(componentType)s, and it appears suspicious.', {
                    componentType: component.type,
                }),
                class: 'text-bg-danger',
            };
        }
        return {
            label: _t('Unknown'),
            help: _t('Google did not provide a confirmation level for this %(componentType)s.', {
                componentType: component.type,
            }),
            class: 'text-bg-secondary',
        };
    }

    get usps() {
        return this.props.result.uspsData || null;
    }

    /**
     * Returns display info for the USPS DPV (Delivery Point Validation)
     * confirmation code.
     *
     * Codes: Y = confirmed deliverable; S = confirmed by dropping the
     * secondary number; D = confirmed but secondary number missing;
     * N = not confirmed.
     *
     * @returns {{class: string, label: string}|null}
     */
    get dpvInfo() {
        const code = String(this.usps?.dpvConfirmation || '').toUpperCase();
        switch (code) {
            case 'Y':
                return {
                    class: 'text-bg-success',
                    label: _t('DPV: Deliverable (Y)'),
                    help: _t('The USPS confirmed that this address is deliverable.'),
                };
            case 'S':
                return {
                    class: 'text-bg-warning',
                    label: _t('DPV: Deliverable, secondary number dropped (S)'),
                    help: _t(
                        'The USPS confirmed that this address is deliverable, but the secondary number was dropped.'
                    ),
                };
            case 'D':
                return {
                    class: 'text-bg-warning',
                    label: _t('DPV: Missing secondary number (D)'),
                    help: _t(
                        'The USPS confirmed that this address is deliverable, but the secondary number is missing.'
                    ),
                };
            case 'N':
                return {
                    class: 'text-bg-danger',
                    label: _t('DPV: Not deliverable (N)'),
                    help: _t('The USPS confirmed that this address is not deliverable.'),
                };
            default:
                return code
                    ? {
                          class: 'text-bg-secondary',
                          label: _t('DPV: %s', code),
                          title: _t('Unknown USPS DPV confirmation code'),
                      }
                    : null;
        }
    }

    async onApplyGoogleAddress() {
        await this._apply(true);
    }

    async onKeepEnteredAddress() {
        await this._apply(false);
    }

    async _apply(applyGoogleAddress) {
        if (this.state.busy) {
            return;
        }
        this.state.busy = true;
        try {
            await this.props.onApply(applyGoogleAddress);
            this.props.close();
        } finally {
            this.state.busy = false;
        }
    }

    onDiscard() {
        this.props.close();
    }
}
