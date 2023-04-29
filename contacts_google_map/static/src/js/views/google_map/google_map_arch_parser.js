/** @odoo-module **/

import { GoogleMapArchParser } from '@web_view_google_map/views/google_map/google_map_arch_parser';

export class GoogleMapContactAvatarArchParser extends GoogleMapArchParser {
    parse(arch, models, modelName) {
        const archInfo = super.parse(arch, models, modelName);
        const xmlDoc = this.parseXML(arch);
        const sidebarAvatarField = xmlDoc.getAttribute('sidebar_avatar');
        archInfo.sidebarAvatarField = sidebarAvatarField;
        return archInfo;
    }
}
