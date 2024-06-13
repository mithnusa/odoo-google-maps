/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { X2ManyField, x2ManyField } from '@web/views/fields/x2many/x2many_field';
import { GoogleMapRenderer } from '../../views/google_map/google_map_renderer';

export class X2ManyFieldGoogleMapField extends X2ManyField {
    static components = { ...X2ManyField.components, GoogleMapRenderer };
    static template = 'web_view_google_map.X2ManyFieldGoogleMap';

    setup() {
        super.setup();
        const { creates } = this.archInfo;
        if (this.props.viewMode === 'google_map') {
            this.creates = creates.length
                ? creates
                : [
                      {
                          type: 'create',
                          string: this.props.addLabel || _t('Add'),
                          class: 'o-kanban-button-new',
                      },
                  ];
        }
    }

    get rendererProps() {
        if (this.props.viewMode === 'google_map') {
            const { archInfo } = this;
            if (!archInfo.gestureHandling) {
                archInfo.gestureHandling = 'cooperative';
                archInfo.allowSelectors = false;
            }
            const props = {
                archInfo,
                list: this.list,
                openRecord: this.openRecord.bind(this),
                showRecord: this.openRecord.bind(this),
                allowSelectors: false,
                readonly: this.props.readonly,
            };
            return props;
        }
        return super.rendererProps;
    }

    get displayControlPanelButtons() {
        return (
            this.props.viewMode === 'google_map' &&
            ('link' in this.activeActions ? this.activeActions.link : this.activeActions.create) &&
            !this.props.readonly
        );
    }

    centerMap() {
        this.render(true);
    }
}

export const x2ManyFieldGoogleMapField = {
    ...x2ManyField,
    component: X2ManyFieldGoogleMapField,
};

registry.category('fields').add('google_map_one2many', x2ManyFieldGoogleMapField);
registry.category('fields').add('google_map_many2many', x2ManyFieldGoogleMapField);
