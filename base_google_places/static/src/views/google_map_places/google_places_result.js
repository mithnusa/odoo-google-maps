/** @odoo-module **/

import { Component } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { sprintf } from '@web/core/utils/strings';

import { GooglePlacesItem } from './google_places_item';
import { preparePlaces } from '../utils';

export class GooglePlacesResult extends Component {
    setup() {
        super.setup();
        this.notification = useService('notification');
    }
    handleClickItem(place) {
        const { googleMap, markerInfoWindow } = this.props;
        if (place && googleMap && markerInfoWindow) {
            googleMap.panTo(place.geometry.location);
            google.maps.event.addListenerOnce(googleMap, 'idle', () => {
                google.maps.event.trigger(googleMap, 'resize');
                if (googleMap.getZoom() < 16) googleMap.setZoom(16);
            });

            markerInfoWindow.setOptions({
                content:
                    '<div style="font-weight:400;font-size:14px;">' +
                    place.name +
                    '</div>',
                pixelOffset: new google.maps.Size(-25, 0),
            });
            markerInfoWindow.open(googleMap, place._marker);
        }
    }

    _actionAddPlace(values) {
        const res_id = values.res_id;
        if (res_id) {
            this.env.model.action.doAction(
                {
                    name: sprintf(this.env._t('Update Place: '), values.default_name),
                    type: 'ir.actions.act_window',
                    res_model: this.env.model.env.searchModel.resModel,
                    views: [[false, 'form']],
                    view_mode: 'form',
                    view_id: res_id,
                    target: 'new',
                    flags: { mode: 'edit' },
                    context: { ...values, active_id: res_id },
                },
                {
                    props: {
                        onSave: async (record, params) =>
                            await this._handleAfterAction(record, 'write', params),
                    },
                }
            );
        } else {
            this.env.model.action.doAction(
                {
                    name: sprintf(this.env._t('New Place: '), values.default_name),
                    type: 'ir.actions.act_window',
                    res_model: this.env.model.env.searchModel.resModel,
                    views: [[false, 'form']],
                    view_mode: 'form',
                    target: 'new',
                    context: values,
                },
                {
                    props: {
                        onSave: async (record, params) =>
                            await this._handleAfterAction(record, 'create', params),
                    },
                }
            );
        }
    }

    async _handleAfterAction(record, mode, _params) {
        if (record.resId) {
            this.env.model.action.doAction({
                type: 'ir.actions.act_window_close',
            });

            await this.env.model.root.load();
            this.env.model.notify();
            this.render(true);
            setTimeout(() => {
                this.props.centerToCurrentSearchResult();
                if (mode === 'create') {
                    this.notification.add(
                        this.env._t('New place is created successfully', {
                            type: 'success',
                        })
                    );
                } else if (mode === 'write') {
                    this.notification.add(
                        this.env._t('Place is updated successfully', {
                            type: 'success',
                        })
                    );
                }
            }, 500);
        }
    }

    async addPlace(place) {
        const values = await preparePlaces(this.env.model.orm, this.env.fields, place);
        if (values) {
            const data = await this.env.model.orm.call(
                this.env.model.env.searchModel.resModel,
                'action_google_place_quick_create1',
                [{ place, values }]
            );
            this._actionAddPlace(data);
        }
    }

    handleClickItemAdd(place) {
        if (place) {
            const request = {
                placeId: place.place_id,
            };
            this.props.placeService.getDetails(request, async (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    await this.addPlace(place);
                } else {
                    console.warn(status);
                    this.notification.add(
                        this.env._t('Failed to fetch place detail', {
                            type: 'warning',
                        })
                    );
                }
            });
        }
    }

    get isEmpty() {
        return this.props.places.length <= 0;
    }
}

GooglePlacesResult.template = 'base_google_places.PlacesResult';
GooglePlacesResult.components = { GooglePlacesItem };
GooglePlacesResult.props = [
    'places',
    'googleMap',
    'markerInfoWindow',
    'placeService',
    'centerToCurrentSearchResult',
];
