import { onMounted } from '@odoo/owl';
import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarSaleOrder extends GoogleMapSidebar {
    static groupItemTemplate = 'sale_google_map.GroupItem';

    setup() {
        super.setup();
        onMounted(async() => {
            const datas = this.props.getGroupsOrRecords();
            if (this.props.isGrouped && datas.length > 0) {
                const groupPromises = datas.map(async ({ group }) => {
                    try {
                        await group.toggle();
                    } catch (error) {
                        console.error('Error toggling group:', error);
                    }
                });
                await Promise.all(groupPromises);
            }
        });
    }

    getAvatarUrl(group) {
        const partnerId = group.group.value;
        if (partnerId) {
            return `/web/image/res.partner/${partnerId}/image_128`;
        }
        return null;
    }
}
