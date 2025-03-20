import { Domain } from '@web/core/domain';
import { GoogleMapModel } from '@web_view_google_map/views/google_map/google_map_model';


export class GoogleMapDrawingModel extends GoogleMapModel {
    /**
     * @override
     */
    get mapDomain() {
        if (this.viewConfig && this.viewConfig.shapePaths) {
            return [[this.viewConfig.shapePaths, '!=', false]];
        }
    }
}
