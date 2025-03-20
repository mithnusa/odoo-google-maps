import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { x2ManyField, X2ManyField } from '@web/views/fields/x2many/x2many_field';
import { GoogleMapRenderer } from '../../views/google_map/google_map_renderer';

export class X2ManyFieldGoogleMap extends X2ManyField {
    static template = 'web_view_google_map.X2ManyFieldGoogleMap';
    static components = { ...X2ManyField.components, GoogleMapRenderer };

    setup() {
        super.setup();
        const { creates } = this.archInfo;
        if (['kanban', 'google_map'].indexOf(this.props.viewMode) >= 0) {
            this.creates = creates.length
                ? creates
                : [
                      {
                          type: 'create',
                          string: this.props.addLabel || _t('Add'),
                          class: 'o-kanban-button-new',
                      },
                  ];
        }
    }

    get rendererProps() {
        if (this.props.viewMode === 'google_map') {
            const archInfo = this.activeField.views[this.props.viewMode];
            if (!archInfo.gestureHandling) {
                archInfo.gestureHandling = 'cooperative';
                archInfo.allowSelectors = false;
            }
            const props = {
                archInfo,
                list: this.list,
                openRecord: this.openRecord.bind(this),
                showRecord: this.openRecord.bind(this),
                showRecordsByDomain: () => {},
                allowSelectors: false,
            };
            props.readonly = this.props.readonly;
            return props;
        }
        return super.rendererProps;
    }

    get displayControlPanelButtons() {
        return (
            ['kanban', 'google_map'].indexOf(this.props.viewMode) >= 0 &&
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
