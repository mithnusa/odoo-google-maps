/** @odoo-module **/

import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapDrawingRenderer } from './google_map_drawing_renderer';

export const googleMapDrawingView = {
    ...googleMapView,
    Renderer: GoogleMapDrawingRenderer,
};

registry.category('views').add('google_map_drawing', googleMapDrawingView);
