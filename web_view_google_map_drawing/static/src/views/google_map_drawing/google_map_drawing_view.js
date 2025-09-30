import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
// import { GoogleMapDrawingRenderer } from './google_map_drawing_renderer';
import { GoogleMapDeckGLRenderer } from './google_map_deckgl_renderer';
// import { GoogleMapTerraDrawRenderer } from './google_map_terra_draw_renderer';
import { GoogleMapDrawingController } from './google_map_drawing_controller';
import { GoogleMapDrawingModel } from './google_map_drawing_model';

export const googleMapDrawingView = {
    ...googleMapView,
    Model: GoogleMapDrawingModel,
    Renderer: GoogleMapDeckGLRenderer,
    Controller: GoogleMapDrawingController,
    buttonTemplate: 'web_view_google_map_drawing.GoogleMapView.Buttons',
};

registry.category('views').add('google_map_drawing', googleMapDrawingView);
