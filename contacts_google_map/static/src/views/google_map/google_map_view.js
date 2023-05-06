/** @odoo-module **/

import { registry } from '@web/core/registry';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapRendererContactAvatar } from './google_map_renderer';
import { GoogleMapContactAvatarArchParser } from './google_map_arch_parser';

export const googleMapContactAvatarView = {
    ...googleMapView,
    ArchParser: GoogleMapContactAvatarArchParser,
    Renderer: GoogleMapRendererContactAvatar,
};

registry.category('views').add('google_map_contact_avatar', googleMapContactAvatarView);
