import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';


export class GoogleMapDrawingController extends GoogleMapController {
    get viewMapConfig() {
        const viewConfig = super.viewMapConfig;
        // remove unnecessary properties
        // following properties are not used in drawing mode
        delete viewConfig.lat;
        delete viewConfig.lng;

        return Object.assign({}, viewConfig, {
            geoJsonField: this.archInfo.geoJsonField,
        });
    }

    get rendererProps() {
        const rendererProps = super.rendererProps;
        // remove unnecessary properties
        // following properties are not used in drawing mode
        delete rendererProps.showNearbyRecords;

        return rendererProps;
    }
}
