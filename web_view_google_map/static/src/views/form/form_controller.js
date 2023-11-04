/** @odoo-module */

import { patch } from '@web/core/utils/patch';
import { useService } from '@web/core/utils/hooks';
import { onRendered, useState } from '@odoo/owl';
import { FormController } from '@web/views/form/form_controller';
import { WarningMissingGoogleMapFormViewDialog } from '../google_map_form/warning_missing_view_dialog/warning_missing_view_dialog';

patch(FormController.prototype, 'web_view_google_map', {
    setup() {
        this._super();
        this.state = useState({ ...this.state, showEditGeolocation: false });
        this.actionService = useService('action');
        onRendered(() => {
            const js_class = this.archInfo.xmlDoc.getAttribute('js_class') || '';
            if (js_class === 'google_map_form') {
                this.state.showEditGeolocation = false;
            } else if (this.archInfo.activeActions.editGeolocation) {
                this.state.showEditGeolocation = true;
            }
        });
    },
    async editGeolocation() {
        const context = this.props.context;
        if (this.props.archInfo.googleMapFormViewRef) {
            context['form_view_ref'] = this.props.archInfo.googleMapFormViewRef;
            return this.model.actionService.doAction({
                name: this.env._t('Edit Geolocation'),
                type: 'ir.actions.act_window',
                views: [[false, 'form']],
                view_mode: 'form',
                res_model: this.props.resModel,
                res_id: this.model.root.data.id,
                target: 'current',
                context,
            });
        }
        const viewId = await this.model.orm.call('ir.ui.view', 'get_google_form_view_id', [], {
            model_name: this.props.resModel,
            context,
        });
        if (!viewId) {
            this.dialogService.add(WarningMissingGoogleMapFormViewDialog, {});
            return;
        }
        this.model.actionService.doAction({
            name: this.env._t('Edit Geolocation'),
            type: 'ir.actions.act_window',
            views: [[viewId, 'form']],
            view_mode: 'form',
            res_model: this.props.resModel,
            res_id: this.model.root.data.id,
            target: 'current',
            context,
        });
    },
});
