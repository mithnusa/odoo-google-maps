/** @odoo-module **/

import { GoogleMapArchParser } from './google_map_arch_parser';
import { GoogleMapController } from './google_map_controller';
import { RelationalModel } from '@web/views/relational_model';
import { GoogleMapRenderer } from './google_map_renderer';

import { registry } from '@web/core/registry';

export const googleMapView = {
    type: 'google_map',
    display_name: 'Google Maps',
    icon: 'fa fa-map-o',
    multiRecord: true,

    ArchParser: GoogleMapArchParser,
    Controller: GoogleMapController,
    Model: RelationalModel,
    Renderer: GoogleMapRenderer,

    searchMenuTypes: ['filter', 'comparison', 'favorite'],
    buttonTemplate: 'web_view_google_map.GoogleMapView.Buttons',

    props: (genericProps, view) => {
        const { arch, relatedModels, resModel } = genericProps;
        const { ArchParser } = view;
        const archInfo = new ArchParser().parse(arch, relatedModels, resModel);

        return {
            ...genericProps,
            Model: view.Model,
            Renderer: view.Renderer,
            buttonTemplate: view.buttonTemplate,
            archInfo,
        };
    },
};

registry.category('views').add('google_map', googleMapView);
