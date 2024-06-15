/** @odoo-module **/

import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapRendererSales } from './google_map_renderer';
import { GoogleMapControllerSales } from './google_map_controller';

export const googleMapSalesView = {
    ...googleMapView,
    Renderer: GoogleMapRendererSales,
    Controller: GoogleMapControllerSales,
};

registry.category('views').add('google_map_sales', googleMapSalesView);
