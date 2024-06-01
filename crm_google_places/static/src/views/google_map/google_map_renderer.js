/** @odoo-module **/
import { GoogleMapPlacesRenderer } from '@base_google_places/views/google_map_places/google_map_places_renderer';
import { GoogleMapSidebarCRM } from '@crm_google_map/views/google_map/google_map_sidebar';

export class GoogleMapPlacesRendererCRM extends GoogleMapPlacesRenderer {
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

GoogleMapPlacesRendererCRM.components = {
    ...GoogleMapPlacesRenderer.components,
    Sidebar: GoogleMapSidebarCRM,
};
