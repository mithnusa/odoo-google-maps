import { registry } from '@web/core/registry';
import { x2ManyField } from '@web/views/fields/x2many/x2many_field';
import { X2ManyFieldGoogleMap } from '@web_view_google_map/fields/x2many/google_map_x2many_field';
import { GoogleMapDeckGLRenderer } from '../../views/google_map_drawing/google_map_deckgl_renderer';

export class X2manyFieldGoogleMapDrawing extends X2ManyFieldGoogleMap {
    static components = {
        ...X2ManyFieldGoogleMap.components,
        GoogleMapRenderer: GoogleMapDeckGLRenderer,
    };

    get unlocatedRecords() {
        const { geoJsonField } = this.viewAttrsConfig;
        if (!geoJsonField) {
            return [];
        }
        return this.list.records.filter((record) => {
            const geoJson = record.data[geoJsonField];
            return !geoJson || !Array.isArray(geoJson.features) || geoJson.features.length === 0;
        });
    }

    get viewAttrsConfig() {
        const { archInfo } = this;
        const attrs = Object.assign({}, super.viewAttrsConfig, {
            geoJsonField: archInfo.geoJsonField,
            subTitle: archInfo.sidebarSubtitleField,
        });
        delete attrs.lat;
        delete attrs.lng;
        return attrs;
    }
}

export const x2ManyGoogleMapDrawing = {
    ...x2ManyField,
    component: X2manyFieldGoogleMapDrawing,
    displayName: 'Google Maps Drawing',
};

registry.category('fields').add('google_map_drawing_one2many', x2ManyGoogleMapDrawing);
registry.category('fields').add('google_map_drawing_many2many', x2ManyGoogleMapDrawing);
