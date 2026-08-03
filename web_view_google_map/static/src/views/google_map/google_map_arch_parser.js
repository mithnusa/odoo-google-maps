import { visitXML } from '@web/core/utils/xml';
import { Field } from '@web/views/fields/field';
import { stringToOrderBy } from '@web/search/utils/order_by';
import { getActiveActions, processButton } from '@web/views/utils';
import { exprToBoolean } from '@web/core/utils/strings';
import { GroupListArchParser } from '@web/views/list/list_arch_parser';

export class GoogleMapArchParser {
    get defaultLimit() {
        return 100;
    }

    get defaultGroupsLimit() {
        return 80;
    }

    processButton(node) {
        return processButton(node);
    }

    parse(xmlDoc, models, modelName) {
        const className = xmlDoc.getAttribute('class') || null;
        const jsClass = xmlDoc.getAttribute('js_class');

        const fields = models[modelName].fields;

        const groupListArchParser = new GroupListArchParser();

        const viewTitle = xmlDoc.getAttribute('string') || '';

        const fieldNodes = {};
        const googleMapAttr = {};
        const fieldNextIds = {};
        const creates = [];

        let nextId = 0;
        let buttonId = 0;
        let headerButtons = [];

        const columns = [];

        const groupBy = {
            buttons: {},
            fields: {},
        };

        visitXML(xmlDoc, (node) => {
            if (node.tagName === 'field') {
                const fieldInfo = Field.parseFieldNode(node, models, modelName, 'google_map', jsClass);
                if (!(fieldInfo.name in fieldNextIds)) {
                    fieldNextIds[fieldInfo.name] = 0;
                }
                const fieldId = `${fieldInfo.name}_${fieldNextIds[fieldInfo.name]++}`;
                fieldNodes[fieldId] = fieldInfo;
                node.setAttribute('field_id', fieldId);
                const label = fieldInfo.field.label;
                columns.push({
                    ...fieldInfo,
                    id: `column_${nextId++}`,
                    className: node.getAttribute('class'), // for oe_edit_only and oe_read_only
                    optional: node.getAttribute('optional') || false,
                    type: 'field',
                    hasLabel: !(exprToBoolean(fieldInfo.attrs.nolabel) || fieldInfo.field.noLabel),
                    label: (fieldInfo.widget && label && label.toString()) || fieldInfo.string,
                });
            } else if (node.tagName === 'control') {
                for (const childNode of node.children) {
                    if (childNode.tagName === 'button') {
                        creates.push({
                            type: 'button',
                            ...this.processButton(childNode),
                        });
                    } else if (childNode.tagName === 'create') {
                        creates.push({
                            type: 'create',
                            context: childNode.getAttribute('context'),
                            string: childNode.getAttribute('string'),
                        });
                    }
                }
                return false;
            } else if (node.tagName === 'groupby' && node.getAttribute('name')) {
                const fieldName = node.getAttribute('name');
                const coModelName = fields[fieldName].relation;
                const groupByArchInfo = groupListArchParser.parse(node, models, coModelName);
                groupBy.buttons[fieldName] = groupByArchInfo.buttons;
                groupBy.fields[fieldName] = {
                    fieldNodes: groupByArchInfo.fieldNodes,
                    fields: models[coModelName].fields,
                };
            } else if (node.tagName === 'header') {
                headerButtons = [...node.children].map((node) => ({
                    ...this.processButton(node),
                    type: 'button',
                    id: buttonId++,
                }));
                return false;
            } else if (node.tagName === 'google_map') {
                this.parseGoogleMapAttrs(xmlDoc, node, googleMapAttr);
            }
        });
        return {
            creates,
            columns,
            className,
            fieldNodes,
            headerButtons,
            viewTitle,
            xmlDoc,
            groupBy,
            ...googleMapAttr,
        };
    }

    mandatoryAttrs() {
        return ['sidebar_title', 'sidebar_subtitle'];
    }

    validateMandatoryAttrs(xmlDoc) {
        const requiredAttrs = this.mandatoryAttrs();
        if (requiredAttrs) {
            const missingAttrs = requiredAttrs.filter((attrName) => !xmlDoc.getAttribute(attrName));
            if (missingAttrs.length) {
                throw new Error(`Missing required attribute(s): ${missingAttrs.join(', ')}`);
            }
        }
    }

    /**
     * A google_map view locates records by lat/lng. Overridable (and
     * patchable — see web_view_google_map_drawing's arch parser) for
     * variants that locate records a different way.
     */
    hasValidGeoAttrs(xmlDoc) {
        return Boolean(xmlDoc.getAttribute('lat')) && Boolean(xmlDoc.getAttribute('lng'));
    }

    /** Paired with hasValidGeoAttrs() — kept separate so a subclass/patch can override just the message. */
    missingGeoAttrsMessage() {
        return 'Missing required attribute(s): lat, lng';
    }

    parseGoogleMapAttrs(xmlDoc, node, attrs) {
        this.validateMandatoryAttrs(xmlDoc);

        if (!this.hasValidGeoAttrs(xmlDoc)) {
            throw new Error(this.missingGeoAttrsMessage());
        }

        const activeActions = {
            ...getActiveActions(xmlDoc),
            exportXlsx: exprToBoolean(xmlDoc.getAttribute('export_xlsx'), true),
        };
        attrs.activeActions = activeActions;
        attrs.multiEdit = activeActions.edit ? exprToBoolean(node.getAttribute('multi_edit') || '') : false;

        const limitAttr = node.getAttribute('limit');
        const parsedLimit = limitAttr ? parseInt(limitAttr, 10) : null;
        attrs.limit = Number.isFinite(parsedLimit) ? parsedLimit : this.defaultLimit;

        const countLimitAttr = node.getAttribute('count_limit');
        const parsedCountLimit = countLimitAttr ? parseInt(countLimitAttr, 10) : null;
        attrs.countLimit = Number.isFinite(parsedCountLimit) ? parsedCountLimit : this.defaultLimit;

        const groupsLimitAttr = node.getAttribute('groups_limit');
        const parsedGroupsLimit = groupsLimitAttr ? parseInt(groupsLimitAttr, 10) : null;
        attrs.groupsLimit = Number.isFinite(parsedGroupsLimit) ? parsedGroupsLimit : null;

        attrs.defaultOrder = stringToOrderBy(xmlDoc.getAttribute('default_order') || null);

        // custom open action when clicking on record row
        const action = xmlDoc.getAttribute('action');
        const type = xmlDoc.getAttribute('type');
        attrs.openAction = action && type ? { action, type } : null;

        const mapId = xmlDoc.getAttribute('map_id');
        attrs.mapId = mapId;

        const markerColor = xmlDoc.getAttribute('color');
        attrs.__geoColor = markerColor;

        const latitudeField = xmlDoc.getAttribute('lat');
        attrs.latitudeField = latitudeField;

        const longitudeField = xmlDoc.getAttribute('lng');
        attrs.longitudeField = longitudeField;

        // getAttribute() returns null (not undefined) when the attribute is
        // absent; GoogleMapSidebar's title/subTitle props are optional
        // strings, and OWL's prop validator only treats undefined as "not
        // provided" — an explicit null still fails the String type check.
        attrs.sidebarTitleField = xmlDoc.getAttribute('sidebar_title') || undefined;
        attrs.sidebarSubtitleField = xmlDoc.getAttribute('sidebar_subtitle') || undefined;

        const onCreate = xmlDoc.getAttribute('on_create');
        attrs.onCreate = onCreate;

        const gestureHandling = xmlDoc.getAttribute('gesture_handling') || false;
        attrs.gestureHandling = gestureHandling || 'auto';

        const mapType = xmlDoc.getAttribute('map_type') || 'roadmap';
        attrs.mapType = mapType;

        const disableMarkerCluster = exprToBoolean(xmlDoc.getAttribute('disable_cluster_marker'), false);
        attrs.disableMarkerCluster = disableMarkerCluster;

        const defaultGroupBy = xmlDoc.getAttribute('default_group_by');
        attrs.defaultGroupBy = defaultGroupBy;

        // For performance reason, when defaultGroupBy is set and groupsLimit is not defined, we set default groupsLimit to avoid loading too many groups on the map.
        if (attrs.defaultGroupBy && !Number.isFinite(attrs.groupsLimit)) {
            attrs.groupsLimit = this.defaultGroupsLimit;
        }
    }
}
