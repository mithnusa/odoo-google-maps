import { patch } from '@web/core/utils/patch';
import { GoogleMapArchParser } from '@web_view_google_map/views/google_map/google_map_arch_parser';

patch(GoogleMapArchParser.prototype, {
    parseGoogleMapAttrs(xmlDoc, node, attrs) {
        super.parseGoogleMapAttrs(xmlDoc, node, attrs);

        const geoJsonField = xmlDoc.getAttribute('geojson');
        if (geoJsonField) {
            attrs.geoJsonField = geoJsonField;
        }
    },
});

export class GoogleMapDrawingArchParser extends GoogleMapArchParser {
    parseGoogleMapAttrs(xmlDoc, node, attrs) {
        super.parseGoogleMapAttrs(xmlDoc, node, attrs);

        const geoJsonField = xmlDoc.getAttribute('geojson');
        attrs.geoJsonField = geoJsonField;
    }
}
