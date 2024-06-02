/** @odoo-module **/

import { Layout } from '@web/search/layout';
import { useModel } from '@web/views/model';
import { usePager } from '@web/search/pager_hook';
import { useService } from '@web/core/utils/hooks';
import { sprintf } from '@web/core/utils/strings';
import { unique } from '@web/core/utils/arrays';
import { ExportDataDialog } from '@web/views/view_dialogs/export_data_dialog';
import { download } from '@web/core/network/download';
import { ConfirmationDialog } from '@web/core/confirmation_dialog/confirmation_dialog';
import { ActionMenus } from '@web/search/action_menus/action_menus';
import { standardViewProps } from '@web/views/standard_view_props';
import { useSetupView } from '@web/views/view_hook';
import { Component, useRef, onWillStart } from '@odoo/owl';
import { getCurrentActionId } from './utils';

export class GoogleMapController extends Component {
    setup() {
        const rootRef = useRef('root');
        this.ui = useService('ui');
        this.dialogService = useService('dialog');
        this.notificationService = useService('notification');
        this.rpc = useService('rpc');
        this.userService = useService('user');

        const { Model, resModel, fields, archInfo, limit, state } = this.props;
        const { rootState } = state || {};

        this.activeActions = archInfo.activeActions;
        this.multiEdit = archInfo.multiEdit;

        this.model = useModel(Model, {
            resId: this.props.resId || false,
            resIds: this.props.resIds,
            resModel,
            rootState,
            fields,
            activeFields: archInfo.activeFields,
            handleField: archInfo.handleField,
            limit: archInfo.limit || limit,
            onCreate: archInfo.onCreate,
            viewMode: 'google_map',
            multiEdit: this.multiEdit,
        });

        this.archiveEnabled =
            'active' in fields
                ? !fields.active.readonly
                : 'x_active' in fields
                ? !fields.x_active.readonly
                : false;

        onWillStart(async () => {
            this.isExportEnable = await this.userService.hasGroup('base.group_allow_export');
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

    async onDeleteSelectedRecords() {
        this.dialogService.add(ConfirmationDialog, this.deleteConfirmationDialogProps);
    }

    discardSelection() {
        this.model.root.records.forEach((record) => {
            record.toggleSelection(false);
        });
    }

    getSelectedResIds() {
        return this.model.root.getResIds(true);
    }

    getActionMenuItems() {
        const isM2MGrouped = this.model.root.isM2MGrouped;
        const otherActionItems = [];
        if (this.isExportEnable) {
            otherActionItems.push({
                key: 'export',
                description: this.env._t('Export'),
                callback: () => this.onExportData(),
            });
        }
        if (this.archiveEnabled && !isM2MGrouped) {
            otherActionItems.push({
                key: 'archive',
                description: this.env._t('Archive'),
                callback: () => {
                    const dialogProps = {
                        body: this.env._t(
                            'Are you sure that you want to archive all the selected records?'
                        ),
                        confirmLabel: this.env._t('Archive'),
                        confirm: () => {
                            this.toggleArchiveState(true);
                        },
                        cancel: () => {},
                    };
                    this.dialogService.add(ConfirmationDialog, dialogProps);
                },
            });
            otherActionItems.push({
                key: 'unarchive',
                description: this.env._t('Unarchive'),
                callback: () => this.toggleArchiveState(false),
            });
        }
        if (this.activeActions.delete && !isM2MGrouped) {
            otherActionItems.push({
                key: 'delete',
                description: this.env._t('Delete'),
                callback: () => this.onDeleteSelectedRecords(),
            });
        }
        return Object.assign({}, this.props.info.actionMenus, { other: otherActionItems });
    }

    async onSelectDomain() {
        this.model.root.selectDomain(true);
        if (this.props.onSelectionChanged) {
            const resIds = await this.model.root.getResIds(true);
            this.props.onSelectionChanged(resIds);
        }
    }

    async onExportData() {
        const dialogProps = {
            context: this.props.context,
            defaultExportList: this.defaultExportList,
            download: this.downloadExport.bind(this),
            getExportedFields: this.getExportedFields.bind(this),
            root: this.model.root,
        };
        this.dialogService.add(ExportDataDialog, dialogProps);
    }

    async downloadExport(fields, import_compat, format) {
        let ids = false;
        if (!this.isDomainSelected) {
            const resIds = await this.getSelectedResIds();
            ids = resIds.length > 0 && resIds;
        }
        const exportedFields = fields.map((field) => ({
            name: field.name || field.id,
            label: field.label || field.string,
            store: field.store,
            type: field.field_type || field.type,
        }));
        if (import_compat) {
            exportedFields.unshift({ name: 'id', label: this.env._t('External ID') });
        }
        await download({
            data: {
                data: JSON.stringify({
                    import_compat,
                    context: this.props.context,
                    domain: this.model.root.domain,
                    fields: exportedFields,
                    groupby: this.model.root.groupBy,
                    ids,
                    model: this.model.root.resModel,
                }),
            },
            url: `/web/export/${format}`,
        });
    }
    async getExportedFields(model, import_compat, parentParams) {
        return await this.rpc('/web/export/get_fields', {
            ...parentParams,
            model,
            import_compat,
        });
    }
    async toggleArchiveState(archive) {
        let resIds;
        const isDomainSelected = this.model.root.isDomainSelected;
        const total = this.model.root.count;
        if (archive) {
            resIds = await this.model.root.archive(true);
        } else {
            resIds = await this.model.root.unarchive(true);
        }
        if (
            isDomainSelected &&
            resIds.length === session.active_ids_limit &&
            resIds.length < total
        ) {
            this.notificationService.add(
                sprintf(
                    this.env._t(
                        'Of the %d records selected, only the first %d have been archived/unarchived.'
                    ),
                    resIds.length,
                    total
                ),
                { title: this.env._t('Warning') }
            );
        }
    }

    get deleteConfirmationDialogProps() {
        const root = this.model.root;
        const body =
            root.isDomainSelected || root.selection.length > 1
                ? this.env._t('Are you sure you want to delete these records?')
                : this.env._t('Are you sure you want to delete this record?');
        return {
            body,
            confirm: async () => {
                const total = root.count;
                const resIds = await this.model.root.deleteRecords();
                this.model.notify();
                if (
                    root.isDomainSelected &&
                    resIds.length === session.active_ids_limit &&
                    resIds.length < total
                ) {
                    this.notificationService.add(
                        sprintf(
                            this.env._t(
                                `Only the first %s records have been deleted (out of %s selected)`
                            ),
                            resIds.length,
                            total
                        ),
                        { title: this.env._t('Warning') }
                    );
                }
            },
            cancel: () => {},
        };
    }
    async onDirectExportData() {
        await this.downloadExport(this.defaultExportList, false, 'xlsx');
    }
    get defaultExportList() {
        return unique(
            this.props.archInfo.columns
                .filter((col) => col.type === 'field')
                .filter((col) => !col.optional || this.optionalActiveFields[col.name])
                .map((col) => this.props.fields[col.name])
                .filter((field) => field.exportable !== false)
        );
    }
    async onExportData() {
        const dialogProps = {
            context: this.props.context,
            defaultExportList: this.defaultExportList,
            download: this.downloadExport.bind(this),
            getExportedFields: this.getExportedFields.bind(this),
            root: this.model.root,
        };
        this.dialogService.add(ExportDataDialog, dialogProps);
    }
    async downloadExport(fields, import_compat, format) {
        let ids = false;
        if (!this.isDomainSelected) {
            const resIds = await this.getSelectedResIds();
            ids = resIds.length > 0 && resIds;
        }
        const exportedFields = fields.map((field) => ({
            name: field.name || field.id,
            label: field.label || field.string,
            store: field.store,
            type: field.field_type || field.type,
        }));
        if (import_compat) {
            exportedFields.unshift({ name: 'id', label: this.env._t('External ID') });
        }
        await download({
            data: {
                data: JSON.stringify({
                    import_compat,
                    context: this.props.context,
                    domain: this.model.root.domain,
                    fields: exportedFields,
                    groupby: this.model.root.groupBy,
                    ids,
                    model: this.model.root.resModel,
                }),
            },
            url: `/web/export/${format}`,
        });
    }

    centerMap() {
        if (this.props.allowSelectors) {
            this.ui.bus.trigger('google-map-center-map');
        } else {
            this.render(true);
        }
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

    async _getActionFormView(actionId, resId) {
        if (!actionId) return;
        return await this.model.orm.call('google.map.view.mixins', 'handle_find_action_form_view', [
            actionId,
            resId,
        ]);
    }

    /**
     * Open form view in a dialog window
     * @param {Object} values
     */
    async showRecord(values) {
        if (values && values.resId) {
            const record = this.model.root.records.find((rec) => rec.resId === values.resId);
            if (record) {
                const currentActionId = getCurrentActionId();
                let action;
                if (currentActionId) {
                    action = await this._getActionFormView(currentActionId, record.resId);
                    if (action) {
                        action.target = 'new';
                    }
                }

                if (!action) {
                    const name = this._getRecordName(record);
                    action = {
                        name: name,
                        type: 'ir.actions.act_window',
                        res_model: record.resModel,
                        views: [[false, 'form']],
                        view_mode: 'form',
                        res_id: record.resId,
                        target: 'new',
                    };
                }

                this.model.action.doAction(action, {
                    props: {
                        onSave: async () => {
                            this.model.action.doAction({
                                type: 'ir.actions.act_window_close',
                            });
                            await record.load({}, { keepChanges: true });
                            record.model.notify();
                        },
                    },
                });
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

    get nbSelected() {
        return this.model.root.selection.length;
    }

    get isPageSelected() {
        const root = this.model.root;
        return root.selection.length === root.records.length;
    }

    get isDomainSelected() {
        return this.model.root.isDomainSelected;
    }

    get nbTotal() {
        return this.model.root.count;
    }

    get hasSelectors() {
        return this.props.allowSelectors && !this.env.isSmall;
    }

    async onUpdatedPager() {}
}

GoogleMapController.template = 'web_view_google_map.GoogleMapView';
GoogleMapController.components = { Layout, ActionMenus };
GoogleMapController.props = {
    ...standardViewProps,
    showButtons: { type: Boolean, optional: true },
    Model: Function,
    Renderer: Function,
    buttonTemplate: String,
    archInfo: Object,
    allowSelectors: { type: Boolean, optional: true },
    onSelectionChanged: { type: Function, optional: true },
};
GoogleMapController.defaultProps = {
    createRecord: () => {},
    selectRecord: () => {},
    centerMap: () => {},
    showButtons: true,
    allowSelectors: true,
};
