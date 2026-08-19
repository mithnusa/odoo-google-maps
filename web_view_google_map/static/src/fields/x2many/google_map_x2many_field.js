import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { x2ManyField, X2ManyField } from '@web/views/fields/x2many/x2many_field';
import { onWillUnmount } from '@odoo/owl';
import { gMapViewAttrsContextManager } from '../../helpers/view_attrs_context_manager';
import { GoogleMapRenderer } from '../../views/google_map/google_map_renderer';
import { parseRecord } from '../../views/google_map/utils';

export class X2ManyFieldGoogleMap extends X2ManyField {
    static template = 'web_view_google_map.X2ManyFieldGoogleMap';
    static components = { ...X2ManyField.components, GoogleMapRenderer };

    setup() {
        super.setup();
        this.googleViewAttrContext = gMapViewAttrsContextManager;
        this.controls = this.controls || [];
        if (this.props.viewMode === 'google_map' && this.activeActions.create && !this.props.readonly) {
            this.controls.push({
                type: 'create',
                string: this.props.addLabel || _t('Add'),
            });
        }

        onWillUnmount(() => {
            this.googleViewAttrContext.clear();
        });
    }

    get viewAttrsConfig() {
        const { archInfo } = this;
        return {
            lat: archInfo.latitudeField,
            lng: archInfo.longitudeField,
            title: archInfo.sidebarTitleField,
            subTitle: archInfo.sidebarSubtitleField,
            __geoColor: archInfo.__geoColor,
        };
    }

    get unlocatedRecords() {
        const { lat, lng } = this.viewAttrsConfig;
        if (!lat || !lng) {
            return [];
        }
        return this.list.records.filter((record) => !parseRecord(record, this.viewAttrsConfig).geolocation);
    }

    get unLocatedCount() {
        return this.unlocatedRecords.length;
    }

    showUnlocatedRecords() {
        const resIds = this.unlocatedRecords.map((record) => record.resId).filter(Boolean);
        if (!resIds.length) {
            return;
        }
        this.action.doAction({
            type: 'ir.actions.act_window',
            name: _t('Unlocated %(title)s', { title: this.props.string || _t('Records') }),
            res_model: this.list.resModel,
            views: [
                [false, 'list'],
                [false, 'google_map'],
                [false, 'form'],
            ],
            view_mode: 'list,google_map,form',
            domain: [['id', 'in', resIds]],
            target: 'current',
            context: this.list.context,
        });
    }

    get rendererProps() {
        if (this.props.viewMode === 'google_map') {
            const { archInfo } = this;
            const list = this.list;

            const viewAttrsConfig = this.viewAttrsConfig;
            this.googleViewAttrContext.update(viewAttrsConfig);

            const props = {
                archInfo,
                list,
                openRecord: this.openRecord.bind(this),
                showRecord: this.openRecord.bind(this),
                showRecordsByDomain: () => {},
                showUnlocatedRecords: this.showUnlocatedRecords.bind(this),
                unLocatedCount: this.unLocatedCount,
                allowSelectors: false,
                viewAttrs: viewAttrsConfig,
            };
            props.readonly = this.props.readonly;

            return props;
        }
        return super.rendererProps;
    }

    get displayControlPanelButtons() {
        return (
            this.props.viewMode === 'google_map' &&
            ('link' in this.activeActions ? this.activeActions.link : this.activeActions.create) &&
            !this.props.readonly
        );
    }

    centerMap() {
        this.render(true);
    }
}

export const x2ManyGoogleMap = {
    ...x2ManyField,
    component: X2ManyFieldGoogleMap,
    displayName: 'Google Maps',
};

registry.category('fields').add('google_map_one2many', x2ManyGoogleMap);
registry.category('fields').add('google_map_many2many', x2ManyGoogleMap);
