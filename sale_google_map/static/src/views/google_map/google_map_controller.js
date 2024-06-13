/** @odoo-module */
import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';

export class GoogleMapControllerSales extends GoogleMapController {
    get modelParams() {
        const params = super.modelParams;
        const config = Object.assign(params.config, {
            openGroupsByDefault: true,
        });
        return Object.assign(params, {
            config,
            defaultGroupBy: 'partner_id',
            maxGroupByDepth: 1,
        });
    }
}
