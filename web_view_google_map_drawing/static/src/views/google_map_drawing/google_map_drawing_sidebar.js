import { _t } from '@web/core/l10n/translation';
import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

const sidebarProps = { ...GoogleMapSidebar.props };
delete sidebarProps.createMarker;

export class GoogleMapsDrawingSidebar extends GoogleMapSidebar {
    static props = {
        ...sidebarProps,
        createShape: Function,
    };
    static recordItemTemplate = 'web_view_google_map_drawing.RecordItem';
    static groupItemTemplate = 'web_view_google_map_drawing.GroupItem';

    async handleGroupCollapse(ev, groupKey) {
        const group = this.datas.find((data) => data.key === groupKey);
        if (!group) return;

        const currentGroupRecords = group.group.records.length;
        let records = [];

        if (!currentGroupRecords) {
            records = await group.group.groupRecords();
        } else {
            records = group.group.records;
        }
        if (currentGroupRecords === 0) {
            records.forEach((record) => {
                this.props.createShape(record, group.group.markerColor);
            });
            this.props.centerMapByGroup(records);
        } else {
            if (!ev.currentTarget.classList.contains('collapsed')) {
                records.forEach((record) => {
                    this.props.createShape(record, group.group.markerColor);
                });
                this.props.centerMapByGroup(records);
            }
        }
    }
}
