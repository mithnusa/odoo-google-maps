import { registry } from '@web/core/registry';
import { googleMapDrawingView } from '@web_view_google_map_drawing/views/google_map_drawing/google_map_drawing_view';
import { GoogleMapDeckGLRendererProject, GoogleMapDeckGLRendererTask } from './google_map_renderer';

export const googleMapDeckGLProjectView = {
    ...googleMapDrawingView,
    Renderer: GoogleMapDeckGLRendererProject,
};

export const googleMapDeckGLProjectTaskView = {
    ...googleMapDrawingView,
    Renderer: GoogleMapDeckGLRendererTask,
};

registry.category('views').add('google_map_drawing_project', googleMapDeckGLProjectView);
registry.category('views').add('google_map_drawing_project_task', googleMapDeckGLProjectTaskView);
