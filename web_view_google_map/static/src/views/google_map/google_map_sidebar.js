/** @odoo-module **/

import { Component, useEffect, useState, onMounted, onWillDestroy } from '@odoo/owl';

export class GoogleMapSidebar extends Component {
    setup() {
        console.log(' #->[GoogleMapSidebar::setup]<-# ');
        console.log(this);
        this.state = useState({ isCompleted: null, loadId: null });
        this.defaultColor = '#989696';

        useEffect(() => {
            console.log(' #---<[GoogleMapSidebar::useEffect]>');

            this.state.loadId = new Date().toISOString();
        });

        onMounted(() => {
            console.log(' #---<[GoogleMapSidebar::onMounted]>');
        });
    }

    get getDataDisplay() {
        console.log(' #->[GoogleMapSidebar::getDataDisplay]<-# ');
        console.log(this);
        let data;
        const records = [];
        this.props.records.forEach((record) => {
            data = this.getData(record);
            records.push(data);
        });
        return records;
    }

    _getDisplayName(record, fieldName, defaultLabel) {
        let default_display_name = defaultLabel || 'Unknown';
        if (fieldName) {
            if (record.fields.hasOwnProperty(fieldName)) {
                if (record.fields[fieldName].type === 'many2one') {
                    default_display_name = record.data[fieldName].data
                        ? record.data[fieldName].data.display_name
                        : ' - ';
                } else if (record.fields[fieldName].type === 'char') {
                    default_display_name = record.data[fieldName];
                }
                return default_display_name;
            }
            console.warn(
                'Field "' + fieldName + '" not found in record. Field type supported are "many2one" and "char".'
            );
            return default_display_name;
        } else if (record.data.hasOwnProperty('display_name')) {
            default_display_name = record.data.display_name;
        } else if (record.data.hasOwnProperty('name')) {
            default_display_name = record.data.name;
        } else if (record.fields.hasOwnProperty('display_name')) {
            let display_name_field;
            if (record.fields.display_name.type === 'char') {
                default_display_name = record.data.display_name;
            } else if (
                record.fields['display_name'].hasOwnProperty('depends') &&
                record.fields['display_name'].depends.length > 0
            ) {
                display_name_field = record.fields[record.fields['display_name'].depends[0]];
                if (display_name_field) {
                    try {
                        default_display_name = record.data[display_name_field].data.display_name;
                    } catch (error) {
                        console.warn(error);
                    }
                }
            }
        }
        return default_display_name;
    }

    getData(record) {
        const title = this._getTitle(record);
        const subTitle = this._getSubtitle(record);
        const color = this._getMarkerColor(record);
        const hasGeolocation = color !== this.defaultColor;
        return {
            title,
            subTitle,
            hasGeolocation,
            color,
            record,
        };
    }

    _getTitle(record) {
        let title = this._getDisplayName(record, this.props.fieldTitle, ' - ');
        return title;
    }

    _getSubtitle(record) {
        if (this.props.fieldSubtitle) {
            let title = this._getDisplayName(record, this.props.fieldSubtitle, ' - ');
            return title;
        }
        return;
    }

    _getMarkerColor(record) {
        let color = this.defaultColor;
        const marker = this.props.records.filter((r) => r.hasOwnProperty('_marker')).find((m) => m.id === record.id);
        if (marker) {
            color = marker._marker._odooMarkerColor;
        }
        return color;
    }
}

GoogleMapSidebar.template = 'web_view_google_map.GoogleMapSidebar';
GoogleMapSidebar.props = [
    'string',
    'handleOpenRecord',
    'handlePointInMap',
    'records',
    'fieldLat',
    'fieldLng',
    'fieldTitle',
    'fieldSubtitle',
];
