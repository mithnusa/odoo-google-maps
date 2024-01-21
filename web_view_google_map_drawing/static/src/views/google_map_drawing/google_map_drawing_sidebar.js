/** @odoo-module **/
import { _t } from '@web/core/l10n/translation';
import { sprintf } from '@web/core/utils/strings';
import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapsDrawingSidebar extends GoogleMapSidebar {
    static template = 'web_view_google_map_drawing.GoogleMapSidebar';
    static props = [...GoogleMapSidebar.props, 'shapes'];

    getData(record) {
        let extras = [];
        const title = this._getTitle(record) || record.data.gshape_name;
        const subTitle = this._getSubtitle(record) || record.data.gshape_description;
        if (record.data.gshape_type === 'circle') {
            extras = [
                sprintf(_t('Area: %s square meter'), record.data.gshape_area.toLocaleString()),
                sprintf(_t('Radius: %s meter'), record.data.gshape_radius.toLocaleString()),
            ];
        } else if (record.data.gshape_type === 'polygon') {
            extras = [
                sprintf(_t('Area: %s square meter'), record.data.gshape_area.toLocaleString()),
            ];
        } else if (record.data.gshape_type === 'rectangle') {
            extras = [
                sprintf(_t('Area: %s square meter'), record.data.gshape_area.toLocaleString()),
                sprintf(_t('Width: %s meter'), record.data.gshape_width.toLocaleString()),
                sprintf(_t('Height: %s meter'), record.data.gshape_height.toLocaleString()),
            ];
        }

        return {
            title,
            subTitle,
            extras,
            hasShape: record.id in this.props.shapes || false,
            shape: this.props.shapes[record.id] || false,
        };
    }
}
