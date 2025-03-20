import { Component } from '@odoo/owl';

export class GooglePlacesItem extends Component {
    static template = 'base_google_places.PlaceItem';
    static props = {
        place: Object,
        handlePointInMap: Function,
        handleAdd: Function,
    };

    handlePhoto(photo, size) {
        if (photo && photo.length) {
            if (!size) {
                return photo[0].getUrl({ maxWidth: 60, maxHeight: 60 });
            } else {
                return photo[0].getUrl({ maxWidth: 400, maxHeight: 200 });
            }
        }
        return false;
    }
}
