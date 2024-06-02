/** @odoo-module */
import { useModel } from '@web/views/model';
import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';

export class GoogleMapControllerSales extends GoogleMapController {
    setup() {
        super.setup();
        const { Model, resModel, fields, archInfo, limit, state } = this.props;
        const { rootState } = state || {};
        this.model = useModel(Model, {
            resId: this.props.resId || false,
            resIds: this.props.resIds,
            resModel,
            rootState,
            fields,
            activeFields: archInfo.activeFields,
            handleField: archInfo.handleField,
            limit: archInfo.limit || limit,
            onCreate: archInfo.onCreate,
            viewMode: 'google_map',
            multiEdit: this.multiEdit,
            defaultGroupBy: 'partner_id', // Hardcoded groupby to 'partner_id'
            openGroupsByDefault: true,
        });
    }
}