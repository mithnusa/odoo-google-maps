import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';

export class GoogleMapControllerCRM extends GoogleMapController {
    get viewMapConfig() {
        return Object.assign(super.viewMapConfig, {
            expectedRevenue: 'expected_revenue',
            probability: 'probability',
            dateDeadline: 'date_deadline',
            partnerId: 'partner_id',
            userId: 'user_id',
        });
    }
}
