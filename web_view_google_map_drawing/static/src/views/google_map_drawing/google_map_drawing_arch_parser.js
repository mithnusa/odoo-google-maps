import { patch } from '@web/core/utils/patch';
import { GoogleMapArchParser } from '@web_view_google_map/views/google_map/google_map_arch_parser';

// Patches the BASE class's prototype, not just the GoogleMapDrawingArchParser
// subclass below — necessary because Field.parseFieldNode (used for
// one2many/many2many sub-views) resolves an embedded <google_map> element's
// ArchParser via viewRegistry.get(child.tagName): always 'google_map',
// never consulting js_class. js_class-based ArchParser swapping only
// happens for top-level View mounting. So a google_map_drawing_one2many/
// _many2many field's embedded arch (js_class="google_map_drawing", geojson
// instead of lat/lng) is always parsed by GoogleMapArchParser itself, never
// by the subclass below — the base class's prototype must be taught to
// recognize geojson as an alternative right here, at the source.
patch(GoogleMapArchParser.prototype, {
    hasValidGeoAttrs(xmlDoc) {
        return super.hasValidGeoAttrs(xmlDoc) || Boolean(xmlDoc.getAttribute('geojson'));
    },
    parseGoogleMapAttrs(xmlDoc, node, attrs) {
        super.parseGoogleMapAttrs(xmlDoc, node, attrs);
        attrs.geoJsonField = xmlDoc.getAttribute('geojson') || undefined;
    },
});

export class GoogleMapDrawingArchParser extends GoogleMapArchParser {
    // Strict override for TOP-LEVEL google_map_drawing-typed views: a
    // drawing view specifically needs geojson, not a lat/lng fallback.
    hasValidGeoAttrs(xmlDoc) {
        return Boolean(xmlDoc.getAttribute('geojson'));
    }

    missingGeoAttrsMessage() {
        return 'Missing required attribute(s): geojson';
    }
}
