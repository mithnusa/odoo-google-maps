import { t } from '@odoo/owl';
import { GoogleMapsDrawingSidebar } from '@web_view_google_map_drawing/views/google_map_drawing/google_map_drawing_sidebar';

export class GoogleMapSidebarProject extends GoogleMapsDrawingSidebar {
    static recordActionsTemplate = 'project_google_map.RecordActionsTemplate';
    static propsSchema = {
        ...GoogleMapsDrawingSidebar.propsSchema,
        onActionViewTask: t.function(),
    };
}
