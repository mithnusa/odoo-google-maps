/** @odoo-module */
import { _t } from '@web/core/l10n/translation';
import { patch } from '@web/core/utils/patch';
import { onRendered, useState } from '@odoo/owl';
import { FormController } from '@web/views/form/form_controller';
import { archParseBoolean } from '@web/views/utils';
import { WarningMissingGoogleMapFormViewDialog } from '../google_map_form/warning_missing_view_dialog/warning_missing_view_dialog';

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        this.state = useState({ ...this.state, showEditGeolocation: false });
        onRendered(() => {
            const js_class = this.archInfo.xmlDoc.getAttribute('js_class') || '';
            const editGeolocation = archParseBoolean(
                this.archInfo.xmlDoc.getAttribute('edit_lat_lng'),
                false
            );
            if (js_class === 'google_map_form') {
                this.state.showEditGeolocation = false;
            } else if (editGeolocation) {
                this.state.showEditGeolocation = true;
            }
        });
    },
    async editGeolocation() {
        const context = this.props.context;
        const googleMapFormViewRef = archParseBoolean(
            this.archInfo.xmlDoc.getAttribute('google_map_form_view_ref'),
            false
        );
        if (googleMapFormViewRef) {
            context['form_view_ref'] = googleMapFormViewRef;
            return this.model.action.doAction({
                name: _t('Edit Geolocation'),
                type: 'ir.actions.act_window',
                views: [[false, 'form']],
                view_mode: 'form',
                res_model: this.props.resModel,
                res_id: this.model.root.resId,
                target: 'new',
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
        return this.model.action.doAction({
            name: _t('Edit Geolocation'),
            type: 'ir.actions.act_window',
            views: [[viewId, 'form']],
            view_mode: 'form',
            res_model: this.props.resModel,
            res_id: this.model.root.resId,
            target: 'new',
            context,
        });
    },

    getStaticActionMenuItems() {
        const menuItems = super.getStaticActionMenuItems();
        menuItems.editGeolocation = {
            callback: () => this.editGeolocation(),
            description: _t('Geolocate'),
            icon: 'fa fa-map-marker',
            isAvailable: () => this.state.showEditGeolocation,
            sequence: 50,
        };
        return menuItems;
    },
});
