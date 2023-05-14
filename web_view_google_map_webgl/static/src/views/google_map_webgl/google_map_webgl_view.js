/** @odoo-module **/

import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapWebGLRenderer } from './google_map_webgl_renderer';

export const googleMapWebGLView = {
    ...googleMapView,
    Renderer: GoogleMapWebGLRenderer,
};

registry.category('views').add('google_map_webgl', googleMapWebGLView);
