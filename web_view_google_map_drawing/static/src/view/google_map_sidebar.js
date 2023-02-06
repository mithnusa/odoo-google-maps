/** @odoo-module **/

import { Component, useState, onMounted } from '@odoo/owl';

export class GoogleMapsDrawingSidebar extends Component {
    setup() {
        this.state = useState({ renderId: false });

        console.log(this);

        // FIXME component reactivity
        onMounted(() => {
            this.state.renderId = Math.random().toString(36).substr(2, 8);
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
