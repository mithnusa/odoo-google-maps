/** @odoo-module **/

import { _t } from '@web/core/l10n/translation';
import { Layout } from '@web/search/layout';
import { useModelWithSampleData } from '@web/model/model';
import { extractFieldsFromArchInfo } from '@web/model/relational_model/utils';
import { usePager } from '@web/search/pager_hook';
import { useService } from '@web/core/utils/hooks';
import { unique } from '@web/core/utils/arrays';
import { ExportDataDialog } from '@web/views/view_dialogs/export_data_dialog';
import { download } from '@web/core/network/download';
import {
    ConfirmationDialog,
    deleteConfirmationMessage,
} from '@web/core/confirmation_dialog/confirmation_dialog';
import { omit } from '@web/core/utils/objects';
import { ActionMenus, STATIC_ACTIONS_GROUP_NUMBER } from '@web/search/action_menus/action_menus';
import { standardViewProps } from '@web/views/standard_view_props';
import { useSetupView } from '@web/views/view_hook';
import { session } from '@web/session';
import { SearchBar } from '@web/search/search_bar/search_bar';
import { useSearchBarToggler } from '@web/search/search_bar/search_bar_toggler';
import { ViewButton } from '@web/views/view_button/view_button';
import { executeButtonCallback } from '@web/views/view_button/view_button_hook';
import { CogMenu } from '@web/search/cog_menu/cog_menu';

import {
    Component,
    useRef,
    onWillStart,
    useState,
    useSubEnv,
    useEffect,
    onWillPatch,
} from '@odoo/owl';

export class GoogleMapController extends Component {
    static template = 'web_view_google_map.GoogleMapView';
    static components = { Layout, ActionMenus, SearchBar, ViewButton, CogMenu };
    static props = {
        ...standardViewProps,
        Model: Function,
        Renderer: Function,
        buttonTemplate: String,
        archInfo: Object,
        showButtons: { type: Boolean, optional: true },
        allowSelectors: { type: Boolean, optional: true },
        onSelectionChanged: { type: Function, optional: true },
    };
    static defaultProps = {
        createRecord: () => {},
        selectRecord: () => {},
        centerMap: () => {},
        showButtons: true,
        allowSelectors: true,
    };

    setup() {
        this.ui = useService('ui');
        this.dialogService = useService('dialog');
        this.actionService = useService('action');
        this.notificationService = useService('notification');
        this.rpc = useService('rpc');
        this.userService = useService('user');

        this.rootRef = useRef('root');

        this.archInfo = this.props.archInfo;
        this.activeActions = this.props.archInfo.activeActions;
        this.multiEdit = this.props.archInfo.multiEdit;
        this.model = useState(useModelWithSampleData(this.props.Model, this.modelParams));

        this.archiveEnabled =
            'active' in this.props.fields
                ? !this.props.fields.active.readonly
                : 'x_active' in this.props.fields
                ? !this.props.fields.x_active.readonly
                : false;

        onWillStart(async () => {
            this.isExportEnable = await this.userService.hasGroup('base.group_allow_export');
        });

        useSubEnv({ model: this.model });

        useSetupView({
            rootRef: this.rootRef,
            beforeLeave: async () => {
                return this.model.root.leaveEditMode();
            },
            beforeUnload: async (ev) => {
                const editedRecord = this.model.root.editedRecord;
                if (editedRecord) {
                    const isValid = await editedRecord.urgentSave();
                    if (!isValid) {
                        ev.preventDefault();
                        ev.returnValue = 'Unsaved changes';
                    }
                }
            },
            getGlobalState: () => {
                return {
                    resIds: this.model.root.records.map((rec) => rec.resId),
                };
            },
            getLocalState: () => {
                return {
                    modelState: this.model.exportState(),
                };
            },
        });

        usePager(() => {
            const { count, hasLimitedCount, isGrouped, limit, offset } = this.model.root;
            return {
                offset: offset,
                limit: limit,
                total: count,
                onUpdate: async ({ offset, limit }) => {
                    if (this.model.root.editedRecord) {
                        if (!(await this.model.root.editedRecord.save())) {
                            return;
                        }
                    }
                    await this.model.root.load({ limit, offset });
                },
                updateTotal:
                    !isGrouped && hasLimitedCount ? () => this.model.root.fetchCount() : undefined,
            };
        });

        useEffect(
            () => {
                if (this.props.onSelectionChanged) {
                    const resIds = this.model.root.selection.map((record) => record.resId);
                    this.props.onSelectionChanged(resIds);
                }
            },
            () => [this.model.root.selection.length]
        );
        this.searchBarToggler = useSearchBarToggler();
        this.firstLoad = true;
        onWillPatch(() => {
            this.firstLoad = false;
        });
    }

    get modelParams() {
        const { activeFields, fields } = extractFieldsFromArchInfo(
            this.archInfo,
            this.props.fields
        );

        const modelConfig = this.props.state?.modelState?.config || {
            resModel: this.props.resModel,
            fields,
            activeFields,
            openGroupsByDefault: false,
        };

        return {
            config: modelConfig,
            state: this.props.state?.modelState,
            groupByInfo: {},
            limit: this.archInfo.limit || this.props.limit,
            countLimit: this.archInfo.countLimit,
            defaultOrderBy: this.archInfo.defaultOrder,
            defaultGroupBy: false,
            groupsLimit: this.archInfo.groupsLimit,
            multiEdit: this.archInfo.multiEdit,
            activeIdsLimit: session.active_ids_limit,
            hooks: {
                onRecordSaved: this.onRecordSaved.bind(this),
                onWillSaveRecord: this.onWillSaveRecord.bind(this),
            },
        };
    }

    async onRecordSaved(record) {}

    async onWillSaveRecord(record) {}

    async onDeleteSelectedRecords() {
        this.dialogService.add(ConfirmationDialog, this.deleteConfirmationDialogProps);
    }

    discardSelection() {
        this.model.root.records.forEach((record) => {
            record.toggleSelection(false);
        });
    }

    async beforeExecuteActionButton(clickParams) {
        if (clickParams.special !== 'cancel' && this.model.root.editedRecord) {
            return this.model.root.editedRecord.save();
        }
    }

    async afterExecuteActionButton(clickParams) {}

    getSelectedResIds() {
        return this.model.root.getResIds(true);
    }

    async duplicateRecords() {
        return this.model.root.duplicateRecords();
    }

    getStaticActionMenuItems() {
        const list = this.model.root;
        const isM2MGrouped = list.groupBy.some((groupBy) => {
            const fieldName = groupBy.split(':')[0];
            return list.fields[fieldName].type === 'many2many';
        });
        return {
            export: {
                isAvailable: () => this.isExportEnable,
                sequence: 10,
                icon: 'fa fa-upload',
                description: _t('Export'),
                callback: () => this.onExportData(),
            },
            archive: {
                isAvailable: () => this.archiveEnabled && !isM2MGrouped,
                sequence: 20,
                icon: 'oi oi-archive',
                description: _t('Archive'),
                callback: () => {
                    this.dialogService.add(ConfirmationDialog, this.archiveDialogProps);
                },
            },
            unarchive: {
                isAvailable: () => this.archiveEnabled && !isM2MGrouped,
                sequence: 30,
                icon: 'oi oi-unarchive',
                description: _t('Unarchive'),
                callback: () => this.toggleArchiveState(false),
            },
            duplicate: {
                isAvailable: () => this.activeActions.duplicate && !isM2MGrouped,
                sequence: 35,
                icon: 'fa fa-clone',
                description: _t('Duplicate'),
                callback: () => this.duplicateRecords(),
            },
            delete: {
                isAvailable: () => this.activeActions.delete && !isM2MGrouped,
                sequence: 40,
                icon: 'fa fa-trash-o',
                description: _t('Delete'),
                callback: () => this.onDeleteSelectedRecords(),
            },
        };
    }

    get archiveDialogProps() {
        return {
            body: _t('Are you sure that you want to archive all the selected records?'),
            confirmLabel: _t('Archive'),
            confirm: () => {
                this.toggleArchiveState(true);
            },
            cancel: () => {},
        };
    }

    get actionMenuItems() {
        const { actionMenus } = this.props.info;
        const staticActionItems = Object.entries(this.getStaticActionMenuItems())
            .filter(([key, item]) => item.isAvailable === undefined || item.isAvailable())
            .sort(([k1, item1], [k2, item2]) => (item1.sequence || 0) - (item2.sequence || 0))
            .map(([key, item]) =>
                Object.assign(
                    { key, groupNumber: STATIC_ACTIONS_GROUP_NUMBER },
                    omit(item, 'isAvailable')
                )
            );

        return {
            action: [...staticActionItems, ...(actionMenus.action || [])],
            print: actionMenus.print,
        };
    }

    getActionMenuItems() {
        const isM2MGrouped = this.model.root.isM2MGrouped;
        const otherActionItems = [];
        if (this.isExportEnable) {
            otherActionItems.push({
                key: 'export',
                description: _t('Export'),
                callback: () => this.onExportData(),
            });
        }
        if (this.archiveEnabled && !isM2MGrouped) {
            otherActionItems.push({
                key: 'archive',
                description: _t('Archive'),
                callback: () => {
                    const dialogProps = {
                        body: _t('Are you sure that you want to archive all the selected records?'),
                        confirmLabel: _t('Archive'),
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
                description: _t('Unarchive'),
                callback: () => this.toggleArchiveState(false),
            });
        }
        if (this.activeActions.delete && !isM2MGrouped) {
            otherActionItems.push({
                key: 'delete',
                description: _t('Delete'),
                callback: () => this.onDeleteSelectedRecords(),
            });
        }
        return Object.assign({}, this.props.info.actionMenus, { other: otherActionItems });
    }

    async onSelectDomain() {
        await this.model.root.selectDomain(true);
        if (this.props.onSelectionChanged) {
            const resIds = await this.model.root.getResIds(true);
            this.props.onSelectionChanged(resIds);
        }
    }

    onUnselectAll() {
        this.model.root.selection.forEach((record) => {
            if ('_toggleMarkerSelection' in record) {
                record.toggleSelection(false).then(() => {
                    record._toggleMarkerSelection(record);
                });
            } else {
                record.toggleSelection(false);
            }
        });
        this.model.root.selectDomain(false);
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
            exportedFields.unshift({
                name: 'id',
                label: _t('External ID'),
            });
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
        if (archive) {
            return this.model.root.archive(true);
        }
        return this.model.root.unarchive(true);
    }

    get deleteConfirmationDialogProps() {
        const root = this.model.root;
        let body = deleteConfirmationMessage;
        if (root.isDomainSelected || root.selection.length > 1) {
            body = _t('Are you sure you want to delete these records?');
        }
        return {
            title: _t('Bye-bye, record!'),
            body,
            confirmLabel: _t('Delete'),
            confirm: () => this.model.root.deleteRecords(),
            cancel: () => {},
            cancelLabel: _t('No, keep it'),
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
            exportedFields.unshift({ name: 'id', label: _t('External ID') });
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
    async openRecord(record) {
        if (this.archInfo.openAction) {
            this.actionService.doActionButton({
                name: this.archInfo.openAction.action,
                type: this.archInfo.openAction.type,
                resModel: record.resModel,
                resId: record.resId,
                resIds: record.resIds,
                context: record.context,
                onClose: async () => {
                    await record.model.root.load();
                },
            });
        } else {
            const activeIds = this.model.root.records.map((datapoint) => datapoint.resId);
            this.props.selectRecord(record.resId, { activeIds });
        }
    }

    async onClickCreate() {
        return executeButtonCallback(this.rootRef.el, () => this.createRecord());
    }

    /**
     * Open form view in a dialog window
     * @param {Object} values
     */
    async showRecord(values) {
        if (values && values.resId) {
            const record = this.model.root.records.find((rec) => rec.resId === values.resId);
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
        const { controlPanel } = this.props.display;
        if (!controlPanel) {
            return this.props.display;
        }
        return {
            ...this.props.display,
            controlPanel: {
                ...controlPanel,
                layoutActions: !this.nbSelected,
            },
        };
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
        const list = this.model.root;
        return list.isGrouped ? list.recordCount : list.count;
    }

    get hasSelectors() {
        return this.props.allowSelectors && !this.env.isSmall;
    }

    async onUpdatedPager() {}
}
