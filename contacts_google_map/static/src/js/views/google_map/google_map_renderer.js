/** @odoo-module **/

import { renderToString } from '@web/core/utils/render';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarContactAvatar } from './google_map_sidebar';

export class GoogleMapRendererContactAvatar extends GoogleMapRenderer {
    get sidebarComponent() {
        return GoogleMapSidebarContactAvatar;
    }

    /**
     * Override
     * @param {*} record
     * @param {*} isMulti
     * @returns
     */
    getMarkerContent(record, isMulti) {
        const {
            latitudeField,
            longitudeField,
            sidebarTitleField,
            sidebarSubtitleField,
        } = this.props.archInfo;
        const content = renderToString('contacts_google_map.MarkerInfoWindow', {
            record: JSON.stringify({
                id: record.id,
                resId: record.resId,
                resModel: record.resModel,
            }),
            title: record.data[sidebarTitleField],
            destination: `${record.data[latitudeField]},${record.data[longitudeField]}`,
            subTitle: record.data[sidebarSubtitleField],
            isMulti: isMulti,
            avatarUrl: `/web/image/${record.resModel}/${record.resId}/${this.props.archInfo.sidebarAvatarField}`,
        });

        const divContent = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');
        divContent.querySelector('#btn-open_form').addEventListener(
            'click',
            (ev) => {
                const data = ev.target.getAttribute('data-record');
                if (data) {
                    const values = JSON.parse(data);
                    this.props.showRecord(values);
                }
            },
            false
        );
        return divContent;
    }

    get sidebarProps() {
        return Object.assign(
            { fieldAvatar: this.props.archInfo.sidebarAvatarField },
            super.sidebarProps
        );
    }
}
