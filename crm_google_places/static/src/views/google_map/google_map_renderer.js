import { GoogleMapPlacesRenderer } from '@base_google_places/views/google_map_places/google_map_places_renderer';
import { GoogleMapSidebarCRM } from '@crm_google_map/views/google_map/google_map_sidebar';

export class GoogleMapPlacesRendererCRM extends GoogleMapPlacesRenderer {
    static components = {
        ...GoogleMapPlacesRenderer.components,
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
        const { expectedRevenue, probability, dateDeadline, partnerId, userId } = record.dataView.other || {};
        values.expectedRevenue = expectedRevenue ? expectedRevenue.toLocaleString() : false;
        values.probability = probability || 0;
        values.dateDeadline = dateDeadline ? dateDeadline.toLocaleString() : false;
        values.partnerName = partnerId ? partnerId.display_name : false;
        values.salespersonName = userId ? userId.display_name : false;
        return values;
    }
}
