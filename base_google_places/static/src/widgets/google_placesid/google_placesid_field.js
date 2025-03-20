import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { CharField } from '@web/views/fields/char/char_field';
import { Component, useRef } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { useGoogleMapsAPILoader } from '@base_google_map/utils/loader_google_map';
import { preparePlaces } from '../../views/utils';

export class GooglePlacesIdCharField extends Component {
    static template = 'base_google_places.GooglePlacesIdCharField';
    static components = { Field: CharField };
    static props = {
        ...standardFieldProps,
        placeholder: { type: String, optional: true },
        maxLength: { type: Number, optional: true },
    };

    setup() {
        this.button = useRef('button');
        this.notificationService = useService('notification');
        this.placeService = null;
        this.apiLoader = useGoogleMapsAPILoader(this.onLoad.bind(this), this.onError.bind(this));
    }
    async onLoad() {
        this.initialize();
    }

    onError(error) {
        console.error(error);
    }

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
        console.log(' onClick ');
        console.log(this);
        const value = this.props.record.data[this.props.name];
        console.log({ value });
        if (!value) return;
        this._toogleAnimateButtonDisable();
        this.placeService.getDetails({ placeId: value }, async (place, status) => {
            this._toogleAnimateButtonEnable();
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                const values = await preparePlaces(
                    this.env.model.orm,
                    this.props.record.activeFields,
                    place
                );
                console.log({ values });
                const data = await this.env.model.orm.call(
                    this.props.record.resModel,
                    'action_google_place_update',
                    [{ place, values }]
                );
                console.log({ data });
                if (data) {
                    await this.props.record.update(data);
                }
            } else {
                this.notificationService.add(_t('Failed to fetch Google place detail'), {
                    type: 'warning',
                });
            }
        });
    }
    _toogleAnimateButtonDisable() {
        this.button.el.classList.toggle('disabled', true);
        this.button.el.querySelector('.fa').classList.remove('fa-cloud-download');
        this.button.el.querySelector('.fa').classList.add('fa-spin', 'fa-circle-o-notch');
    }
    _toogleAnimateButtonEnable() {
        this.button.el.classList.toggle('disabled', false);
        this.button.el.querySelector('.fa').classList.add('fa-cloud-download');
        this.button.el.querySelector('.fa').classList.remove('fa-spin', 'fa-circle-o-notch');
    }
}

export const googlePlacesIdCharField = {
    component: GooglePlacesIdCharField,
    displayName: _t('Google Places ID'),
    supportedTypes: ['char'],
    extractProps: ({ attrs }) => ({
        placeholder: attrs.placeholder,
    }),
};

registry.category('fields').add('GooglePlacesIdChar', googlePlacesIdCharField);
