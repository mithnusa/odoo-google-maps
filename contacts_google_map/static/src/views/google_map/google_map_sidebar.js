/** @odoo-module **/

import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarContactAvatar extends GoogleMapSidebar {
    static template = 'contacts_google_map.GoogleMapSidebarAvatar';
    static props = [...GoogleMapSidebar.props, 'fieldAvatar'];
    getData(record) {
        const avatarUrl = `/web/image/${record.resModel}/${record.resId}/${this.props.fieldAvatar}`;
        return Object.assign({ avatarUrl }, super.getData(record));
    }
}
