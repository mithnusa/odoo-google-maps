/** @odoo-module **/

import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapPlacesRenderer } from './google_map_places_renderer';

export const googleMapPlacesView = {
    ...googleMapView,
    Renderer: GoogleMapPlacesRenderer,
};

registry.category('views').add('google_map_places', googleMapPlacesView);
