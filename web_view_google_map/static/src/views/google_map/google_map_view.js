import { GoogleMapArchParser } from './google_map_arch_parser';
import { GoogleMapController } from './google_map_controller';
import { GoogleMapModel } from './google_map_model';
import { GoogleMapRenderer } from './google_map_renderer';

import { registry } from '@web/core/registry';

export const googleMapView = {
    type: 'google_map',
    display_name: 'Google Maps',
    ArchParser: GoogleMapArchParser,
    Controller: GoogleMapController,
    Model: GoogleMapModel,
    Renderer: GoogleMapRenderer,
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
