/** @odoo-module **/

import { GoogleMapArchParser } from '@web_view_google_map/views/google_map/google_map_arch_parser';

export class GoogleMapContactAvatarArchParser extends GoogleMapArchParser {
    parse(xmlDoc, models, modelName) {
        const archInfo = super.parse(xmlDoc, models, modelName);
        const sidebarAvatarField = xmlDoc.getAttribute('sidebar_avatar');
        archInfo.sidebarAvatarField = sidebarAvatarField;
        return archInfo;
    }
}
