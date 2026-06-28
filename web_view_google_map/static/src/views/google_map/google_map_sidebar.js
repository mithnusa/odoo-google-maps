import { _t } from '@web/core/l10n/translation';
import { Component } from '@odoo/owl';
import { CheckBox } from '@web/core/checkbox/checkbox';
import { Field } from '@web/views/fields/field';

export class GoogleMapSidebar extends Component {
    static template = 'web_view_google_map.GoogleMapSidebar';
    static listGroupOrRecordTemplate = 'web_view_google_map.ListGroupOrRecord';
    static recordItemTemplate = 'web_view_google_map.RecordItem';
    static groupItemTemplate = 'web_view_google_map.GroupItem';
    /**
     * Optional extra content rendered below the record title inside the
     * content <td>.  Override in a sub-class to inject module-specific
     * fields (e.g. amount + stage for CRM) without touching RecordItem.
     */
    static recordExtraTemplate = 'web_view_google_map.RecordItemExtra';
    /**
     * Optional extra action buttons rendered inside the actions <td>, between
     * the Nearby and Open buttons.  Override in a sub-class to inject
     * module-specific actions (e.g. View Tasks for project) without touching
     * RecordItem.
     */
    static recordActionsTemplate = 'web_view_google_map.RecordActionsTemplate';
    static components = { CheckBox, Field };
    static props = {
        header: String,
        title: { type: String, optional: true },
        getGroupsOrRecords: Function,
        toggleGroup: Function,
        renderGroupedRecordsFitBounds: Function,
        openRecord: Function,
        showRecordsByDomain: Function,
        showNearbyRecords: Function,
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

    get geolocationInfoTooltip() {
        return _t('Only records with geolocation data set are displayed');
    }

    /**
     * Returns the translated display label for a group header, including its record count.
     * Used in the GroupItem template to avoid untranslated JS string literals.
     */
    getGroupTitle(group) {
        const displayName = group.group.displayName || _t('None');
        return `${displayName} (${group.group.count})`;
    }

    /**
     * Center the map based on the group records
     * @param {*} ev
     * @param {*} groupKey
     */
    async handleGroupCollapse(ev, groupKey) {
        const { group } = this.datas.find((data) => data.key === groupKey);
        if (!group) return;

        const isExpanding = !ev.currentTarget?.classList.contains('collapsed');

        if (isExpanding && group.records.length === 0) {
            await this.props.toggleGroup(group);
        }

        const groupDatas = this.props.getGroupsOrRecords().filter((data) => data.key === groupKey);

        if (isExpanding) {
            await this.props.renderGroupedRecordsFitBounds(groupDatas);
        } else {
            await this.props.deleteGroupRecords(groupDatas);
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
