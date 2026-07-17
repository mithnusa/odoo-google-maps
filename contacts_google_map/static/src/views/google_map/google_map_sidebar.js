import { t } from '@odoo/owl';
import { GoogleMapSidebar, googleMapSidebarProps } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarContactAvatar extends GoogleMapSidebar {
    static recordItemTemplate = 'contacts_google_map.RecordItemAvatar';
    // Schema extension via static — the base class binds this.constructor.props
    static props = { ...googleMapSidebarProps, fieldAvatar: t.string() };

    getAvatarUrl(record) {
        const avatarUrl = `/web/image/${record.resModel}/${record.resId}/${this.props.fieldAvatar}`;
        return avatarUrl;
    }
}
