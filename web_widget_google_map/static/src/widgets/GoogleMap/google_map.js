import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { standardWidgetProps } from '@web/views/widgets/standard_widget_props';
import { evaluateExpr, evaluateBooleanExpr } from "@web/core/py_js/py";

import { rpc } from '@web/core/network/rpc';
import { Component, onWillStart } from '@odoo/owl';
import { WarningMissingGoogleMapFormViewDialog } from '@web_view_google_map/views/google_map_form/warning_missing_view_dialog/warning_missing_view_dialog';

export class GoogleMapWidget extends Component {
    static template = 'web_widget_google_map.GoogleMapWidget';
    static props = {
        ...standardWidgetProps,
        lat: String,
        lng: String,
        width: { type: String, optional: true },
        height: { type: String, optional: true },
        zoom: { type: Number, optional: true },
        maptype: { type: String, optional: true },
    };
    static defaultProps = {
        zoom: 16,
        maptype: 'roadmap',
        width: 400,
        height: 200,
    };

    setup() {
        this.settings = {};
        this.actionService = useService('action');
        this.dialogService = useService('dialog');
        onWillStart(this.loadGoogleSetting);
    }

    async loadGoogleSetting() {
        if (!Object.keys(this.settings).length && !this.props.invisible) {
            const { context } = this.props.record;
            const settings = await rpc('/web/base_google_map/settings', { context });
            if (settings) {
                this.settings = { ...settings };
            }
        }
    }

    get iframeSrc() {
        if (this.settings) {
            return this.generateSrc(this.settings.api_key);
        }
        return false;
    }

    get baseUrl() {
        return 'https://www.google.com/maps/embed/v1/place';
    }

    get latitude() {
        try {
            return this.props.record.data[this.props.lat] || 0.0;
        } catch (e) {
            console.error(e);
            return 0.0;
        }
    }

    get longitude() {
        try {
            return this.props.record.data[this.props.lng] || 0.0;
        } catch (e) {
            console.error(e);
            return 0.0;
        }
    }

    get params() {
        const lat = this.latitude;
        const lng = this.longitude;
        const maptype = this.getMapType();
        let zoom = this.props.zoom;
        if (lat === 0.0 && lng === 0.0) {
            zoom = 3;
        }
        return {
            q: `${lat},${lng}`,
            zoom,
            maptype,
        };
    }

    generateSrc(api_key) {
        const params = { ...this.params, key: api_key };
        const searchParams = new URLSearchParams(params);
        return `${this.baseUrl}?${searchParams.toString()}`;
    }

    getMapType() {
        const mapTypes = ['roadmap', 'satellite'];
        if (!mapTypes.includes(this.props.maptype)) {
            console.warn(
                `Widget google_map: invalid map type: ${
                    this.props.maptype
                }. Defaulting to 'roadmap'. Valid options are: ${mapTypes.join(', ')}.`
            );
            return 'roadmap';
        }
        return this.props.maptype;
    }

    async handleOnEdit() {
        const { context } = this.props.record;
        const viewId = await this.env.model.orm.call('ir.ui.view', 'get_google_form_view_id', [], {
            model_name: this.props.record.resModel,
            context,
        });
        if (!viewId) {
            this.dialogService.add(WarningMissingGoogleMapFormViewDialog, {});
        } else {
            return this.actionService.doAction(
                {
                    name: _t('Edit Geolocation'),
                    type: 'ir.actions.act_window',
                    views: [[viewId, 'form']],
                    view_mode: 'form',
                    res_model: this.props.record.resModel,
                    res_id: this.props.record.resId,
                    target: 'new',
                    context,
                },
                {
                    props: {
                        onSave: async (record) => {
                            await this.props.record.load();
                            this.props.record.model.notify();
                            this.actionService.doAction({
                                type: 'ir.actions.act_window_close',
                            });
                        },
                    },
                }
            );
        }
    }
}

export const googleMapWidget = {
    component: GoogleMapWidget,
    extractProps: ({ attrs }) => ({
        lat: attrs.lat,
        lng: attrs.lng,
        zoom: attrs.zoom,
        maptype: attrs.maptype,
        width: attrs.width,
        height: attrs.height,
    }),
};

registry.category('view_widgets').add('google_map', googleMapWidget);
