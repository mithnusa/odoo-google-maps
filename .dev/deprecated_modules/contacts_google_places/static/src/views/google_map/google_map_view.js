import { registry } from '@web/core/registry';
import { googleMapContactAvatarView } from '@contacts_google_map/views/google_map/google_map_view';
import { GoogleMapPlacesController } from '@base_google_places/views/google_map_places/google_map_controller';
import { GoogleMapPlacesContactsAvatarRenderer } from './google_map_renderer';

export const googleMapPlacesContactAvatarView = {
    ...googleMapContactAvatarView,
    Renderer: GoogleMapPlacesContactsAvatarRenderer,
    Controller: GoogleMapPlacesController,
};

registry
    .category('views')
    .add('google_map_places_contact_avatar', googleMapPlacesContactAvatarView);
