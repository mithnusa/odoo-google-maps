import { Domain } from '@web/core/domain';
import { GoogleMapModel } from '@web_view_google_map/views/google_map/google_map_model';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

export class GoogleMapDrawingModel extends GoogleMapModel {
    /**
     * @override
     * Drawing views locate records by a GeoJSON field, not lat/lng
     */
    _hasSearchableGeoFields() {
        return Boolean(
            this.viewConfig &&
                this.viewConfig.geoJsonField &&
                this.config.fields[this.viewConfig.geoJsonField] &&
                this.config.fields[this.viewConfig.geoJsonField].searchable
        );
    }

    /**
     * @override
     */
    get mapDomain() {
        if (this._mapDomainCache !== undefined) {
            return this._mapDomainCache;
        }
        let result = [];
        if (this._hasSearchableGeoFields()) {
            result = Domain.and([
                [[this.viewConfig.geoJsonField, '!=', null]],
                [[this.viewConfig.geoJsonField, 'json_ne', EMPTY_FEATURE_COLLECTION]],
            ]).toList(); // Filter out null and empty FeatureCollection
        }
        this._mapDomainCache = result;
        return result;
    }

    /**
     * @override
     * Complement of mapDomain: no shape drawn yet, i.e. NULL or an empty
     * FeatureCollection. json_eq never matches NULL rows, so both legs
     * of the OR are required.
     */
    get notGeolocatedDomain() {
        if (this._unlocatedDomainCache !== undefined) {
            return this._unlocatedDomainCache;
        }
        let result = [];
        if (this._hasSearchableGeoFields()) {
            result = Domain.or([
                [[this.viewConfig.geoJsonField, '=', null]],
                [[this.viewConfig.geoJsonField, 'json_eq', EMPTY_FEATURE_COLLECTION]],
            ]).toList();
        }
        this._unlocatedDomainCache = result;
        return result;
    }
}
