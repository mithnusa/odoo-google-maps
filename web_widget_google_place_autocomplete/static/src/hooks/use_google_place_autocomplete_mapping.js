import { useComponent } from '@web/owl2/utils';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';

/**
 * OWL hook that provides Google Places mapping configuration retrieval and
 * place data parsing for the Google Place Autocomplete widget.
 *
 * The mapping config is fetched from the `google.places.mapping` Python model
 * using either a mapping code (specific config) or a mapping mode (generic
 * config by type, e.g. 'address' or 'places'). The result is cached per
 * component instance after the first successful fetch. Concurrent calls to
 * `getMappingConfig` are deduplicated via a shared pending promise.
 *
 * @param {boolean} [isTest=false] - When true, fetches test mapping configuration.
 * @returns {{
 *   getMappingConfigByCode: function(string): Promise<Object|null>,
 *   getMappingConfigByMode: function(string): Promise<Object|null>,
 *   getMappingConfig: function(): Promise<Object|null>,
 *   getUniqueWidgetId: function(): string,
 *   parsePlace: function(Object, string, Object=): Promise<Object>,
 * }}
 */
export function useGooglePlaceAutocompleteMapping(isTest = false) {
    const component = useComponent();
    const notificationService = useService('notification');
    const ormService = useService('orm');
    const mappingCache = {};
    let _pendingFetch = null;

    /**
     * Returns a stable, unique DOM ID for this widget instance, derived from
     * the current record's ID or 'new' and the
     * field widget ID. Used to associate the autocomplete input with its
     * toggle element.
     *
     * @returns {string} A unique widget ID string.
     */
    function getUniqueWidgetId() {
        const { record, id } = component.props;
        const recordPart = record?.id || 'new';
        const _id = String(id || '');
        return 'place-autocomplete-input-widget-' + recordPart + '-' + _id;
    }

    /**
     * Builds the RPC context object, always including the current record's
     * model name so the backend can apply model-specific logic.
     *
     * @param {Object} [additionalContext={}] - Extra context keys to merge in.
     * @returns {Object} The merged RPC context.
     */
    function buildContext(additionalContext = {}) {
        return {
            widget_res_model: component.props?.record?.resModel,
            ...additionalContext,
        };
    }

    /**
     * Low-level helper that calls a method on `google.places.mapping` via ORM.
     * Shows a danger notification and returns `null` if the RPC fails.
     *
     * @param {string} method - The Python method name to call on `google.places.mapping`.
     * @param {*} param - The first positional argument passed to the method.
     * @param {Object} [additionalContext={}] - Extra context keys merged into the RPC context.
     * @returns {Promise<Object|null>} The method's return value, or `null` on error.
     */
    async function fetchMappingConfig(method, param, additionalContext = {}) {
        try {
            return await ormService.call('google.places.mapping', method, [param], {
                context: buildContext(additionalContext),
            });
        } catch (error) {
            console.error(error);
            notificationService.add(_t('Failed to retrieve mapping configuration. Please try again.'), {
                type: 'danger',
            });
            return null;
        }
    }

    /**
     * Fetches a mapping configuration by its unique code.
     * Passes the `isTest` flag so the backend can return test fixtures if needed.
     *
     * @param {string} mappingCode - The mapping code identifier.
     * @returns {Promise<Object|null>} The mapping config, or `null` on error.
     */
    async function getMappingConfigByCode(mappingCode) {
        return await fetchMappingConfig('get_widget_mapping_by_code', mappingCode, {
            is_mapping_test: isTest,
        });
    }

    /**
     * Fetches a mapping configuration by its mode (e.g. `'address'` or `'places'`).
     * Passes the `isTest` flag so the backend can return test fixtures if needed.
     *
     * @param {string} mappingMode - The mapping mode identifier.
     * @returns {Promise<Object|null>} The mapping config, or `null` on error.
     */
    async function getMappingConfigByMode(mappingMode) {
        return await fetchMappingConfig('get_widget_mapping_by_mode', mappingMode, {
            is_mapping_test: isTest,
        });
    }

    /**
     * Returns the mapping configuration for the current widget, using
     * `props.mappingCode` or `props.mappingMode` as the lookup key.
     *
     * Caching: the result is stored in `mappingCache` after the first successful
     * fetch. Subsequent calls return the cached value as long as the active
     * prop (`mappingCode` or `mappingMode`) has not changed.
     *
     * Deduplication: if a fetch is already in-flight, the same promise is
     * returned to all concurrent callers instead of issuing parallel RPC calls.
     *
     * @returns {Promise<Object|null>}
     *   - A config object `{ id, code, mode, options, fields }` on success.
     *   - `null` if neither `mappingCode` nor `mappingMode` is set on props,
     *     or if the fetch failed (a notification is already shown in that case).
     */
    async function getMappingConfig() {
        if (
            mappingCache.id &&
            ((component.props.mappingCode && mappingCache.code === component.props.mappingCode) ||
                (component.props.mappingMode && mappingCache.mode === component.props.mappingMode))
        ) {
            return { ...mappingCache };
        }
        if (_pendingFetch) {
            return _pendingFetch;
        }

        const props = component.props || {};
        _pendingFetch = (async () => {
            try {
                if (!props.mappingCode && !props.mappingMode) {
                    return null;
                }

                let mappingConfig = null;
                if (props.mappingCode) {
                    mappingConfig = await getMappingConfigByCode(props.mappingCode);
                } else if (props.mappingMode) {
                    mappingConfig = await getMappingConfigByMode(props.mappingMode);
                }

                if (mappingConfig === null) {
                    return null;
                }

                if (typeof mappingConfig === 'object') {
                    mappingCache.id = mappingConfig.mapping_id;
                    mappingCache.code = mappingConfig.mapping_code;
                    mappingCache.mode = mappingConfig.mapping_mode;
                    mappingCache.options = mappingConfig.gplace_options || {};
                    mappingCache.fields = mappingConfig.gplace_fetch_fields || [];
                    return { ...mappingCache };
                }

                return null;
            } finally {
                _pendingFetch = null;
            }
        })();

        return _pendingFetch;
    }

    /**
     * Sends a raw Google Places API response to the backend for parsing into
     * Odoo field values. Validates inputs before making the RPC call.
     *
     * @param {Object} placeJson - The raw place object returned by the Google Places API.
     * @param {string} mappingCode - The mapping code that defines how place components
     *   are mapped to Odoo fields.
     * @param {Object} [streetNumber={}] - Optional street number data to merge into
     *   the parsed address (used when the place result omits it).
     * @returns {Promise<Object>} A map of Odoo field names to parsed values,
     *   or `{}` if validation fails or an error occurs.
     */
    async function parsePlace(placeJson, mappingCode, streetNumber = {}) {
        if (!mappingCode) {
            notificationService.add(_t('Mapping code is required to parse the place.'), {
                type: 'warning',
            });
            return {};
        }

        if (!placeJson || typeof placeJson !== 'object' || Object.keys(placeJson).length === 0) {
            notificationService.add(_t('Invalid place data provided.'), { type: 'warning' });
            return {};
        }

        try {
            return await ormService.call(
                'google.places.mapping',
                'parse_place',
                [placeJson, mappingCode, streetNumber],
                { context: buildContext() }
            );
        } catch (error) {
            console.error(error);
            notificationService.add(_t('Failed to parse place data. Please try again.'), {
                type: 'danger',
            });
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
