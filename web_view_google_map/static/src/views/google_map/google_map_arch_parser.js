/** @odoo-module **/

import { addFieldDependencies, getActiveActions } from '@web/views/utils';
import { XMLParser } from '@web/core/utils/xml';
import { Field } from '@web/views/fields/field';
import { Widget } from '@web/views/widgets/widget';
import { KANBAN_BOX_ATTRIBUTE } from '@web/views/kanban/kanban_arch_parser';

export class GoogleMapArchParser extends XMLParser {
    parse(arch, models, modelName) {
        const xmlDoc = this.parseXML(arch);
        const className = xmlDoc.getAttribute('class') || null;
        const limit = xmlDoc.getAttribute('limit');

        const activeActions = {
            ...getActiveActions(xmlDoc),
        };

        const onCreate = xmlDoc.getAttribute('on_create');

        let handleField = null;
        const fieldNodes = {};
        const jsClass = xmlDoc.getAttribute('js_class');
        const action = xmlDoc.getAttribute('action');
        const type = xmlDoc.getAttribute('type');
        const latitudeField = xmlDoc.getAttribute('lat');
        const longitudeField = xmlDoc.getAttribute('lng');
        const sidebarTitleField = xmlDoc.getAttribute('sidebar_title');
        const sidebarSubtitleField = xmlDoc.getAttribute('sidebar_subtitle');
        const viewTitle = xmlDoc.getAttribute('string') || 'Google Map';

        const openAction = action && type ? { action, type } : null;
        const templateDocs = {};
        const activeFields = {};

        // Root level of the template
        this.visitXML(xmlDoc, (node) => {
            if (node.hasAttribute('t-name')) {
                templateDocs[node.getAttribute('t-name')] = node;
                return;
            }
            // Case: field node
            if (node.tagName === 'field') {
                // In kanban, we display many2many fields as tags by default
                const widget = node.getAttribute('widget');
                if (!widget && models[modelName][node.getAttribute('name')].type === 'many2many') {
                    node.setAttribute('widget', 'many2many_tags');
                }
                const fieldInfo = Field.parseFieldNode(node, models, modelName, 'google_map', jsClass);
                if (!node.hasAttribute('force_save')) {
                    // Force save is true by default on kanban views:
                    // this allows to write on any field regardless of its modifiers.
                    fieldInfo.forceSave = true;
                }
                const name = fieldInfo.name;
                fieldNodes[name] = fieldInfo;
                node.setAttribute('field_id', name);
                if (fieldInfo.options.group_by_tooltip) {
                    tooltipInfo[name] = fieldInfo.options.group_by_tooltip;
                }
                if (fieldInfo.widget === 'handle') {
                    handleField = name;
                }
                addFieldDependencies(activeFields, models[modelName], fieldInfo.FieldComponent.fieldDependencies);
            }
            if (node.tagName === 'widget') {
                const { WidgetComponent } = Widget.parseWidgetNode(node);
                addFieldDependencies(activeFields, models[modelName], WidgetComponent.fieldDependencies);
            }

            // Keep track of last update so images can be reloaded when they may have changed.
            if (node.tagName === 'img') {
                const attSrc = node.getAttribute('t-att-src');
                if (attSrc && /\bkanban_image\b/.test(attSrc) && !fieldNodes.__last_update) {
                    fieldNodes.__last_update = { type: 'datetime' };
                }
            }
        });

        // Concrete kanban box elements in the template
        const cardDoc = templateDocs[KANBAN_BOX_ATTRIBUTE];
        if (!cardDoc) {
            throw new Error(`Missing '${KANBAN_BOX_ATTRIBUTE}' template.`);
        }

        for (const [key, field] of Object.entries(fieldNodes)) {
            activeFields[key] = field; // TODO process
        }

        return {
            arch,
            activeActions,
            activeFields,
            className,
            fieldNodes,
            handleField,
            latitudeField,
            longitudeField,
            sidebarTitleField,
            sidebarSubtitleField,
            viewTitle,
            onCreate,
            openAction,
            limit: limit && parseInt(limit, 10),
            templateDocs,
            examples: xmlDoc.getAttribute('examples'),
            __rawArch: arch,
        };
    }
}
