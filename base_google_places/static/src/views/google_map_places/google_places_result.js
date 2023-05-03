/** @odoo-module **/

import { Component, onRendered } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { sprintf } from '@web/core/utils/strings';

import { GooglePlacesItem } from './google_places_item';
import { preparePlaces } from '../utils';

export class GooglePlacesResult extends Component {
    setup() {
        super.setup();
        this.notification = useService('notification');
        onRendered(() => this.handleOnRendered());
    }

    handleOnRendered() {
        if (this.props.places) {
            this.props.places.forEach((place) => {
                google.maps.event.addListener(
                    place._marker,
                    'click',
                    this.handleMarkerPlaceClick.bind(this, place)
                );
            });
        }
    }

    handleMarkerPlaceClick(place) {
        const { googleMap, markerInfoWindow } = this.props;
        const content = new DOMParser()
            .parseFromString(
                '<div><div style="font-weight:400;width:350px;font-size:14px;"><h5>' +
                    place.name +
                    '</h5><p>' +
                    place.formatted_address +
                    '</p><button role="button" class="btn btn-primary" id="add-place"><i class="fa fa-plus-circle"></i><span> ' +
                    this.env._t('Add') +
                    '</span></button></div></div>',
                'text/html'
            )
            .querySelector('div');

        content.querySelector('#add-place').addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this.handleClickItemAdd(place);
        });

        markerInfoWindow.setOptions({
            content: content,
            pixelOffset: new google.maps.Size(-25, 0),
        });
        markerInfoWindow.open(googleMap, place._marker);
    }

    /**
     * Pin point place in map
     * @param {Object} place
     */
    handleClickItem(place) {
        const { googleMap, markerInfoWindow } = this.props;
        if (place && googleMap && markerInfoWindow) {
            googleMap.panTo(place.geometry.location);
            google.maps.event.addListenerOnce(googleMap, 'idle', () => {
                google.maps.event.trigger(googleMap, 'resize');
                if (googleMap.getZoom() < 16) googleMap.setZoom(16);
            });
            this.handleMarkerPlaceClick(place);
        }
    }

    /**
     * Show existing record of a place
     * @param {Object} record
     */
    _actionShowPlace(record) {
        this.notification.add(
            sprintf(
                this.env._t('The place "%s" was already created'),
                record.display_name
            ),
            { type: 'info' }
        );
        this.env.model.action.doAction(
            {
                name: sprintf(this.env._t('Update Place: %s'), record.display_name),
                type: 'ir.actions.act_window',
                res_model: this.env.model.env.searchModel.resModel,
                res_id: record.id,
                views: [[false, 'form']],
                view_mode: 'form',
                target: 'new',
                flags: { mode: 'edit' },
                context: { active_id: record.id },
            },
            {
                props: {
                    onSave: async (record, params) =>
                        await this._handleAfterAction(record, 'write', params),
                },
            }
        );
    }

    /**
     * Launch an action dialog and popule place selected into Odoo fields
     * @param {Object} values
     */
    _actionAddPlace(values) {
        const display_name = values.default_name || values.name;
        this.env.model.action.doAction(
            {
                name: sprintf(this.env._t('New Place: %s'), display_name),
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

    /**
     *
     * @param {Object} record
     * @param {String} mode
     * @param {Object} _params
     */
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
                        this.env._t('New place is created successfully'),
                        { type: 'success' }
                    );
                } else if (mode === 'write') {
                    this.notification.add(
                        this.env._t('Place is updated successfully'),
                        { type: 'success' }
                    );
                }
            }, 500);
        }
    }

    /**
     * Check if a place was already created
     * if does not, populate place data into Odoo fields values
     * @param {Object} place
     */
    async addPlace(place) {
        const isExists = await this.env.model.orm.searchRead(
            this.env.model.env.searchModel.resModel,
            [['gplace_id', '=', place.place_id]],
            ['display_name'],
            { limit: 1 }
        );
        if (isExists.length > 0) {
            const record = isExists[0];
            this._actionShowPlace(record);
        } else {
            const values = await preparePlaces(
                this.env.model.orm,
                this.env.fields,
                place
            );

            if (values) {
                const data = await this.env.model.orm.call(
                    this.env.model.env.searchModel.resModel,
                    'action_google_place_quick_create',
                    [{ place, values }]
                );
                this._actionAddPlace(data);
            }
        }
    }

    /**
     * onClick event handler
     * @param {Object} place
     */
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
                    this.notification.add(this.env._t('Failed to fetch place detail'), {
                        type: 'warning',
                    });
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
