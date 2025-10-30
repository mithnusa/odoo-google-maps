import { onMounted } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarSaleOrder extends GoogleMapSidebar {
    static template = 'sale_google_map.GoogleMapSidebar';
    static groupItemTemplate = 'sale_google_map.GroupItem';

    setup() {
        super.setup();
        this.uiService = useService('ui');
        onMounted(this.loadGroupRecord);
    }

    async loadGroupRecord() {
        const datas = this.props.getGroupsOrRecords();
        if (this.props.isGrouped && datas.length > 0) {
            const groupPromises = datas.map(async ({ group }) => {
                try {
                    await group.toggle();
                } catch (error) {
                    console.error('Error toggling group:', error);
                }
            });

            try {
                this.uiService.block();
                await Promise.all(groupPromises);
            } finally {
                this.uiService.unblock();
            }
        }
    }

    getAvatarUrl(group) {
        const partnerId = group.group.value;
        if (partnerId) {
            return `/web/image/res.partner/${partnerId}/image_128`;
        }
        return null;
    }
}
