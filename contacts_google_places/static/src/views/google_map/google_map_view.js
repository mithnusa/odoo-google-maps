/** @odoo-module **/

import { registry } from '@web/core/registry';
import { googleMapContactAvatarView } from '@contacts_google_map/views/google_map/google_map_view';
import { GoogleMapPlacesContactsAvatarRenderer } from './google_map_renderer';

export const googleMapPlacesContactAvatarView = {
    ...googleMapContactAvatarView,
    Renderer: GoogleMapPlacesContactsAvatarRenderer,
};

registry
    .category('views')
    .add('google_map_places_contact_avatar', googleMapPlacesContactAvatarView);
