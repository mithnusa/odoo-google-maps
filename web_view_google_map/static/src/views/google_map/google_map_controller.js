/** @odoo-module **/

import { Layout } from '@web/search/layout';
import { useModel } from '@web/views/model';
import { usePager } from '@web/search/pager_hook';
import { useService } from '@web/core/utils/hooks';
import { standardViewProps } from '@web/views/standard_view_props';
import { useSetupView } from '@web/views/view_hook';
import { Component, useRef } from '@odoo/owl';

export class GoogleMapController extends Component {
    setup() {
        this.actionService = useService('action');
        const rootRef = useRef('root');

        const { Model, resModel, fields, archInfo, limit, state } = this.props;
        const { rootState } = state || {};

        this.model = useModel(Model, {
            fields,
            resModel,
            rootState,
            activeFields: archInfo.activeFields,
            handleField: archInfo.handleField,
            limit: archInfo.limit || limit,
            onCreate: archInfo.onCreate,
            viewMode: 'google_map',
        });

        useSetupView({
            rootRef,
            getGlobalState: () => {
                return {
                    resIds: this.model.root.records.map((rec) => rec.resId),
                };
            },
            getLocalState: () => {
                return {
                    rootState: this.model.root.exportState(),
                };
            },
        });

        usePager(() => {
            const root = this.model.root;
            const { count, hasLimitedCount, limit, offset } = root;
            return {
                offset: offset,
                limit: limit,
                total: count,
                onUpdate: async ({ offset, limit }) => {
                    this.model.root.offset = offset;
                    this.model.root.limit = limit;
                    await this.model.root.load();
                    await this.onUpdatedPager();
                    this.render(true);
                },
                updateTotal: hasLimitedCount ? () => root.fetchCount() : undefined,
            };
        });
    }

    centerMap() {
        this.render(true);
    }

    /**
     * Switch to form view
     * @param {Object} record
     * @param {String} mode
     */
    async openRecord(record, mode) {
        const activeIds = this.model.root.records.map((datapoint) => datapoint.resId);
        this.props.selectRecord(record.resId, { activeIds, mode });
    }

    /**
     * Open form view in a dialog window
     * @param {Object} values
     */
    async showRecord(values) {
        if (values && values.resId) {
            const record = this.model.root.records.find(
                (rec) => rec.resId === values.resId
            );
            if (record) {
                const name = this._getRecordName(record);
                this.model.action.doAction(
                    {
                        name: name,
                        type: 'ir.actions.act_window',
                        res_model: record.resModel,
                        views: [[false, 'form']],
                        view_mode: 'form',
                        res_id: record.resId,
                        target: 'new',
                    },
                    {
                        props: {
                            onSave: async () => {
                                this.model.action.doAction({
                                    type: 'ir.actions.act_window_close',
                                });
                                await record.load({}, { keepChanges: true });
                                record.model.notify();
                            },
                        },
                    }
                );
            }
        }
    }

    /**
     * Get display_name of record
     * @param {Object} record
     * @returns String
     */
    _getRecordName(record) {
        if (
            this.props.archInfo.sidebarTitleField &&
            this.props.archInfo.sidebarTitleField in record.data
        ) {
            return record.data[this.props.archInfo.sidebarTitleField];
        } else if ('name' in record.data) {
            return record.data.name;
        } else if ('display_name' in record.data) {
            return record.data.display_name;
        } else {
            return '';
        }
    }

    get className() {
        return this.props.className;
    }

    async createRecord() {
        await this.props.createRecord();
    }

    get display() {
        return this.props.display;
    }

    get canCreate() {
        const { create } = this.props.archInfo.activeActions;
        return create;
    }

    async onUpdatedPager() {}
}

GoogleMapController.template = 'web_view_google_map.GoogleMapView';
GoogleMapController.components = { Layout };
GoogleMapController.props = {
    ...standardViewProps,
    showButtons: { type: Boolean, optional: true },
    Model: Function,
    Renderer: Function,
    buttonTemplate: String,
    archInfo: Object,
};
GoogleMapController.defaultProps = {
    createRecord: () => {},
    selectRecord: () => {},
    centerMap: () => {},
    showButtons: true,
};
