/** @odoo-module **/

import { registry } from '@web/core/registry';
import { RelationalModel } from '@web/model/relational_model/relational_model';

import { GoogleMapArchParser } from './google_map_arch_parser';
import { GoogleMapController } from './google_map_controller';
import { GoogleMapRenderer } from './google_map_renderer';

export const googleMapView = {
    type: 'google_map',
    display_name: 'Google Maps',
    icon: 'fa fa-map-o',
    multiRecord: true,
    limit: 80,

    ArchParser: GoogleMapArchParser,
    Controller: GoogleMapController,
    Model: RelationalModel,
    Renderer: GoogleMapRenderer,

    searchMenuTypes: ['filter', 'comparison', 'favorite'],
    buttonTemplate: 'web_view_google_map.GoogleMapView.Buttons',

    props: (genericProps, view) => {
        const { ArchParser } = view;
        const { arch, relatedModels, resModel } = genericProps;
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
