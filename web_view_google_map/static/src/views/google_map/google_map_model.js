import { RelationalModel } from '@web/model/relational_model/relational_model';
import { DynamicGroupList } from '@web/model/relational_model/dynamic_group_list';
import { Group } from '@web/model/relational_model/group';
import { Record } from '@web/model/relational_model/record';
import { Domain } from '@web/core/domain';
import { parseRecord } from './utils';

export class GoogleMapGroup extends Group {
    /**
     * Override
     */
    setup() {
        super.setup(...arguments);
        this.markerColor = this.generateRandomColor();
    }

    get groupByLabel() {
        return this.groupByField ? this.groupByField.string : '';
    }

    async groupRecords() {
        if (this.list.records.length) {
            return this.list.records;
        }
        await this.list.load();
        return this.list.records;
    }

    get dataView() {
        let other = {};
        let geolocation = {};
        if (this.model.viewConfig && this.records) {
            const record = this.records[0]; // we only care the first record
            if (record && record.data) {
                const data = parseRecord(record, this.model.viewConfig, true);
                geolocation = data.geolocation;
                other = Object.assign({}, data.other, { groupColor: this.markerColor });
            }
        }
        return { geolocation, other };
    }

    generateRandomColor() {
        return (
            '#' +
            Math.floor(Math.random() * 0xffffff)
                .toString(16)
                .padStart(6, '0')
        );
    }
}

export class GoogleMapDynamicGroupList extends DynamicGroupList {
    /**
     * Override
     */
    get groupBy() {
        const defaultGroupBy = this.model.defaultGroupBy;
        let groupBy_ = this.config.groupBy;
        if (defaultGroupBy) {
            groupBy_ = Array.isArray(defaultGroupBy) ? defaultGroupBy : [defaultGroupBy];
        } else if (this.config.groupBy) {
            // only one groupBy is allowed
            groupBy_ = this.config.groupBy.slice(0, 1);
            if (!this.model.defaultGroupBy) {
                this.model.defaultGroupBy = groupBy_;
            }
        }
        return groupBy_;
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
        const domain = params.domain || [];
        const mapDomain = this.mapDomain;
        if (mapDomain) {
            // add domain for geolocation fields
            const newDomain = Domain.and([domain, mapDomain]).toList({});
            params = Object.assign({}, params, { domain: newDomain });
        }
        return super._getNextConfig(currentConfig, params);
    }
    /**
     * Filter for geolocation fields
     * @returns {Array} domain for map
     */
    get mapDomain() {
        if (
            this.viewConfig &&
            this.viewConfig.lat &&
            this.viewConfig.lng &&
            this.config.fields[this.viewConfig.lat].searchable &&
            this.config.fields[this.viewConfig.lng].searchable
        ) {
            let latDomain = [[this.viewConfig.lat, '!=', 0.0]];
            let lngDomain = [[this.viewConfig.lng, '!=', 0.0]];

            if (this.config.fields[this.viewConfig.lat].related) {
                const [related_source, _related_field] =
                    this.config.fields[this.viewConfig.lat].related.split('.');
                latDomain = Domain.and([latDomain, [[related_source, '!=', false]]]).toList({});
            }
            if (this.config.fields[this.viewConfig.lng].related) {
                const [related_source, _related_field] =
                    this.config.fields[this.viewConfig.lng].related.split('.');
                latDomain = Domain.and([latDomain, [[related_source, '!=', false]]]).toList({});
            }
            return Domain.and([latDomain, lngDomain]).toList({});
        }
        return [];
    }
}

export class GoogleMapRecord extends Record {
    get dataView() {
        return parseRecord(this, this.model.viewConfig);
    }
}

GoogleMapModel.Group = GoogleMapGroup;
GoogleMapModel.DynamicGroupList = GoogleMapDynamicGroupList;
GoogleMapModel.Record = GoogleMapRecord;
