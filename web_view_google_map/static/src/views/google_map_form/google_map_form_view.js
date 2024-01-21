/** @odoo-module **/

import { registry } from '@web/core/registry';
import { formView } from '@web/views/form/form_view';
import { useService } from '@web/core/utils/hooks';
import { GoogleMapFormRenderer } from './google_map_form_renderer';
import { GoogleMapFormArchParser } from './google_map_form_arch_parser';

export class GoogleMapFormController extends formView.Controller {
    setup() {
        super.setup();
        this.action = useService('action');
    }
    async onRecordSaved(record) {
        await super.onRecordSaved(...arguments);
        return this.action.doAction('reload_context');
    }
}

export const googleMapFormView = {
    ...formView,
    ArchParser: GoogleMapFormArchParser,
    Renderer: GoogleMapFormRenderer,
    Controller: GoogleMapFormController,
};

/**
 * google_map view extension for form view, to be able to edit geolocation
 */
registry.category('views').add('google_map_form', googleMapFormView);
