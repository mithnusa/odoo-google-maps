import { _t } from '@web/core/l10n/translation';
import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';

export class GoogleMapControllerCRM extends GoogleMapController {
    openRecordScheduleActivity(record) {
        if (record) {
            const { other } = record.dataView || {};
            this.actionService.doAction({
                name: _t('Schedule Activity: %(title)s', { title: other?.title || '' }),
                type: 'ir.actions.act_window',
                res_model: 'mail.activity',
                views: [[false, 'form']],
                view_mode: 'form',
                res_id: false,
                target: 'new',
                context: {
                    default_res_id: record.resId,
                    default_res_model: record.resModel,
                },
            });
        }
    }

    showRecordScheduledActivity(record) {
        if (record) {
            const { resId, resModel } = record;
            this.actionService.doAction({
                name: _t('Scheduled Activities'),
                type: 'ir.actions.act_window',
                res_model: 'mail.activity',
                views: [[false, 'list']],
                view_mode: 'list',
                target: 'new',
                domain: [
                    ['res_id', '=', resId],
                    ['res_model', '=', resModel],
                ],
                context: {
                    default_res_id: resId,
                    default_res_model: resModel,
                    create: false,
                    list_view_ref: 'crm_google_map.mail_activity_view_list_activities_readonly',
                },
            });
        }
    }

    get rendererProps() {
        return Object.assign({}, super.rendererProps, {
            openRecordScheduleActivity: this.openRecordScheduleActivity.bind(this),
            showRecordScheduledActivity: this.showRecordScheduledActivity.bind(this),
        });
    }

    get viewMapConfig() {
        return Object.assign({}, super.viewMapConfig, {
            expectedRevenue: 'expected_revenue',
            probability: 'probability',
            dateDeadline: 'date_deadline',
            partnerId: 'partner_id',
            userId: 'user_id',
            stageId: 'stage_id',
            contactName: 'contact_name',
            partnerName: 'partner_name',
            phone: 'phone',
        });
    }
}
