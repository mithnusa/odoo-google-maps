import { user } from '@web/core/user';
import { formatNumber } from '@web_view_google_map/views/google_map/utils';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarCRM } from './google_map_sidebar';

export class GoogleMapRendererCRM extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarCRM,
    };
    static templateInfoWindow = 'crm_google_map.MarkerInfoWindow';

    /**
     * @override
     */
    prepareInfoWindowValues(record) {
        let values = super.prepareInfoWindowValues(record);
        const { other } = record.dataView;
        const { expectedRevenue, probability, dateDeadline } = other;
        values.expectedRevenue = expectedRevenue ? formatNumber(expectedRevenue, 2, user.context.lang) : false;
        values.probability = probability || 0;
        values.dateDeadline = dateDeadline ? dateDeadline.toLocaleString() : false;
        values.partnerName = other.partnerId ? other.partnerId.display_name : false;
        values.salespersonName = other.userId ? other.userId.display_name : false;
        return values;
    }
}
