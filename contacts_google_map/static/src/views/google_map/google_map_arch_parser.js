import { GoogleMapArchParser } from '@web_view_google_map/views/google_map/google_map_arch_parser';

export class GoogleMapContactAvatarArchParser extends GoogleMapArchParser {
    parseGoogleMapAttrs(xmlDoc, node, attrs) {
        super.parseGoogleMapAttrs(xmlDoc, node, attrs);
        const sidebarAvatarField = xmlDoc.getAttribute('sidebar_avatar');
        attrs.sidebarAvatarField = sidebarAvatarField;
    }
}
