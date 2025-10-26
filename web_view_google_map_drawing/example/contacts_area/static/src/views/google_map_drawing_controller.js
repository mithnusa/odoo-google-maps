import { _t } from '@web/core/l10n/translation';
import { patch } from '@web/core/utils/patch';
import { GoogleMapDrawingController } from '@web_view_google_map_drawing/views/google_map_drawing/google_map_drawing_controller';

patch(GoogleMapDrawingController.prototype, {
    openGeoJSONUploadWizard() {
        this.model.action.doAction({
            name: _t('Import GeoJSON'),
            type: 'ir.actions.act_window',
            res_model: 'google.geojson.upload.wizard',
            views: [[false, 'form']],
            target: 'new',
            context: {
                default_target_model: this.props.resModel,
            },
        });
    },
});
