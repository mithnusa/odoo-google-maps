/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { googleMapView } from '@web_view_google_map/views/google_map/google_map_view';
import { GoogleMapDrawingRenderer } from './google_map_drawing_renderer';
import { GoogleMapArchParser } from '@web_view_google_map/views/google_map/google_map_arch_parser';

const GSHAPE_FIELDS = {
    gshape_type: _lt('Type'),
    gshape_area: _lt('Area'),
    gshape_length: _lt('Length'),
    gshape_radius: _lt('Radius'),
    gshape_width: _lt('Width'),
    gshape_height: _lt('Height'),
};

export const googleMapDrawingView = {
    ...googleMapView,
    Renderer: GoogleMapDrawingRenderer,
};

registry.category('views').add('google_map_drawing', googleMapDrawingView);
