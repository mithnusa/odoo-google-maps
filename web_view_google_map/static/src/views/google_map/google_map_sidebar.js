/** @odoo-module **/

import { Component, useState, onMounted } from '@odoo/owl';

export class GoogleMapSidebar extends Component {
    setup() {
        this.state = useState({ renderId: false });

        // FIXME component reactivity
        onMounted(() => {
            this.state.renderId = Math.random().toString(36).substring(2, 12);
        });
    }

    _getDisplayName(record, fieldName, defaultLabel) {
        let default_display_name = defaultLabel || 'Unknown';
        if (fieldName) {
            if (record.fields.hasOwnProperty(fieldName)) {
                if (
                    record.fields[fieldName].type === 'many2one' &&
                    record.data[fieldName]
                ) {
                    if (Array.isArray(record.data[fieldName])) {
                        default_display_name = record.data[fieldName][1];
                    } else if (record.data[fieldName] instanceof Array) {
                        default_display_name =
                            record.data[fieldName].display_name || '-';
                    } else {
                        default_display_name = JSON.stringify(record.data[fieldName]);
                    }
                } else if (record.fields[fieldName].type === 'char') {
                    default_display_name = record.data[fieldName];
                }
                return default_display_name;
            }
            console.warn(
                'Field "' +
                    fieldName +
                    '" not found in record. Field type supported are "many2one" and "char".'
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
                display_name_field =
                    record.fields[record.fields['display_name'].depends[0]];
                if (display_name_field) {
                    try {
                        default_display_name =
                            record.data[display_name_field].data.display_name;
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
        return {
            title,
            subTitle,
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
    'markers',
];
