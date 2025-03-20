import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';

export class GoogleMapControllerCRM extends GoogleMapController {
    getViewMapConfig() {
        return Object.assign(super.getViewMapConfig(), {
            expectedRevenue: 'expected_revenue',
            probability: 'probability',
            dateDeadline: 'date_deadline',
        });
    }
}
