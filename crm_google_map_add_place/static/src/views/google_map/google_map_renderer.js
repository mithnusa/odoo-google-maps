import { patch } from '@web/core/utils/patch';
import { GoogleMapRendererCRM } from '@crm_google_map/views/google_map/google_map_renderer';
import { InMapClickAddPlace } from '@base_google_map_add_place/components/in_map_click_add_place/in_map_click_add_place';

patch(GoogleMapRendererCRM, {
    components: { ...GoogleMapRendererCRM.components, InMapClickAddPlace },
    template: 'crm_google_map_add_place.GoogleMapRenderer',
});
