/** @odoo-module **/

import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';

export class GoogleMapDrawingRenderer extends GoogleMapRenderer {
    setup() {
        super.setup();
        console.log(' GoogleMapDrawingRenderer ');
    }
}
