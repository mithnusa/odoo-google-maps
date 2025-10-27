import { Domain } from '@web/core/domain';
import { GoogleMapModel } from '@web_view_google_map/views/google_map/google_map_model';

export class GoogleMapDrawingModel extends GoogleMapModel {
    /**
     * @override
     */
    get mapDomain() {
        if (
            this.viewConfig &&
            this.viewConfig.geoJsonField &&
            this.config.fields[this.viewConfig.geoJsonField] &&
            this.config.fields[this.viewConfig.geoJsonField].searchable
        ) {
            return Domain.or([
                [[this.viewConfig.geoJsonField, '!=', false]],
                [
                    [
                        this.viewConfig.geoJsonField,
                        'json_eq',
                        { type: 'FeatureCollection', features: [] },
                    ],
                ],
            ]).toList({}); // Ensure the field is not empty or default empty structure
        }
        return [];
    }
}
