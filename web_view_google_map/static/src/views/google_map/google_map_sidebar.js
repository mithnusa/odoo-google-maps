/** @odoo-module **/

import { Component } from '@odoo/owl';
import { CheckBox } from '@web/core/checkbox/checkbox';

export class GoogleMapSidebar extends Component {
    hasGeolocation(record) {
        return record._hasGeolocation || this.env.hasGeolocation(record);
    }

    getMarkerColor(record) {
        return record._markerColor || this.env.getMarkerColor(record);
    }

    _getDisplayName(record, fieldName, defaultLabel) {
        let default_display_name = defaultLabel || 'Unknown';
        if (fieldName) {
            if (record.fields.hasOwnProperty(fieldName)) {
                if (record.fields[fieldName].type === 'many2one' && record.data[fieldName]) {
                    if (Array.isArray(record.data[fieldName])) {
                        default_display_name = record.data[fieldName][1];
                    } else if (record.data[fieldName] instanceof Array) {
                        default_display_name = record.data[fieldName].display_name || '-';
                    } else {
                        default_display_name = JSON.stringify(record.data[fieldName]);
                    }
                } else if (record.fields[fieldName].type === 'char') {
                    default_display_name = record.data[fieldName];
                }
                return default_display_name;
            }
            console.error(
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
                display_name_field = record.fields[record.fields['display_name'].depends[0]];
                if (display_name_field) {
                    try {
                        default_display_name = record.data[display_name_field].data.display_name;
                    } catch (error) {
                        console.error(error);
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

    selectRecord(record) {
        this.props.handleToggleRecordSelection(record, true);
    }

    _getTitle(record) {
        return this._getDisplayName(record, this.props.fieldTitle, ' - ');
    }

    _getSubtitle(record) {
        let title = '';
        if (this.props.fieldSubtitle) {
            title = this._getDisplayName(record, this.props.fieldSubtitle, ' - ');
        }
        return title;
    }
}

GoogleMapSidebar.template = 'web_view_google_map.GoogleMapSidebar';
GoogleMapSidebar.components = { CheckBox };
GoogleMapSidebar.props = [
    'string',
    'handleOpenRecord',
    'handlePointInMap',
    'records',
    'fieldTitle',
    'fieldSubtitle',
    'handleToggleSelection',
    'handleCanSelectRecord',
    'handleSelectAll',
    'handleToggleRecordSelection',
    'allowSelectors',
];
