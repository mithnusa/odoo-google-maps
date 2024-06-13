/** @odoo-module **/

import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarCRM extends GoogleMapSidebar {
    static template = 'crm_google_map.GoogleMapSidebar';

    getData(record) {
        const data = super.getData(record);
        data.expectedRevenue = record.data.expected_revenue
            ? record.data.expected_revenue.toLocaleString()
            : false;
        data.probability = record.data.probability || false;
        data.dateDeadline = record.data.date_deadline
            ? record.data.date_deadline.toLocaleString()
            : false;
        return data;
    }
}
