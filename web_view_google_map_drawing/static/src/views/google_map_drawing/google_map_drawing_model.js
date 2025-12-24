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
            return Domain.and([
                [[this.viewConfig.geoJsonField, '!=', null]],
                [
                    [
                        this.viewConfig.geoJsonField,
                        'json_ne',
                        { type: 'FeatureCollection', features: [] },
                    ],
                ],
            ]).toList({}); // Filter out null and empty FeatureCollection
        }
        return [];
    }
}
