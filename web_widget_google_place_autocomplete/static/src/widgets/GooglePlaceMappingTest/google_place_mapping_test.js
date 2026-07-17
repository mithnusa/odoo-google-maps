import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { ConfirmationDialog } from '@web/core/confirmation_dialog/confirmation_dialog';
import { renderToString } from '@web/core/utils/render';
import { Component, markup, props } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { GooglePlaceAutocompleteElement } from '../../component/google_place_autocomplete';

/**
 * Formats a string representation of an array into an actual array of strings
 * @param {string} str - String representation of an array (e.g., "['item1', 'item2',]")
 * @returns {string[]} Array of strings
 */
function formatStringToArray(str) {
    try {
        // Remove whitespace and newlines
        let cleaned = str.trim().replace(/\s+/g, ' ');

        // Replace single quotes with double quotes for valid JSON
        cleaned = cleaned.replace(/'/g, '"');

        // Remove trailing commas before closing brackets
        cleaned = cleaned.replace(/,(\s*])/g, '$1');

        // Parse as JSON
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('Failed to parse string to array:', error);
        return [];
    }
}

/**
 * Formats a string representation of an object into an actual object
 * @param {string} str - String representation of an object (e.g., "{ key1: 'value1', key2: 'value2' }")
 * @returns {Object} Parsed object
 */
function formatStringToObject(str) {
    try {
        // Remove extra whitespace and newlines
        let cleaned = str.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');

        // Replace single quotes with double quotes for valid JSON
        cleaned = cleaned.replace(/'/g, '"');

        // Add quotes around unquoted keys (only if not already quoted)
        // This handles cases like {key: "value"} -> {"key": "value"}
        cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

        // Remove trailing commas before closing brackets/braces
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

        // Parse as JSON
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('Failed to parse string to object:', error, 'Input:', str);
        return {};
    }
}

export class GooglePlaceMappingTestField extends Component {
    static template = 'web_widget_google_place_autocomplete.GooglePlacesMappingTestField';
    static components = { GooglePlaceAutocompleteElement };
    props = props({ ...standardFieldProps });

    setup() {
        this.notificationService = useService('notification');
        this.dialogService = useService('dialog');
        this.actionService = useService('action');
        this.widgetId = this.getWidgetId();
        this.config = this.getConfig();
    }

    async showValues(data) {
        try {
            const view = renderToString('web_widget_google_place_autocomplete.ViewMappingResult', {
                mode: this.props.record.data.mode,
                addressMappingResult: JSON.stringify(data.address, null, 2),
                otherMappingResult: JSON.stringify(data.other, null, 2),
                geoLocationResult: JSON.stringify(data.geolocation, null, 2),
                placeDetailsResult: JSON.stringify(data.placeJson, null, 2),
            });
            this.dialogService.add(ConfirmationDialog, {
                title: _t('Result'),
                size: 'md',
                body: markup(view),
                confirm: () => {},
                confirmLabel: _t('Close'),
            });
        } catch (error) {
            console.error('Failed to populate values from Google Place:', { error, data });
            this.notificationService.add(_t('Failed to populate address fields from Google Place. Please try again.'), {
                type: 'warning',
            });
        }
    }

    getWidgetId() {
        const { record, id } = this.props;
        return 'place-autocomplete-input-widget-' + record?.id.toString() + '-' + id.toString();
    }

    getConfig() {
        const config = {};
        const record = this.props.record || {};
        const data = record.data;

        config.id = this.props.record.resId;
        config.code = data.code || '';
        config.mode = data.mode || 'address';
        config.options = data.gplace_options ? formatStringToObject(data.gplace_options) : {};

        if (data.mode === 'address') {
            config.fields = data.gplace_address_fetch_fields
                ? formatStringToArray(data.gplace_address_fetch_fields)
                : [];
        } else {
            config.fields = data.gplace_place_fetch_fields ? formatStringToArray(data.gplace_place_fetch_fields) : [];
        }

        config.resModel = record.resModel || '';
        return config;
    }

    reloadTestPlaceAutocomplete() {
        return this.actionService.doAction({ type: 'ir.actions.client', tag: 'reload' });
    }
}

export const googlePlacesMappingTestField = {
    component: GooglePlaceMappingTestField,
    displayName: _t('Test Google Place Mapping'),
};

registry.category('fields').add('GoogleMappingTest', googlePlacesMappingTestField);
