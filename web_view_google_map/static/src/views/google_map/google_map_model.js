import { RelationalModel } from '@web/model/relational_model/relational_model';
import { DynamicGroupList } from '@web/model/relational_model/dynamic_group_list';
import { Group } from '@web/model/relational_model/group';
import { Record } from '@web/model/relational_model/record';
import { Domain } from '@web/core/domain';
import { KeepLast } from '@web/core/utils/concurrency';
import { parseRecord, generateColor } from './utils';
import { gMapViewAttrsContextManager } from '../../helpers/view_attrs_context_manager';

export class GoogleMapGroup extends Group {
    /**
     * Override
     */
    setup() {
        super.setup(...arguments);
        // Derive color from group value so it stays stable across reloads
        const colorSeed = Array.isArray(this.value) ? this.value[0] : this.value;
        this.groupColor = generateColor(colorSeed);
    }

    get groupByLabel() {
        return this.groupByField ? this.groupByField.string : '';
    }

    get dataView() {
        let other = {};
        let geolocation = {};
        if (this.model.viewConfig && this.records) {
            const record = this.records[0]; // we only care the first record
            if (record && record.data) {
                const data = parseRecord(record, this.model.viewConfig, true);
                geolocation = data.geolocation;
                other = Object.assign({}, data.other, { groupColor: this.groupColor });
            }
        }
        return { geolocation, other };
    }
}

export class GoogleMapDynamicGroupList extends DynamicGroupList {
    /**
     * Override
     */
    setup() {
        super.setup(...arguments);
        // Initialize defaultGroupBy once during setup instead of lazily inside the getter
        if (!this.model.defaultGroupBy && this.config.groupBy?.length) {
            this.model.defaultGroupBy = this.config.groupBy.slice(0, 1);
        }
    }

    get groupBy() {
        const defaultGroupBy = this.model.defaultGroupBy;
        if (defaultGroupBy) {
            return Array.isArray(defaultGroupBy) ? defaultGroupBy : [defaultGroupBy];
        }
        // only one groupBy is allowed
        return this.config.groupBy ? this.config.groupBy.slice(0, 1) : this.config.groupBy;
    }
}

export class GoogleMapModel extends RelationalModel {
    /**
     * Override
     * @param {*} params
     * @param {*} services
     */
    setup(params, services) {
        super.setup(...arguments);
        this.viewConfig = params.viewConfig || {};
        this.unLocatedCount = 0;
        // Dedicated KeepLast — this.keepLast is used internally by
        // RelationalModel for record loads and must not be shared
        this._countKeepLast = new KeepLast();
    }
    /**
     * Override
     * @param {*} currentConfig
     * @param {*} params
     * @returns
     */
    _getNextConfig(currentConfig, params) {
        const nextConfig = super._getNextConfig(currentConfig, params);
        const mapDomain = this.mapDomain;
        if (mapDomain && mapDomain.length) {
            // add domain for geolocation fields
            nextConfig.domain = Domain.and([nextConfig.domain ?? [], mapDomain]).toList();
        }
        return nextConfig;
    }

    /**
     * Override
     * @param {*} params
     */
    async load(params = {}) {
        const res = await super.load(params);
        await this._updateUnlocatedRecordCount(this.config, params);
        return res;
    }

    /**
     * Whether the view is configured with searchable geolocation fields
     * @returns {boolean}
     */
    _hasSearchableGeoFields() {
        return Boolean(
            this.viewConfig &&
                this.viewConfig.lat &&
                this.viewConfig.lng &&
                this.config.fields[this.viewConfig.lat] &&
                this.config.fields[this.viewConfig.lng] &&
                this.config.fields[this.viewConfig.lat].searchable &&
                this.config.fields[this.viewConfig.lng].searchable
        );
    }

    /**
     * Filter for geolocation fields
     * @returns {Array} domain for map
     */
    get mapDomain() {
        if (this._mapDomainCache !== undefined) {
            return this._mapDomainCache;
        }
        let result = [];
        if (this._hasSearchableGeoFields()) {
            // Exclude null/false only — 0.0 is a valid coordinate (equator/prime meridian)
            const nullValues = [null, false];
            let latDomain = [[this.viewConfig.lat, 'not in', nullValues]];
            let lngDomain = [[this.viewConfig.lng, 'not in', nullValues]];

            if (this.config.fields[this.viewConfig.lat].related) {
                const related_source = this.config.fields[this.viewConfig.lat].related.split('.')[0];
                latDomain = Domain.and([latDomain, [[related_source, 'not in', nullValues]]]).toList();
            }
            if (this.config.fields[this.viewConfig.lng].related) {
                const related_source = this.config.fields[this.viewConfig.lng].related.split('.')[0];
                lngDomain = Domain.and([lngDomain, [[related_source, 'not in', nullValues]]]).toList();
            }
            result = Domain.and([latDomain, lngDomain]).toList();
        }
        this._mapDomainCache = result;
        return result;
    }

    get notGeolocatedDomain() {
        if (this._unlocatedDomainCache !== undefined) {
            return this._unlocatedDomainCache;
        }
        let result = [];
        if (this._hasSearchableGeoFields()) {
            const nullValues = [null, false];
            // Complement of mapDomain: a record is not geolocated when ANY
            // required coordinate source is missing — hence OR, not AND.
            const parts = [[[this.viewConfig.lat, 'in', nullValues]], [[this.viewConfig.lng, 'in', nullValues]]];
            for (const fieldName of [this.viewConfig.lat, this.viewConfig.lng]) {
                const related = this.config.fields[fieldName].related;
                if (related) {
                    parts.push([[related.split('.')[0], 'in', nullValues]]);
                }
            }
            result = Domain.or(parts).toList();
        }
        this._unlocatedDomainCache = result;
        return result;
    }

    /**
     * Domain matching the records excluded from the map by the current
     * search: current search scope AND missing geolocation. Reusable by
     * the controller (e.g. an action listing the non-geolocated records)
     * so any list opened from the count can never disagree with it.
     * @returns {Array} combined domain
     */
    get unlocatedRecordsDomain() {
        const notGeolocated = this.notGeolocatedDomain;
        if (!notGeolocated.length) {
            return [];
        }
        return Domain.and([this._searchDomain ?? [], notGeolocated]).toList();
    }

    async _updateUnlocatedRecordCount(config, params) {
        if (this._searchDomain === undefined) {
            this._searchDomain = params.domain ?? [];
        }
        const domain = this.unlocatedRecordsDomain;
        if (!domain.length || this.useSampleModel) {
            this.unLocatedCount = 0;
            return;
        }
        this.unLocatedCount = await this._countKeepLast.add(
            this.orm.searchCount(this.config.resModel, domain, {
                context: this.config.context,
            })
        );
    }
}

export class GoogleMapRecord extends Record {
    get dataView() {
        const viewAttrsCtx = gMapViewAttrsContextManager.getAll();
        const viewAttrs = this.model.viewConfig || viewAttrsCtx || {};
        return parseRecord(this, viewAttrs);
    }
}

GoogleMapModel.Group = GoogleMapGroup;
GoogleMapModel.DynamicGroupList = GoogleMapDynamicGroupList;
GoogleMapModel.Record = GoogleMapRecord;
