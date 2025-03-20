import { _t } from '@web/core/l10n/translation';
import { markup } from "@odoo/owl";
import { sprintf } from '@web/core/utils/strings';
import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';

export class GoogleMapPlacesController extends GoogleMapController {
    static template = 'base_google_places.GoogleMapView';

    async createNewRecordFromPlaces(values) {
        let action = null;
        const display_name = values.default_name || values.name;
        const context = Object.assign({}, this.props.context, values);
        if (this.actionService.currentController) {
            const form_view = this.actionService.currentController.action.views.filter(
                (view) => view[1] == 'form'
            );
            if (form_view.length > 0) {
                action = {
                    name: sprintf(_t('New Place: %s'), display_name),
                    type: 'ir.actions.act_window',
                    res_model: this.model.root.resModel,
                    views: form_view,
                    view_mode: 'form',
                    target: 'new',
                    context,
                };
            }
        } else {
            action = {
                name: sprintf(_t('New Place: %s'), display_name),
                type: 'ir.actions.act_window',
                res_model: this.model.root.resModel,
                views: [[false, 'form']],
                view_mode: 'form',
                target: 'new',
                context,
            };
        }

        if (action) {
            this.model.action.doAction(action, {
                props: {
                    onSave: async (record, params) => {
                        await this.model.load();
                        this.model.notify();
                        this.model.action.doAction({ type: 'ir.actions.act_window_close' });
                        this.notificationService.add(_t('New record is created successfully'), {
                            type: 'info',
                            autocloseDelay: 5000,
                            sticky: false,
                            buttons: [{
                                name: 'Open',
                                onClick: async () => {
                                    this.openRecord(record);
                                },
                            }]
                        });
                    },
                },
            });
        }
    }
}
