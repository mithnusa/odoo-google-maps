/** @odoo-module **/

import { visitXML } from '@web/core/utils/xml';
import { Field } from '@web/views/fields/field';
import { stringToOrderBy } from '@web/search/utils/order_by';
import { getActiveActions, archParseBoolean, processButton } from '@web/views/utils';

export class GoogleMapArchParser {
    parse(xmlDoc, models, modelName) {
        const className = xmlDoc.getAttribute('class') || null;
        const jsClass = xmlDoc.getAttribute('js_class');

        const viewTitle = xmlDoc.getAttribute('string') || 'Google Map';

        const fieldNodes = {};
        const googleMapAttr = {};
        const fieldNextIds = {};
        const creates = [];
        const groupBy = {
            buttons: {},
            fields: {},
        };

        let nextId = 0;
        const columns = [];

        visitXML(xmlDoc, (node) => {
            if (node.tagName === 'field') {
                const fieldInfo = Field.parseFieldNode(
                    node,
                    models,
                    modelName,
                    'google_map',
                    jsClass
                );
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
                    hasLabel: !(
                        archParseBoolean(fieldInfo.attrs.nolabel) || fieldInfo.field.noLabel
                    ),
                    label: (fieldInfo.widget && label && label.toString()) || fieldInfo.string,
                });
                return false;
            } else if (node.tagName === 'control') {
                for (const childNode of node.children) {
                    if (childNode.tagName === 'button') {
                        creates.push({
                            type: 'button',
                            ...processButton(childNode),
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
            } else if (node.tagName === 'google_map') {
                const activeActions = {
                    ...getActiveActions(xmlDoc),
                    exportXlsx: archParseBoolean(xmlDoc.getAttribute('export_xlsx'), true),
                };
                googleMapAttr.activeActions = activeActions;
                googleMapAttr.multiEdit = activeActions.edit
                    ? archParseBoolean(node.getAttribute('multi_edit') || '')
                    : false;

                const limitAttr = node.getAttribute('limit');
                googleMapAttr.limit = limitAttr && parseInt(limitAttr, 10);

                const countLimitAttr = node.getAttribute('count_limit');
                googleMapAttr.countLimit = countLimitAttr && parseInt(countLimitAttr, 10);

                googleMapAttr.defaultOrder = stringToOrderBy(
                    xmlDoc.getAttribute('default_order') || null
                );

                // custom open action when clicking on record row
                const action = xmlDoc.getAttribute('action');
                const type = xmlDoc.getAttribute('type');
                googleMapAttr.openAction = action && type ? { action, type } : null;

                const markerColor = xmlDoc.getAttribute('color');
                googleMapAttr.markerColor = markerColor;

                const markerIcon = xmlDoc.getAttribute('marker_icon');
                googleMapAttr.markerIcon = markerIcon;

                const markerIconScale = xmlDoc.getAttribute('icon_scale') || 1.0;
                googleMapAttr.markerIconScale = markerIconScale;

                const latitudeField = xmlDoc.getAttribute('lat');
                googleMapAttr.latitudeField = latitudeField;

                const longitudeField = xmlDoc.getAttribute('lng');
                googleMapAttr.longitudeField = longitudeField;

                const sidebarTitleField = xmlDoc.getAttribute('sidebar_title');
                googleMapAttr.sidebarTitleField = sidebarTitleField;

                const sidebarSubtitleField = xmlDoc.getAttribute('sidebar_subtitle');
                googleMapAttr.sidebarSubtitleField = sidebarSubtitleField;

                const onCreate = xmlDoc.getAttribute('on_create');
                googleMapAttr.onCreate = onCreate;

                const gestureHandling = xmlDoc.getAttribute('gesture_handling') || false;
                googleMapAttr.gestureHandling = gestureHandling;

                const disableMarkerCluster = archParseBoolean(
                    xmlDoc.getAttribute('disable_cluster_marker'),
                    false
                );
                googleMapAttr.disableMarkerCluster = disableMarkerCluster;
            }
        });
        return {
            creates,
            columns,
            className,
            fieldNodes,
            viewTitle,
            xmlDoc,
            ...googleMapAttr,
        };
    }
}
