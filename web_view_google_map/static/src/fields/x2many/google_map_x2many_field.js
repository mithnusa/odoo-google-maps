/** @odoo-module **/

import { registry } from '@web/core/registry';
import { X2ManyField } from '@web/views/fields/x2many/x2many_field';
import { GoogleMapRenderer } from '../../views/google_map/google_map_renderer';

export class X2ManyFieldGoogleMap extends X2ManyField {
    get rendererProps() {
        if (this.viewMode === 'google_map') {
            const archInfo = this.activeField.views[this.viewMode];
            if (!archInfo.gestureHandling) {
                archInfo.gestureHandling = 'cooperative';
            }
            const props = {
                archInfo,
                list: this.list,
                openRecord: this.openRecord.bind(this),
                showRecord: this.openRecord.bind(this),
            };
            props.readonly = this.props.readonly;
            return props;
        }
        return super.rendererProps;
    }

    get displayAddButton() {
        return (
            ['kanban', 'google_map'].indexOf(this.viewMode) >= 0 &&
            ('link' in this.activeActions
                ? this.activeActions.link
                : this.activeActions.create) &&
            !this.props.readonly
        );
    }

    centerMap() {
        this.render(true);
    }
}

X2ManyFieldGoogleMap.components = { ...X2ManyField.components, GoogleMapRenderer };
X2ManyFieldGoogleMap.template = 'web_view_google_map.X2ManyFieldGoogleMap';

registry.category('fields').add('google_map_one2many', X2ManyFieldGoogleMap);
registry.category('fields').add('google_map_many2many', X2ManyFieldGoogleMap);
