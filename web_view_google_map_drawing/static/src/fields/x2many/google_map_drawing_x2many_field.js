/** @odoo-module **/

import { registry } from '@web/core/registry';
import { X2ManyFieldGoogleMapField, x2ManyFieldGoogleMapField } from '@web_view_google_map/fields/x2many/google_map_x2many_field';
import { GoogleMapDrawingRenderer } from '../../views/google_map_drawing/google_map_drawing_renderer';

export class X2manyFieldGoogleMapDrawingField extends X2ManyFieldGoogleMapField {
    static components = {
        ...X2ManyFieldGoogleMapField.components,
        GoogleMapRenderer: GoogleMapDrawingRenderer,
    };
}

const x2manyFieldGoogleMapDrawingField = {
    ...x2ManyFieldGoogleMapField,
    component: X2manyFieldGoogleMapDrawingField,
};

registry.category('fields').add('google_map_drawing_one2many', x2manyFieldGoogleMapDrawingField);
registry.category('fields').add('google_map_drawing_many2many', x2manyFieldGoogleMapDrawingField);
