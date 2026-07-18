import { t } from '@odoo/owl';
import { GoogleMapSidebar, googleMapSidebarProps } from '@web_view_google_map/views/google_map/google_map_sidebar';

const projectSidebarProps = {
    ...googleMapSidebarProps,
    onActionViewTask: t.function(),
};

export class GoogleMapSidebarProject extends GoogleMapSidebar {
    static recordActionsTemplate = 'project_google_map.RecordActionsTemplate';
    static props = projectSidebarProps;
}
