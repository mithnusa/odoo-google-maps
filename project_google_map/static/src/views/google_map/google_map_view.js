import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapRendererProject } from './google_map_renderer';

export const googleMapProjectView = {
    ...googleMapView,
    Renderer: GoogleMapRendererProject,
};

registry.category('views').add('google_map_project', googleMapProjectView);
