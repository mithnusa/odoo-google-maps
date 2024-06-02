/** @odoo-module **/

import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarContactAvatar } from './google_map_sidebar';

export class GoogleMapRendererContactAvatar extends GoogleMapRenderer {
    /**
     * @override
     */
    prepareInfoWindowValues(record, isMulti) {
        let values = super.prepareInfoWindowValues(record, isMulti);
        values.avatarUrl = `/web/image/${record.resModel}/${record.resId}/${this.props.archInfo.sidebarAvatarField}`;
        return values;
    }

    /**
     * @override
     */
    get infoWindowTemplate() {
        return 'contacts_google_map.MarkerInfoWindow';
    }

    get sidebarProps() {
        return Object.assign(
            { fieldAvatar: this.props.archInfo.sidebarAvatarField },
            super.sidebarProps
        );
    }
}

GoogleMapRendererContactAvatar.components = {
    ...GoogleMapRenderer.components,
    Sidebar: GoogleMapSidebarContactAvatar,
};
