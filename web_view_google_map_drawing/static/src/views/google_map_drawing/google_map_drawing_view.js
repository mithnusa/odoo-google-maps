import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapDrawingRenderer } from './google_map_drawing_renderer';
import { GoogleMapDrawingController } from './google_map_drawing_controller';
import { GoogleMapDrawingModel } from './google_map_drawing_model';

export const googleMapDrawingView = {
    ...googleMapView,
    Model: GoogleMapDrawingModel,
    Renderer: GoogleMapDrawingRenderer,
    Controller: GoogleMapDrawingController,
};

registry.category('views').add('google_map_drawing', googleMapDrawingView);
