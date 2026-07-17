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


    parseFieldNode(node, models, modelName, fieldNextIds, fieldNodes) {
        const fieldInfo = Field.parseFieldNode(node, models, modelName, "google_map");
        if (!(fieldInfo.name in fieldNextIds)) {
            fieldNextIds[fieldInfo.name] = 0;
        }
        const fieldId = `${fieldInfo.name}_${fieldNextIds[fieldInfo.name]++}`;
        fieldNodes[fieldId] = fieldInfo;
        node.setAttribute("field_id", fieldId);
        const label = fieldInfo.field.label;
        return {
            ...fieldInfo,
            className: node.getAttribute("class"),
            optional: node.getAttribute("optional") || false,
            type: "field",
            fieldType: fieldInfo.type,
            label: (fieldInfo.widget && label && label.toString()) || fieldInfo.string,
        };
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
        const controls = [];

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
                const fieldDescriptor = this.parseFieldNode(
                    node,
                    models,
                    modelName,
                    fieldNextIds,
                    fieldNodes
                );
                if (fieldDescriptor.isHandle) {
                    handleField = fieldDescriptor.name;
                }
                columns.push({
                    ...fieldDescriptor,
                    id: `column_${nextId++}`,
                    hasLabel: !(
                        fieldDescriptor.field.label === false ||
                        exprToBoolean(fieldDescriptor.attrs.nolabel) === true
                    ),
                });
            } else if (node.tagName === 'control') {
                for (const childNode of node.children) {
                    if (childNode.tagName === "button") {
                        controls.push({
                            type: "button",
                            ...processButton(childNode),
                        });
                    } else if (childNode.tagName === "create") {
                        controls.push({
                            type: "create",
                            name: childNode.getAttribute("name"),
                            context: childNode.getAttribute("context"),
                            string: childNode.getAttribute("string"),
                            invisible: childNode.getAttribute("invisible"),
                            hotkey: childNode.getAttribute("data-hotkey"),
                        });
                    } else if (childNode.tagName === "delete") {
                        controls.push({
                            type: "delete",
                            invisible: childNode.getAttribute("invisible"),
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
            controls,
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

    parseGoogleMapAttrs(xmlDoc, node, attrs) {
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

        const sidebarTitleField = xmlDoc.getAttribute('sidebar_title');
        attrs.sidebarTitleField = sidebarTitleField;

        const sidebarSubtitleField = xmlDoc.getAttribute('sidebar_subtitle');
        attrs.sidebarSubtitleField = sidebarSubtitleField;

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
