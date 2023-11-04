/** @odoo-module **/

import { FormArchParser } from '@web/views/form/form_arch_parser';
import { archParseBoolean } from '@web/views/utils';

export class GoogleMapFormArchParser extends FormArchParser {
    parse(arch, models, modelName) {
        const res = super.parse(arch, models, modelName);
        res.latitudeField = res.xmlDoc.getAttribute('lat');
        res.longitudeField = res.xmlDoc.getAttribute('lng');
        return res;
    }
}

FormArchParser.prototype.originalParse = FormArchParser.prototype.parse;

Object.assign(FormArchParser.prototype, {
    parse(arch, models, modelName) {
        const res = FormArchParser.prototype.originalParse.call(this, arch, models, modelName);
        const activeActions = res.activeActions;
        activeActions.editGeolocation = archParseBoolean(
            res.xmlDoc.getAttribute('edit_lat_lng'),
            false
        );
        if (activeActions.editGeolocation) {
            res.googleMapFormViewRef = res.xmlDoc.getAttribute('google_map_form_view_ref');
        }
        return res;
    },
});
