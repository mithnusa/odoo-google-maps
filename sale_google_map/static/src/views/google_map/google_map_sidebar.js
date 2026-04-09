/** @odoo-module **/
import { onWillUnmount, onMounted, onWillUpdateProps } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { debounce as debounceFn } from '@web/core/utils/timing';
import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarSales extends GoogleMapSidebar {
    static template = 'sales_google_map.GoogleMapSidebar';
    static props = [...GoogleMapSidebar.props, 'openCustomerSales', 'isGrouped'];

    setup() {
        super.setup();
        this.uiService = useService('ui');
        this._isLoading = false;

        this.debouncedLoadGroupRecord = debounceFn(this.loadGroupRecord.bind(this), 500);

        onMounted(() => {
            const googleMap = this.env.googleMap();
            if (!googleMap) return;

            if (this.debouncedLoadGroupRecord.cancel) {
                this.debouncedLoadGroupRecord.cancel();
            }

            this.debouncedLoadGroupRecord();
        });

        onWillUpdateProps((nextProps) => {
            const googleMap = this.env.googleMap();
            if (!googleMap) return;

            if (this._checkRecordsChange(this.props.records, nextProps.records)) {
                if (this.debouncedLoadGroupRecord.cancel) {
                    this.debouncedLoadGroupRecord.cancel();
                }
                this.debouncedLoadGroupRecord();
            }
        });

        onWillUnmount(() => {
            this._isLoading = false;
            if (this.debouncedLoadGroupRecord.cancel) {
                this.debouncedLoadGroupRecord.cancel();
            }
        });
    }

    _checkRecordsChange(currentRecords, nextRecords) {
        if (currentRecords.length !== nextRecords.length) {
            return true;
        }
        const currentIds = currentRecords
            .map((r) => r.id)
            .sort()
            .join(',');
        const nextIds = nextRecords
            .map((r) => r.id)
            .sort()
            .join(',');
        return currentIds !== nextIds;
    }

    async loadGroupRecord() {
        if (this._isLoading || !this.props.isGrouped) return;

        const foldedGroups = this.props.records.filter((g) => g.isFolded);
        if (foldedGroups.length === 0) return;

        const BATCH_SIZE = 10;

        try {
            this._isLoading = true;
            this.uiService.block();
            for (let i = 0; i < foldedGroups.length; i += BATCH_SIZE) {
                const batchGroups = foldedGroups.slice(i, i + BATCH_SIZE);
                await Promise.all(
                    batchGroups.map(async (group) => {
                        try {
                            await group.toggle();
                        } catch (error) {
                            console.error(`Failed to load group ${group.displayName}:`, error);
                        }
                    })
                );
            }
        } finally {
            this._isLoading = false;
            this.uiService.unblock();
        }
    }

    aggregateTotal(group) {
        let total = 0;
        if (group.aggregates) {
            total = group.aggregates.amount_total || 0;
        }
        return total.toLocaleString();
    }

    hasGeolocation(record) {
        return record._hasGeolocation || false;
    }

    getMarkerColor(record) {
        return record._markerColor || 'red';
    }
}
