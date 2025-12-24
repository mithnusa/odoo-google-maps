import { _t } from '@web/core/l10n/translation';
import { useComponent } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';

export function useGooglePlaceAutocompleteMapping(is_test = false) {
    const component = useComponent();
    const notificationService = component.notificationService || useService('notification');
    const localState = {};


    function getUniqueWidgetId() {
        const { record, id } = component.props;
        return 'place-autocomplete-input-widget-' + record?.id.toString() + '-' + id.toString();
    }

    function buildContext(additionalContext = {}) {
        return {
            widget_res_model: component.props?.record?.resModel,
            ...additionalContext,
        };
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
            notificationService(
                _t('Failed to retrieve mapping configuration. Please try again.'),
                { type: 'danger' }
            );
            return {};
        }
    }

    async function getMappingConfigByCode(mappingCode) {
        return await fetchMappingConfig('get_widget_mapping_by_code', mappingCode, { is_mapping_test: is_test });
    }

    async function getMappingConfigByMode(mappingMode) {
        return await fetchMappingConfig('get_widget_mapping_by_mode', mappingMode, { is_mapping_test: is_test });
    }

    async function getMappingConfig() {
        if (localState.mappingId) {
            return { ...localState };
        }

        const props = component.props || {};
        let mappingConfig = null;
        if (props.mappingCode) {
            mappingConfig = await getMappingConfigByCode(props.mappingCode);
        } else if (props.mappingMode) {
            mappingConfig = await getMappingConfigByMode(props.mappingMode);
        }
        if (mappingConfig) {
            localState.id = mappingConfig.mapping_id;
            localState.code = mappingConfig.mapping_code;
            localState.mode = mappingConfig.mapping_mode;
            localState.options = mappingConfig.gplace_options || {};
            localState.fields = mappingConfig.gplace_fetch_fields || [];
        }
        return { ...localState };
    }

    async function parsePlace(placeJson, mappingCode, streetNumber = {}) {
        if (!mappingCode) {
            notificationService(_t('Mapping code is required to parse the place.'), { type: 'warning' });
            return {};
        }

        if (!placeJson || typeof placeJson !== 'object' || Object.keys(placeJson).length === 0) {
            notificationService(_t('Invalid place data provided.'), { type: 'warning' });
            return {};
        }

        try {
            return await component.env.model.orm.call(
                'google.places.mapping',
                'parse_place',
                [placeJson, mappingCode, streetNumber],
                { context: buildContext() }
            );
        } catch (error) {
            console.error('Failed to parse place:', {
                error,
                mappingCode,
                resModel: component.props?.record?.resModel,
            });
            notificationService(_t('Failed to parse place data. Please try again.'), { type: 'danger' });
            return {};
        }
    }

    return {
        getMappingConfigByCode,
        getMappingConfigByMode,
        getMappingConfig,
        getUniqueWidgetId,
        parsePlace,
    };
}
