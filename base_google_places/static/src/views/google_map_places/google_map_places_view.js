import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapPlacesRenderer } from './google_map_places_renderer';
import { GoogleMapPlacesController } from './google_map_controller';

export const googleMapPlacesView = {
    ...googleMapView,
    Renderer: GoogleMapPlacesRenderer,
    Controller: GoogleMapPlacesController,
};

registry.category('views').add('google_map_places', googleMapPlacesView);
