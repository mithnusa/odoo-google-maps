import { onMounted, onWillUnmount, onWillUpdateProps } from '@odoo/owl';
import { debounce } from '@web/core/utils/timing';
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
     * Sets up Google Maps event listeners and lifecycle hooks.
     * When the map tiles are loaded, automatically triggers group record loading
     * with a 500ms delay to ensure proper rendering.
     */
    setup() {
        super.setup();
        this._isLoading = false;

        this.uiService = useService('ui');

        this.debouncedLoadGroupRecord = debounce(this.loadGroupRecord.bind(this), 500);

        onMounted(() => {
            const googleMap = this.env.googleMap();
            if (!googleMap) return;
            this.debouncedLoadGroupRecord();
        });

        onWillUpdateProps((nextProps) => {
            const googleMap = this.env.googleMap();
            if (!googleMap || !nextProps.isGrouped) return;

            if (this.debouncedLoadGroupRecord.cancel) {
                this.debouncedLoadGroupRecord.cancel();
            }
            this.debouncedLoadGroupRecord();
        });

        onWillUnmount(() => {
            this._isLoading = false;
            if (this.debouncedLoadGroupRecord.cancel) {
                this.debouncedLoadGroupRecord.cancel();
            }
        });
    }

    /**
     * Loads and expands all grouped records on the map.
     * Iterates through all groups and toggles them open
     *
     * @async
     * @returns {Promise<void>}
     */
    async loadGroupRecord() {
        if (this._isLoading || !this.props.isGrouped) return;

        const BATCH_SIZE = 10;
        const datas = this.props.getGroupsOrRecords();
        const groups = datas.filter(({ group }) => group.isFolded);

        if (groups.length === 0) {
            return;
        }

        try {
            this._isLoading = true;
            this.uiService.block();
            for (let i = 0; i < groups.length; i += BATCH_SIZE) {
                const batch = groups.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async ({ group }) => {
                    try {
                        await this.props.toggleGroup(group);
                    } catch (error) {
                        console.error('Error toggling group:', error);
                    }
                }));
            }
        } catch (error) {
            console.error('Error toggling group:', error);
        } finally {
            this._isLoading = false;
            this.uiService.unblock();
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
    getAvatarUrl({ group }) {
        const partnerId = group?.value;
        if (Number.isFinite(partnerId) && typeof partnerId === 'number') {
            return `/web/image/res.partner/${partnerId}/avatar_128`;
        }
        return null;
    }
}
