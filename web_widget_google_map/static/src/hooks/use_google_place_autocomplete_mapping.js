import { _t } from '@web/core/l10n/translation';
import { useComponent } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';

const NOTIFICATION_CONFIG = {
    autoCloseDelay: 5000,
};

export function useGooglePlaceAutocompleteMapping(is_test = false) {
    const component = useComponent();
    const notificationService = useService('notification');

    function buildContext(additionalContext = {}) {
        return {
            widget_res_model: component.props?.record?.resModel,
            ...additionalContext,
        };
    }

    function showNotification(message, type = 'warning') {
        notificationService.add(message, {
            type,
            autocloseDelay: NOTIFICATION_CONFIG.autoCloseDelay,
        });
    }

    async function fetchMappingConfig(method, param, additionalContext = {}) {
        try {
            return await component.env.model.orm.call('google.places.mapping', method, [param], {
                context: buildContext(additionalContext),
            });
        } catch (error) {
            console.error('Failed to get mapping config:', {
                error,
                method,
                param,
                resModel: component.props?.record?.resModel,
            });
            showNotification(
                _t('Failed to retrieve mapping configuration. Please try again.'),
                'danger'
            );
            return {};
        }
    }

    async function getMappingConfigByCode(mappingCode) {
        return fetchMappingConfig('get_widget_mapping_by_code', mappingCode, { is_mapping_test: is_test });
    }

    async function getMappingConfigByMode(mappingMode) {
        return fetchMappingConfig('get_widget_mapping_by_mode', mappingMode);
    }

    async function parsePlace(placeJson, mappingCode) {
        if (!mappingCode) {
            showNotification(_t('Mapping code is required to parse the place.'));
            return {};
        }

        if (!placeJson || typeof placeJson !== 'object' || Object.keys(placeJson).length === 0) {
            showNotification(_t('Invalid place data provided.'));
            return {};
        }

        try {
            return await component.env.model.orm.call(
                'google.places.mapping',
                'parse_place',
                [placeJson, mappingCode],
                { context: buildContext() }
            );
        } catch (error) {
            console.error('Failed to parse place:', {
                error,
                mappingCode,
                resModel: component.props?.record?.resModel,
            });
            showNotification(_t('Failed to parse place data. Please try again.'), 'danger');
            return {};
        }
    }

    return {
        getMappingConfigByCode,
        getMappingConfigByMode,
        parsePlace,
    };
}
