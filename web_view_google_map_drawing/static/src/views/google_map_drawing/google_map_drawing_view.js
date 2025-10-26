import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapDrawingArchParser } from './google_map_drawing_arch_parser';
import { GoogleMapDeckGLRenderer } from './google_map_deckgl_renderer';
import { GoogleMapDrawingController } from './google_map_drawing_controller';
import { GoogleMapDrawingModel } from './google_map_drawing_model';

export const googleMapDrawingView = {
    ...googleMapView,
    ArchParser: GoogleMapDrawingArchParser,
    Model: GoogleMapDrawingModel,
    Renderer: GoogleMapDeckGLRenderer,
    Controller: GoogleMapDrawingController,
    buttonTemplate: 'web_view_google_map_drawing.GoogleMapView.Buttons',
};

registry.category('views').add('google_map_drawing', googleMapDrawingView);
