import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarContactAvatar } from './google_map_sidebar';

export class GoogleMapRendererContactAvatar extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarContactAvatar,
    };

    /**
     * @override
     */
    prepareInfoWindowValues(record) {
        let values = super.prepareInfoWindowValues(record);
        console.log('record in renderer avatar', record);
        values.avatarUrl = `/web/image/${record.resModel}/${record.resId}/${this.props.archInfo.sidebarAvatarField}`;
        return values;
    }

    /**
     * @override
     */
    get infoWindowTemplate() {
        return 'contacts_google_map.MarkerInfoWindow';
    }

    /**
     * @override
     */
    get sidebarProps() {
        return Object.assign(
            { fieldAvatar: this.props.archInfo.sidebarAvatarField },
            super.sidebarProps
        );
    }
}
