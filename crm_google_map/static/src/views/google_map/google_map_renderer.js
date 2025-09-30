import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarCRM } from './google_map_sidebar';

export class GoogleMapRendererCRM extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarCRM,
    };

    /**
     * @overwrite
     */
    get infoWindowTemplate() {
        return 'crm_google_map.MarkerInfoWindow';
    }

    /**
     * @override
     */
    prepareInfoWindowValues(record, isMulti) {
        let values = super.prepareInfoWindowValues(record, isMulti);
        const { other } = record.dataView;
        const { expectedRevenue, probability, dateDeadline } = other;
        values.expectedRevenue = expectedRevenue ? expectedRevenue.toLocaleString() : false;
        values.probability = probability || 0;
        values.dateDeadline = dateDeadline ? dateDeadline.toLocaleString() : false;
        values.partnerName = other.partnerId ? other.partnerId.display_name : false;
        values.salespersonName = other.userId ? other.userId.display_name : false;
        return values;
    }
}
