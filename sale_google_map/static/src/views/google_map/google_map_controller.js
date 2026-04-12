import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';

export class GoogleMapControllerSaleOrder extends GoogleMapController {
    get modelParams() {
        const params = super.modelParams;
        if (params.defaultGroupBy) {
            params.maxGroupByDepth = 1;
            params.config = Object.assign({}, params.config, {
                openGroupsByDefault: true,
            });
        }
        return params;
    }
}
