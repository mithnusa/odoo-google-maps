/** @odoo-module **/

import { registry } from '@web/core/registry';
import { googleMapPlacesView } from '@base_google_places/views/google_map_places/google_map_places_view';
import { GoogleMapPlacesRendererCRM } from './google_map_renderer';

export const googleMapPlacesCRMView = {
    ...googleMapPlacesView,
    Renderer: GoogleMapPlacesRendererCRM,
};

registry.category('views').add('google_map_places_crm', googleMapPlacesCRMView);
