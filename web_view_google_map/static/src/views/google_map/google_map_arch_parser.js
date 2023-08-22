/** @odoo-module **/

import { addFieldDependencies, getActiveActions } from '@web/views/utils';
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

        const activeActions = {
            ...getActiveActions(xmlDoc),
        };

        const fieldNodes = {};

        const viewTitle = xmlDoc.getAttribute('string') || 'Google Map';

        const openAction = action && type ? { action, type } : null;
        const activeFields = {};

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
            }
        });

        for (const [key, field] of Object.entries(fieldNodes)) {
            activeFields[key] = field; // TODO process
        }

        return {
            arch,
            activeActions,
            activeFields,
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
            limit: limit && parseInt(limit, 10),
            examples: xmlDoc.getAttribute('examples'),
            __rawArch: arch,
        };
    }
}
