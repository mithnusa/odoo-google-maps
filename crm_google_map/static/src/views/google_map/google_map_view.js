import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapRendererCRM } from './google_map_renderer';
import { GoogleMapControllerCRM } from './google_map_controller';

export const googleMapCRMView = {
    ...googleMapView,
    Renderer: GoogleMapRendererCRM,
    Controller: GoogleMapControllerCRM,
};

registry.category('views').add('google_map_crm', googleMapCRMView);
