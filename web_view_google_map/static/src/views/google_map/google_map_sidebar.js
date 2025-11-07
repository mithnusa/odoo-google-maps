import { _t } from '@web/core/l10n/translation';
import { Component } from '@odoo/owl';
import { CheckBox } from '@web/core/checkbox/checkbox';
import { Field } from "@web/views/fields/field";

export class GoogleMapSidebar extends Component {
    static template = 'web_view_google_map.GoogleMapSidebar';
    static listGroupOrRecordTemplate = 'web_view_google_map.ListGroupOrRecord';
    static recordItemTemplate = 'web_view_google_map.RecordItem';
    static groupItemTemplate = 'web_view_google_map.GroupItem';
    static components = { CheckBox, Field };
    static props = {
        header: String,
        title: { type: String, optional: true },
        subTitle: String,
        getGroupsOrRecords: Function,
        toggleGroup: Function,
        renderGroupedRecordsFitBounds: Function,
        openRecord: Function,
        showRecordsByDomain: Function,
        pointInMap: Function,
        deleteGroupRecords: Function,
        handleToggleSelection: Function,
        handleCanSelectRecord: Boolean,
        handleSelectAll: Boolean,
        handleToggleRecordSelection: Function,
        allowSelectors: Boolean,
        isGrouped: Boolean,
    };

    get datas() {
        return this.props.getGroupsOrRecords();
    }

    /**
     * Center the map based on the group records
     * @param {*} ev
     * @param {*} groupKey
     */
    async handleGroupCollapse(ev, groupKey) {
        const { group } = this.datas.find((data) => data.key === groupKey);
        if (!group) return;

        if (!ev.currentTarget?.classList.contains('collapsed')) {
            await this.props.toggleGroup(group);
            const datas = this.props.getGroupsOrRecords();
            const groupDatas = datas.filter((data) => data.key === groupKey);
            this.props.renderGroupedRecordsFitBounds(groupDatas);
        } else {
            const records = group.list.records;
            this.props.deleteGroupRecords(records);
        }
    }

    selectRecord(record) {
        this.props.handleToggleRecordSelection(record, true);
    }

    actionShowGroupRecords(group) {
        const displayName = group.group.displayName || _t('None');
        const name = group.group.groupByLabel + ' > ' + displayName;
        const domain = group.group.groupDomain;
        this.props.showRecordsByDomain(name, domain);
    }
}
