import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';

export class GoogleMapDrawingController extends GoogleMapController {
    getViewMapConfig() {
        const viewConfig = super.getViewMapConfig();
        // remove unnecessary properties
        // following properties are not used in drawing mode
        delete viewConfig.lat;
        delete viewConfig.lng;
        delete viewConfig.markerColor;
        delete viewConfig.markerIcon;
        delete viewConfig.markerIconScale;

        return Object.assign({}, viewConfig, {
            shapeName: 'gshape_name',
            shapeArea: 'gshape_area',
            shapeRadius: 'gshape_radius',
            shapeDescription: 'gshape_description',
            shapeType: 'gshape_type',
            shapePaths: 'gshape_paths',
            shapeWidth: 'gshape_width',
            shapeHeight: 'gshape_height',
            shapePolygonLines: 'gshape_polygon_lines',
        });
    }
}
