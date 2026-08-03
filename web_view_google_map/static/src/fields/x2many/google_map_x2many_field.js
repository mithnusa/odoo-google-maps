import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { x2ManyField, X2ManyField } from '@web/views/fields/x2many/x2many_field';
import { onWillUnmount } from '@odoo/owl';
import { gMapViewAttrsContextManager } from '../../helpers/view_attrs_context_manager';
import { GoogleMapRenderer } from '../../views/google_map/google_map_renderer';

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
                showUnlocatedRecords: () => {},
                unLocatedCount: 0,
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
