/** @odoo-module **/

import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarSales extends GoogleMapSidebar {
    aggregateTotal(group) {
        let total = 0;
        if (group.aggregates) {
            total = group.aggregates.amount_total || 0;
        }
        return total.toLocaleString();
    }
}

GoogleMapSidebarSales.template = 'sales_google_map.GoogleMapSidebar';
GoogleMapSidebarSales.props = [...GoogleMapSidebar.props, 'openCustomerSales'];
