import { _t } from '@web/core/l10n/translation';
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
            shapeWidth: 'gshape_width',
            shapeHeight: 'gshape_height',
            shapeGeoJson: 'gshape_geojson',
        });
    }

    openGeoJSONUploadWizard() {
        this.model.action.doAction({
            name: _t('Import GeoJSON'),
            type: 'ir.actions.act_window',
            res_model: 'google.geojson.upload.wizard',
            views: [[false, 'form']],
            target: 'new',
            context: {
                'default_target_model': this.props.resModel,
            }
        });
    }
}
