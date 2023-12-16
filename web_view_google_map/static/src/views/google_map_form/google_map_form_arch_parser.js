/** @odoo-module **/

import { FormArchParser } from '@web/views/form/form_arch_parser';

export class GoogleMapFormArchParser extends FormArchParser {
    parse(arch, models, modelName) {
        const res = super.parse(arch, models, modelName);
        res.latitudeField = res.xmlDoc.getAttribute('lat');
        res.longitudeField = res.xmlDoc.getAttribute('lng');
        return res;
    }
}
