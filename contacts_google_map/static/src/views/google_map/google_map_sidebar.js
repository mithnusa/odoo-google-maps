import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarContactAvatar extends GoogleMapSidebar {
    static props = { ...GoogleMapSidebar.props, fieldAvatar: { type: String } };
    static recordItemTemplate = 'contacts_google_map.RecordItemAvatar';

    getAvatarUrl(record) {
        const avatarUrl = `/web/image/${record.resModel}/${record.resId}/${this.props.fieldAvatar}`;
        return avatarUrl;
    }
}
