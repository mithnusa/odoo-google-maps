import { t } from '@odoo/owl';
import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarContactAvatar extends GoogleMapSidebar {
    static recordItemTemplate = 'contacts_google_map.RecordItemAvatar';
    static propsSchema = {
        ...GoogleMapSidebar.propsSchema,
        fieldAvatar: t.string(),
    };

    getAvatarUrl(record) {
        const avatarUrl = `/web/image/${record.resModel}/${record.resId}/${this.props.fieldAvatar}`;
        return avatarUrl;
    }
}
