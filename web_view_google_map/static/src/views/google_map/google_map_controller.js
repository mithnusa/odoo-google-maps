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
        this.user = useService('user');

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

    async openRecord(record, mode) {
        const activeIds = this.model.root.records.map((datapoint) => datapoint.resId);
        this.props.selectRecord(record.resId, { activeIds, mode });
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
