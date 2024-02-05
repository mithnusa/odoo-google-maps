/** @odoo-module **/

import { addFieldDependencies, getActiveActions, archParseBoolean, processButton } from '@web/views/utils';
import { XMLParser } from '@web/core/utils/xml';
import { Field } from '@web/views/fields/field';

export class GoogleMapArchParser extends XMLParser {
    parse(arch, models, modelName) {
        const xmlDoc = this.parseXML(arch);
        const className = xmlDoc.getAttribute('class') || null;
        const limit = xmlDoc.getAttribute('limit');
        const jsClass = xmlDoc.getAttribute('js_class');
        const action = xmlDoc.getAttribute('action');
        const type = xmlDoc.getAttribute('type');
        const markerColor = xmlDoc.getAttribute('color');
        const markerIcon = xmlDoc.getAttribute('marker_icon');
        const markerIconScale = xmlDoc.getAttribute('icon_scale') || 1.0;
        const latitudeField = xmlDoc.getAttribute('lat');
        const longitudeField = xmlDoc.getAttribute('lng');
        const sidebarTitleField = xmlDoc.getAttribute('sidebar_title');
        const sidebarSubtitleField = xmlDoc.getAttribute('sidebar_subtitle');
        const onCreate = xmlDoc.getAttribute('on_create');
        const gestureHandling = xmlDoc.getAttribute('gesture_handling') || false;
        const disableMarkerCluster = archParseBoolean(
            xmlDoc.getAttribute('disable_cluster_marker'),
            false
        );

        const fieldNodes = {};

        const viewTitle = xmlDoc.getAttribute('string') || 'Google Map';

        const openAction = action && type ? { action, type } : null;
        const activeFields = {};

        const googleMapAttr = {};

        const columns = [];
        const creates = [];
        let nextId = 0;

        // Root level of the template
        this.visitXML(xmlDoc, (node) => {
            // Case: field node
            if (node.tagName === 'field') {
                const fieldInfo = Field.parseFieldNode(
                    node,
                    models,
                    modelName,
                    'google_map',
                    jsClass
                );
                const name = fieldInfo.name;
                fieldNodes[name] = fieldInfo;
                node.setAttribute('field_id', name);
                addFieldDependencies(
                    activeFields,
                    models[modelName],
                    fieldInfo.FieldComponent.fieldDependencies
                );
                if (this.isColumnVisible(fieldInfo.modifiers.column_invisible)) {
                    const label = fieldInfo.FieldComponent.label;
                    columns.push({
                        ...fieldInfo,
                        id: `column_${nextId++}`,
                        className: node.getAttribute('class'), // for oe_edit_only and oe_read_only
                        optional: node.getAttribute('optional') || false,
                        type: 'field',
                        hasLabel: !(fieldInfo.noLabel || fieldInfo.FieldComponent.noLabel),
                        label: (fieldInfo.widget && label && label.toString()) || fieldInfo.string,
                    });
                }
            } else if (node.tagName === "control") {
                for (const childNode of node.children) {
                    if (childNode.tagName === "button") {
                        creates.push({
                            type: "button",
                            ...processButton(childNode),
                        });
                    } else if (childNode.tagName === "create") {
                        creates.push({
                            type: "create",
                            context: childNode.getAttribute("context"),
                            string: childNode.getAttribute("string"),
                        });
                    }
                }
                return false;
            } else if (node.tagName === 'google_map') {
                const activeActions = {
                    ...getActiveActions(xmlDoc),
                    exportXlsx: archParseBoolean(xmlDoc.getAttribute('export_xlsx'), true),
                };
                googleMapAttr.activeActions = activeActions;
                googleMapAttr.multiEdit = activeActions.edit
                    ? archParseBoolean(node.getAttribute('multi_edit') || '')
                    : false;
                // custom open action when clicking on record row
                const action = xmlDoc.getAttribute('action');
                const type = xmlDoc.getAttribute('type');
                googleMapAttr.openAction = action && type ? { action, type } : null;
            }
        });

        for (const [key, field] of Object.entries(fieldNodes)) {
            activeFields[key] = field; // TODO process
        }

        return {
            arch,
            activeFields,
            creates,
            columns,
            className,
            fieldNodes,
            latitudeField,
            longitudeField,
            sidebarTitleField,
            sidebarSubtitleField,
            viewTitle,
            onCreate,
            openAction,
            gestureHandling,
            markerColor,
            markerIcon,
            markerIconScale,
            disableMarkerCluster,
            ...googleMapAttr,
            limit: limit && parseInt(limit, 10),
            examples: xmlDoc.getAttribute('examples'),
            __rawArch: arch,
        };
    }
    isColumnVisible(columnInvisibleModifier) {
        return columnInvisibleModifier !== true;
    }
}
