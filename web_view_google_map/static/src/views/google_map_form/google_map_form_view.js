/** @odoo-module **/

import { registry } from '@web/core/registry';
import { formView } from '@web/views/form/form_view';
import { GoogleMapFormRenderer } from './google_map_form_renderer';
import { GoogleMapFormArchParser } from './google_map_form_arch_parser';

export const googleMapFormView = {
    ...formView,
    ArchParser: GoogleMapFormArchParser,
    Renderer: GoogleMapFormRenderer,
};

/**
 * google_map view extension for form view, to be able to edit geolocation
 */
registry.category('views').add('google_map_form', googleMapFormView);
