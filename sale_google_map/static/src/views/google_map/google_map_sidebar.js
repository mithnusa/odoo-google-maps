import { onMounted, onWillUnmount } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

/**
 * Google Map Sidebar component for Sale Orders.
 * Extends the base GoogleMapSidebar with sale order-specific functionality,
 * including automatic group loading and partner avatar display.
 *
 * @extends GoogleMapSidebar
 */
export class GoogleMapSidebarSaleOrder extends GoogleMapSidebar {
    static template = 'sale_google_map.GoogleMapSidebar';
    static groupItemTemplate = 'sale_google_map.GroupItem';

    /**
     * Initializes the component.
     * Sets up UI service, Google Maps event listeners, and lifecycle hooks.
     * When the map tiles are loaded, automatically triggers group record loading
     * with a 300ms delay to ensure proper rendering.
     */
    setup() {
        super.setup();
        this.uiService = useService('ui');
        this.loadGroupTimeout = null;

        onMounted(() => {
            const googleMap = this.env.googleMap();
            if (!googleMap) return;

            google.maps.event.addListenerOnce(googleMap, 'tilesloaded', () => {
                if (this.loadGroupTimeout) {
                    clearTimeout(this.loadGroupTimeout);
                }
                this.loadGroupTimeout = setTimeout(() => {
                    this.loadGroupRecord();
                }, 300);
            });
        });

        onWillUnmount(() => {
            if (this.loadGroupTimeout) {
                clearTimeout(this.loadGroupTimeout);
                this.loadGroupTimeout = null;
            }
        });
    }

    /**
     * Loads and expands all grouped records on the map.
     * Iterates through all groups, toggles them open, and adjusts the map bounds
     * to fit all grouped records. Blocks the UI during the operation to prevent
     * user interaction with partially loaded data.
     *
     * @async
     * @returns {Promise<void>}
     */
    async loadGroupRecord() {
        if (this.props.isGrouped) {
            const datas = this.props.getGroupsOrRecords();
            const groupPromises = datas.map(async ({ group }) => {
                try {
                    await this.props.toggleGroup(group);
                } catch (error) {
                    console.error('Error toggling group:', error);
                }
            });

            try {
                this.uiService.block();
                await Promise.all(groupPromises);
                const updatedDatas = this.props.getGroupsOrRecords();
                await this.props.renderGroupedRecordsFitBounds(updatedDatas);
            } finally {
                this.uiService.unblock();
            }
        }
    }

    /**
     * Gets the avatar URL for a partner associated with a group.
     * Constructs the URL to fetch the partner's avatar image from Odoo.
     *
     * @param {Object} group - The group object containing partner information
     * @param {Object} group.group - The group data
     * @param {number} group.group.value - The partner ID
     * @returns {string|null} The avatar URL if partner ID exists, null otherwise
     */
    getAvatarUrl(group) {
        const partnerId = group?.group?.value;
        if (partnerId) {
            return `/web/image/res.partner/${partnerId}/avatar_128`;
        }
        return null;
    }
}
