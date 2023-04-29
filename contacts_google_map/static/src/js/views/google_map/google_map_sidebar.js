/** @odoo-module **/

import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarContactAvatar extends GoogleMapSidebar {
    getData(record) {
        const avatarUrl = `/web/image/${record.resModel}/${record.resId}/${this.props.fieldAvatar}`;
        return Object.assign({ avatarUrl }, super.getData(record));
    }
}

GoogleMapSidebarContactAvatar.template = 'contacts_google_map.GoogleMapSidebarAvatar';
GoogleMapSidebarContactAvatar.props = [...GoogleMapSidebar.props, 'fieldAvatar'];
