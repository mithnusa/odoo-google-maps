import { RelationalModel } from '@web/model/relational_model/relational_model';
import { DynamicGroupList } from '@web/model/relational_model/dynamic_group_list';
import { Group } from '@web/model/relational_model/group';
import { Record } from '@web/model/relational_model/record';
import { Domain } from '@web/core/domain';
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
            nextConfig.domain = Domain.and([nextConfig.domain ?? [], mapDomain]).toList({});
        }
        return nextConfig;
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
        if (
            this.viewConfig &&
            this.viewConfig.lat &&
            this.viewConfig.lng &&
            this.config.fields[this.viewConfig.lat] &&
            this.config.fields[this.viewConfig.lng] &&
            this.config.fields[this.viewConfig.lat].searchable &&
            this.config.fields[this.viewConfig.lng].searchable
        ) {
            // Exclude null/false only — 0.0 is a valid coordinate (equator/prime meridian)
            const nullValues = [null, false];
            let latDomain = [[this.viewConfig.lat, 'not in', nullValues]];
            let lngDomain = [[this.viewConfig.lng, 'not in', nullValues]];

            if (this.config.fields[this.viewConfig.lat].related) {
                const related_source = this.config.fields[this.viewConfig.lat].related.split('.')[0];
                latDomain = Domain.and([latDomain, [[related_source, 'not in', nullValues]]]).toList({});
            }
            if (this.config.fields[this.viewConfig.lng].related) {
                const related_source = this.config.fields[this.viewConfig.lng].related.split('.')[0];
                lngDomain = Domain.and([lngDomain, [[related_source, 'not in', nullValues]]]).toList({});
            }
            result = Domain.and([latDomain, lngDomain]).toList({});
        }
        this._mapDomainCache = result;
        return result;
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
