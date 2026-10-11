import { _t } from '@web/core/l10n/translation';
import { Component, t, useProps } from '@odoo/owl';
import { CheckBox } from '@web/core/checkbox/checkbox';
import { Field } from '@web/views/fields/field';

export class GoogleMapSidebar extends Component {
    static template = 'web_view_google_map.GoogleMapSidebar';
    static listGroupOrRecordTemplate = 'web_view_google_map.ListGroupOrRecord';
    static recordItemTemplate = 'web_view_google_map.RecordItem';
    static groupItemTemplate = 'web_view_google_map.GroupItem';
    static components = { CheckBox, Field };
    // Resolved via `this.constructor.propsSchema` (not the
    // `googleMapSidebarProps` constant directly) so a subclass that needs a
    // different prop schema — e.g. the drawing sidebar removing the
    // unsupported `showNearbyRecords` requirement — can override the static
    // instead of adding its own instance-level `useProps()` call. An
    // instance field in the subclass would run too late: this field
    // initializer (inherited from here) runs first during `super()` and
    // already validates against whatever `this.constructor.propsSchema`
    // resolves to for the actual instantiated class. Named `propsSchema`,
    // not `props`, so it can't be confused with the component's own
    // instance-level `props`.
    static propsSchema = {
        header: t.any().optional(true),
        title: t.string(),
        unLocatedCount: t.number(),
        showUnlocatedRecords: t.function(),
        getGroupsOrRecords: t.function(),
        toggleGroup: t.function(),
        renderGroupedRecordsFitBounds: t.function(),
        openRecord: t.function(),
        showRecordsByDomain: t.function(),
        showNearbyRecords: t.function(),
        pointInMap: t.function(),
        deleteGroupRecords: t.function(),
        handleToggleSelection: t.function(),
        handleCanSelectRecord: t.boolean(),
        handleSelectAll: t.boolean(),
        handleToggleRecordSelection: t.function(),
        allowSelectors: t.boolean(),
        isGrouped: t.boolean(),
    };
    props = useProps(this.constructor.propsSchema);
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
