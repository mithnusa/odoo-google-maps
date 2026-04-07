import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarProject extends GoogleMapSidebar {
    static recordItemTemplate = 'project_google_map.RecordItem';
    static props = {
        ...GoogleMapSidebar.props,
        onActionViewTask: Function,
    };
}
