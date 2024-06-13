/** @odoo-module **/

import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarSales extends GoogleMapSidebar {
    static template = 'sales_google_map.GoogleMapSidebar';
    static props = [...GoogleMapSidebar.props, 'openCustomerSales'];

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
