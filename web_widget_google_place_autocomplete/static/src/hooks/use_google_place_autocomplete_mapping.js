import { _t } from '@web/core/l10n/translation';
import { useComponent } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';

export function useGooglePlaceAutocompleteMapping(isTest = false) {
    const component = useComponent();
    const notificationService = component.notificationService || useService('notification');
    const mappingCache = {};
    let _pendingFetch = null;

    function getUniqueWidgetId() {
        const { record, id } = component.props;
        const recordPart = record?.resId || record?.virtualId || 'new';
        return 'place-autocomplete-input-widget-' + recordPart + '-' + id.toString();
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
            notificationService.add(
                _t('Failed to retrieve mapping configuration. Please try again.'),
                { type: 'danger' }
            );
            return null;
        }
    }

    async function getMappingConfigByCode(mappingCode) {
        return await fetchMappingConfig('get_widget_mapping_by_code', mappingCode, { is_mapping_test: isTest });
    }

    async function getMappingConfigByMode(mappingMode) {
        return await fetchMappingConfig('get_widget_mapping_by_mode', mappingMode, { is_mapping_test: isTest });
    }

    async function getMappingConfig() {
        if (mappingCache.id) {
            return { ...mappingCache };
        }
        if (_pendingFetch) {
            return _pendingFetch;
        }

        const props = component.props || {};
        _pendingFetch = (async () => {
            try {
                let mappingConfig = null;
                if (props.mappingCode) {
                    mappingConfig = await getMappingConfigByCode(props.mappingCode);
                } else if (props.mappingMode) {
                    mappingConfig = await getMappingConfigByMode(props.mappingMode);
                }
                if (mappingConfig) {
                    mappingCache.id = mappingConfig.mapping_id;
                    mappingCache.code = mappingConfig.mapping_code;
                    mappingCache.mode = mappingConfig.mapping_mode;
                    mappingCache.options = mappingConfig.gplace_options || {};
                    mappingCache.fields = mappingConfig.gplace_fetch_fields || [];
                }
                return { ...mappingCache };
            } finally {
                _pendingFetch = null;
            }
        })();

        return _pendingFetch;
    }

    async function parsePlace(placeJson, mappingCode, streetNumber = {}) {
        if (!mappingCode) {
            notificationService.add(_t('Mapping code is required to parse the place.'), { type: 'warning' });
            return {};
        }

        if (!placeJson || typeof placeJson !== 'object' || Object.keys(placeJson).length === 0) {
            notificationService.add(_t('Invalid place data provided.'), { type: 'warning' });
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
            notificationService.add(_t('Failed to parse place data. Please try again.'), { type: 'danger' });
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
