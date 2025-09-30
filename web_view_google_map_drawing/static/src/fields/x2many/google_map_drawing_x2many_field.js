import { registry } from '@web/core/registry';
import { x2ManyField } from '@web/views/fields/x2many/x2many_field';
import { X2ManyFieldGoogleMap } from '@web_view_google_map/fields/x2many/google_map_x2many_field';
import { GoogleMapDrawingRenderer } from '../../views/google_map_drawing/google_map_drawing_renderer';
import { GoogleMapTerraDrawRenderer } from '../../views/google_map_drawing/google_map_terra_draw_renderer';

export class X2manyFieldGoogleMapDrawing extends X2ManyFieldGoogleMap {
    static components = {
        ...X2ManyFieldGoogleMap.components,
        GoogleMapRenderer: GoogleMapTerraDrawRenderer,
    };
}

export const x2ManyGoogleMapDrawing = {
    ...x2ManyField,
    component: X2manyFieldGoogleMapDrawing,
    displayName: 'Google Maps Drawing',
};

registry.category('fields').add('google_map_drawing_one2many', x2ManyGoogleMapDrawing);
registry.category('fields').add('google_map_drawing_many2many', x2ManyGoogleMapDrawing);
