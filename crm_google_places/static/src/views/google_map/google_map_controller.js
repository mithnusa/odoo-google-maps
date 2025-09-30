import { GoogleMapPlacesController } from '@base_google_places/views/google_map_places/google_map_controller';

export class GoogleMapPlacesControllerCRM extends GoogleMapPlacesController {
    getViewMapConfig() {
        return Object.assign(super.getViewMapConfig(), {
            expectedRevenue: 'expected_revenue',
            probability: 'probability',
            dateDeadline: 'date_deadline',
            partnerId: 'partner_id',
            userId: 'user_id',
        });
    }
}
