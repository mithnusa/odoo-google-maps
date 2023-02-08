/** @odoo-module **/

import { registry } from '@web/core/registry';
import { X2ManyFieldGoogleMap } from '@web_view_google_map/fields/x2many/google_map_x2many_field';
import { GoogleMapDrawingRenderer } from '../../views/google_map_drawing/google_map_drawing_renderer';

export class X2manyFieldGoogleMapDrawing extends X2ManyFieldGoogleMap {}

X2manyFieldGoogleMapDrawing.components = {
    ...X2ManyFieldGoogleMap.components,
    GoogleMapRenderer: GoogleMapDrawingRenderer,
};

registry
    .category('fields')
    .add('google_map_drawing_one2many', X2manyFieldGoogleMapDrawing);
registry
    .category('fields')
    .add('google_map_drawing_many2many', X2manyFieldGoogleMapDrawing);
