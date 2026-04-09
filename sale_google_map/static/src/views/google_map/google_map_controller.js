/** @odoo-module */
import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';

export class GoogleMapControllerSales extends GoogleMapController {
    get modelParams() {
        const params = super.modelParams;
        const config = Object.assign(params.config, {
            openGroupsByDefault: true,
        });
        if (params.defaultGroupBy) {
            params.maxGroupByDepth = 1;
        }
        return Object.assign(params, { config });
    }
}
