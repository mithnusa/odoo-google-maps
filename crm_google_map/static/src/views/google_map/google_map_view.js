/** @odoo-module **/

import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapRendererCRM } from './google_map_renderer';

export const googleMapCRMView = {
    ...googleMapView,
    Renderer: GoogleMapRendererCRM,
};

registry.category('views').add('google_map_crm', googleMapCRMView);
