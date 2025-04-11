import { _t } from '@web/core/l10n/translation';
import { Layout } from '@web/search/layout';
import { useModelWithSampleData } from '@web/model/model';
import { extractFieldsFromArchInfo } from '@web/model/relational_model/utils';
import { usePager } from '@web/search/pager_hook';
import { useService } from '@web/core/utils/hooks';
import { rpc } from "@web/core/network/rpc";
import { user } from "@web/core/user";
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
import { useSetupAction } from "@web/search/action_hook";
import { useViewButtons } from "@web/views/view_button/view_button_hook";
import { session } from '@web/session';
import { useSearchBarToggler } from '@web/search/search_bar/search_bar_toggler';
import { ViewButton } from '@web/views/view_button/view_button';
import { executeButtonCallback } from '@web/views/view_button/view_button_hook';
import { CogMenu } from '@web/search/cog_menu/cog_menu';
import { GoogleMapSearchBar } from './google_map_search_bar';

import {
    Component,
    useRef,
    onWillStart,
    useState,
    useSubEnv,
    useEffect,
} from '@odoo/owl';

export class GoogleMapController extends Component {
    static template = 'web_view_google_map.GoogleMapView';
    static components = { Layout, ActionMenus, SearchBar: GoogleMapSearchBar, ViewButton, CogMenu };
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

        this.rootRef = useRef('root');

        this.archInfo = this.props.archInfo;
        this.activeActions = this.props.archInfo.activeActions;
        this.multiEdit = this.props.archInfo.multiEdit;
        this.model = useState(useModelWithSampleData(this.props.Model, this.modelParams, this.modelOptions));

        this.archiveEnabled =
            'active' in this.props.fields
                ? !this.props.fields.active.readonly
                : 'x_active' in this.props.fields
                ? !this.props.fields.x_active.readonly
                : false;

        onWillStart(async () => {
            this.isExportEnable = await user.hasGroup('base.group_allow_export');
        });

        useSubEnv({ model: this.model });


        useViewButtons(this.rootRef, {
            beforeExecuteAction: this.beforeExecuteActionButton.bind(this),
            afterExecuteAction: this.afterExecuteActionButton.bind(this),
            reload: () => this.model.load(),
        });

        useSetupAction({
            rootRef: this.rootRef,
            getLocalState: () => {
                return {
                    activeBars: this.progressBarState?.activeBars,
                    modelState: this.model.exportState(),
                };
            },
        });

        usePager(() => {
            const root = this.model.root;
            const { count, hasLimitedCount, isGrouped, limit, offset } = root;
            if (!isGrouped) {
                return {
                    offset: offset,
                    limit: limit,
                    total: count,
                    onUpdate: async ({ offset, limit }, hasNavigated) => {
                        await this.model.root.load({ offset, limit });
                        await this.onUpdatedPager();
                        if (hasNavigated) {
                            this.onPageChangeScroll();
                        }
                    },
                    updateTotal: hasLimitedCount ? () => root.fetchCount() : undefined,
                };
            }
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
    }

    get modelParams() {
        const { activeFields, fields } = extractFieldsFromArchInfo(
            this.archInfo,
            this.props.fields
        );

        const groupByInfo = {};
        for (const fieldName in this.archInfo.groupBy.fields) {
            const fieldNodes = this.archInfo.groupBy.fields[fieldName].fieldNodes;
            const fields = this.archInfo.groupBy.fields[fieldName].fields;
            groupByInfo[fieldName] = extractFieldsFromArchInfo({ fieldNodes }, fields);
        }

        const modelConfig = this.props.state?.modelState?.config || {
            resModel: this.props.resModel,
            fields,
            activeFields,
            openGroupsByDefault: false,
        };

        const viewConfig = this.getViewMapConfig();
        return {
            config: modelConfig,
            state: this.props.state?.modelState,
            groupByInfo,
            limit: this.archInfo.limit || this.props.limit,
            countLimit: this.archInfo.countLimit,
            defaultOrderBy: this.archInfo.defaultOrder,
            defaultGroupBy: this.archInfo.defaultGroupBy,
            groupsLimit: this.archInfo.groupsLimit,
            multiEdit: this.archInfo.multiEdit,
            activeIdsLimit: session.active_ids_limit,
            hooks: {
                onRecordSaved: this.onRecordSaved.bind(this),
                onWillSaveRecord: this.onWillSaveRecord.bind(this),
            },
            viewConfig,
        };
    }

    /**
     * onRecordSaved is a callBack that will be executed after the save
     * if it was done. It will therefore not be executed if the record
     * is invalid or if a server error is thrown.
     * @param {Record} record
     */
    async onRecordSaved(record) {}

    /**
     * onWillSaveRecord is a callBack that will be executed before the
     * record save if the record is valid if the record is valid.
     * If it returns false, it will prevent the save.
     * @param {Record} record
     */
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
        return await rpc('/web/export/get_fields', {
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
    async showRecord(record) {
        if (record) {
            let action = null;
            const action_title = this._getRecordName(record);
            if (this.actionService.currentController) {
                const form_view = this.actionService.currentController.action.views.filter((view) => view[1] == 'form');
                if (form_view) {
                    action = {
                        name: action_title,
                        type: 'ir.actions.act_window',
                        res_model: this.model.root.resModel,
                        views: form_view,
                        view_mode: 'form',
                        res_id: record.resId,
                        target: 'new'
                    };
                }
            }
            if (!action) {
                action = {
                    name: action_title,
                    type: 'ir.actions.act_window',
                    res_model: this.model.root.resModel,
                    views: [[false, 'form']],
                    view_mode: 'form',
                    res_id: record.resId,
                    target: 'new'
                };
            }
            if (action) {
                this.model.action.doAction(action, {
                    props: {
                        onSave: async (record) => {
                            await record.load();
                            record.model.notify();
                            this.model.action.doAction({
                                type: 'ir.actions.act_window_close',
                            });
                        },
                    },
                });
            }
        }
    }

    showRecordsByDomain(title, domain, target) {
        target = target || 'current';
        let action = null;
        if (this.actionService.currentController) {
            const views = this.actionService.currentController.action.views.filter((view) => ['google_map', 'list', 'form'].includes(view[1]));
            if (views) {
                action = {
                    name: title,
                    type: 'ir.actions.act_window',
                    res_model: this.model.root.resModel,
                    views: views,
                    view_mode: 'google_map,list',
                    domain: domain,
                    target: target,
                };
            }
        }
        if (!action) {
            action = {
                name: title,
                type: 'ir.actions.act_window',
                res_model: this.model.root.resModel,
                views: [
                    [false, 'google_map'],
                    [false, 'list'],
                    [false, 'form'],
                ],
                view_mode: 'google_map,list',
                domain: domain,
                target: target,
            };
        }
        if (action) {
            this.model.action.doAction(action);
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

    get modelOptions() {
        return {};
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

    onPageChangeScroll() {
        if (this.rootRef && this.rootRef.el) {
            if (this.env.isSmall) {
                this.rootRef.el.scrollTop = 0;
            } else {
                this.rootRef.el.querySelector(".o_content").scrollTop = 0;
            }
        }
    }

    getViewMapConfig() {
        const {
            latitudeField,
            longitudeField,
            sidebarTitleField,
            sidebarSubtitleField,
            markerColor,
        } = this.archInfo;
        return {
            lat: latitudeField,
            lng: longitudeField,
            title: sidebarTitleField,
            subTitle: sidebarSubtitleField,
            markerColor,
        };
    }
}
