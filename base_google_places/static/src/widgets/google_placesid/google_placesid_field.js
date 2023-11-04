/** @odoo-module **/

import { registry } from '@web/core/registry';
import { _lt } from '@web/core/l10n/translation';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { CharField } from '@web/views/fields/char/char_field';
import { Component, useRef } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { useGoogleMapLoader } from '@base_google_map/utils/base_google_map';
import { preparePlaces } from '../../views/utils';

export class GooglePlacesIdCharField extends Component {
    setup() {
        this.button = useRef('button');
        this.rpc = useService('rpc');
        this.notification = useService('notification');
        this.placeService = null;

        useGoogleMapLoader({
            showLoading: false,
            onLoad: (setting) => {
                this.settings = { ...setting };
                this._handleGoogleLoaderSuccess();
                this.initialize();
            },
            onError: (msg) => {
                this._handleGoogleLoaderError(msg);
            },
        });
    }
    _handleGoogleLoaderSuccess() {}
    _handleGoogleLoaderError() {}
    initialize() {
        if (!this.placeService) {
            this.placeService = new google.maps.places.PlacesService(
                document.createElement('div'),
                {
                    fields: [
                        'business_status',
                        'formatted_address',
                        'geometry',
                        'icon',
                        'name',
                        'photos',
                        'place_id',
                        'plus_code',
                        'type',
                        'rating',
                        'vicinity',
                        'user_ratings_total',
                        'url',
                    ],
                }
            );
        }
    }
    async onClick() {
        if (!this.props.value) return;
        this._toogleAnimateButtonDisable();
        this.placeService.getDetails(
            { placeId: this.props.value },
            async (place, status) => {
                this._toogleAnimateButtonEnable();
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    const values = await preparePlaces(
                        this.env.model.orm,
                        this.props.record.activeFields,
                        place
                    );
                    const data = await this.env.model.orm.call(
                        this.props.record.resModel,
                        'action_google_place_update',
                        [{ place, values }]
                    );
                    if (data) {
                        await this.props.record.update(data);
                    }
                } else {
                    this.notification.add(
                        this.env._t('Failed to fetch Google place detail'),
                        {
                            type: 'warning',
                        }
                    );
                }
            }
        );
    }
    _toogleAnimateButtonDisable() {
        this.button.el.classList.toggle('disabled', true);
        this.button.el.querySelector('.fa').classList.remove('fa-cloud-download');
        this.button.el
            .querySelector('.fa')
            .classList.add('fa-spin', 'fa-circle-o-notch');
    }
    _toogleAnimateButtonEnable() {
        this.button.el.classList.toggle('disabled', false);
        this.button.el.querySelector('.fa').classList.add('fa-cloud-download');
        this.button.el
            .querySelector('.fa')
            .classList.remove('fa-spin', 'fa-circle-o-notch');
    }
}
GooglePlacesIdCharField.template = 'base_google_places.GooglePlacesIdCharField';
GooglePlacesIdCharField.components = { Field: CharField };
GooglePlacesIdCharField.displayName = _lt('Google Places ID');
GooglePlacesIdCharField.supportedTypes = ['char'];
GooglePlacesIdCharField.props = {
    ...standardFieldProps,
};

registry.category('fields').add('GooglePlacesIdChar', GooglePlacesIdCharField);
