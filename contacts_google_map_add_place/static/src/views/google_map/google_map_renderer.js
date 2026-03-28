import { patch } from '@web/core/utils/patch';
import { GoogleMapRendererContactAvatar } from '@contacts_google_map/views/google_map/google_map_renderer';
import { InMapClickAddPlace } from '@base_google_map_add_place/components/in_map_click_add_place/in_map_click_add_place';

patch(GoogleMapRendererContactAvatar, {
    components: { ...GoogleMapRendererContactAvatar.components, InMapClickAddPlace },
    template: 'contacts_google_map_add_place.GoogleMapRenderer',
});
