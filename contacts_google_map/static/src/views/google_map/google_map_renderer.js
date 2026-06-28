import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarContactAvatar } from './google_map_sidebar';

export class GoogleMapRendererContactAvatar extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarContactAvatar,
    };
    static templateInfoWindow = 'contacts_google_map.MarkerInfoWindow';

    /**
     * @override
     */
    prepareInfoWindowValues(record) {
        let values = super.prepareInfoWindowValues(record);
        values.avatarUrl = `/web/image/${record.resModel}/${record.resId}/${this.props.archInfo.sidebarAvatarField}`;
        return values;
    }

    /**
     * @override
     */
    get sidebarProps() {
        return Object.assign({}, super.sidebarProps, { fieldAvatar: this.props.archInfo.sidebarAvatarField });
    }
}
