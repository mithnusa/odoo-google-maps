/** @odoo-module */
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarCRM } from './google_map_sidebar';

export class GoogleMapRendererCRM extends GoogleMapRenderer {
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
        values.expectedRevenue = record.data.expected_revenue
            ? record.data.expected_revenue.toLocaleString()
            : false;
        values.probability = record.data.probability || false;
        values.dateDeadline = record.data.date_deadline
            ? record.data.date_deadline.toLocaleString()
            : false;
        return values;
    }
}

GoogleMapRendererCRM.components = {
    ...GoogleMapRenderer.components,
    Sidebar: GoogleMapSidebarCRM,
};
