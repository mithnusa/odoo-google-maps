/** @odoo-module **/

import { Component, useState, onMounted, onRendered, useEffect } from '@odoo/owl';

export class GoogleMapsDrawingSidebar extends Component {
    setup() {
        this.state = useState({ renderId: false });

        // FIXME component reactivity
        onMounted(() => {
            this.state.renderId = Math.random().toString(36).substring(2, 12);
        });

    }

    getData(record) {
        return {
            title: record.data.gshape_name,
            description: record.data.gshape_description,
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
];
