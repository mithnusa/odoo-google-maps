import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapRendererSaleOrder } from './google_map_renderer';
import { GoogleMapControllerSaleOrder } from './google_map_controller';

export const googleMapSaleOrderView = {
    ...googleMapView,
    Renderer: GoogleMapRendererSaleOrder,
    Controller: GoogleMapControllerSaleOrder,
};

registry.category('views').add('google_map_sale_order', googleMapSaleOrderView);
