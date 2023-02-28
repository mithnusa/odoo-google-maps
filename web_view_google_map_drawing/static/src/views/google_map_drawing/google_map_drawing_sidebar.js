/** @odoo-module **/

import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapsDrawingSidebar extends GoogleMapSidebar {
    getData(record) {
        const title = this._getTitle(record) || record.data.gshape_name;
        const subTitle = this._getSubtitle(record) || record.data.gshape_description;
        return {
            title,
            subTitle,
            hasShape: record.id in this.props.shapes || false,
            shape: this.props.shapes[record.id] || false,
        };
    }
}

GoogleMapsDrawingSidebar.template = 'web_view_google_map_drawing.GoogleMapSidebar';
GoogleMapsDrawingSidebar.props = [
    'string',
    'handleOpenRecord',
    'handlePointInMap',
    'records',
    'shapes',
    'fieldTitle',
    'fieldSubtitle',
];
