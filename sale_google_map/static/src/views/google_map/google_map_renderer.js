/** @odoo-module */
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { getCurrentActionId } from '@web_view_google_map/views/google_map/utils';
import { GoogleMapSidebarSales } from './google_map_sidebar';

export class GoogleMapRendererSales extends GoogleMapRenderer {
    /**
     * @override
     */
    renderMarkers() {
        this.props.list.groups.map((group) => {
            this.createMarkerIfNotExists(group);
            return group;
        });
    }

    _customerAddress(record) {
        let address = '';
        if (record.data.partner_contact_address) {
            address = record.data.partner_contact_address;
        }
        return address;
    }

    /**
     * @override
     */
    handleMarker(recordId, marker) {
        const otherRecords = [];
        if (this.cache.size) {
            const position = marker.getPosition();
            this.cache.forEach((_cMarker) => {
                if (position && position.equals(_cMarker.getPosition())) {
                    marker.setMap(null);
                    otherRecords.push(_cMarker._odooRecord);
                }
            });
        }
        this.cache.set(recordId, marker);
        marker.addListener('click', () => {
            if (marker.__overlay) {
                marker.__overlay.setMap(null);
                delete marker.__overlay;
            }
            this.handleMarkerInfoWindow(marker, otherRecords);
        });
        marker.addListener('mouseover', () => {
            if (!marker.__overlay) {
                marker.__overlay = this._drawMarkerOverlay(marker, otherRecords);
            }
        });
        marker.addListener('mouseout', () => {
            if (marker.__overlay) {
                marker.__overlay.setMap(null);
                delete marker.__overlay;
            }
        });
    }

    /**
     * @override
     */
    _prepareMarkerOptions(latLng, record, color) {
        let options = super._prepareMarkerOptions(latLng, record, color);
        delete options.title;
        return options;
    }

    /**
     * @override
     */
    createMarkerIfNotExists(group) {
        let hasGeolocation = false;
        let markerColor = null;
        if (!this.cache.has(group.id)) {
            const record = this._groupFindRecord(group);
            if (record) {
                const latLng = this.getLatLng(record);
                if (latLng) {
                    record._group = group;
                    hasGeolocation = true;
                    markerColor = this.getMarkerColor(record);
                    const markerOptions = this._prepareMarkerOptions(latLng, record, markerColor);
                    const marker = this.createMarker(markerOptions);
                    record._marker = marker;
                    group._marker = marker;
                    group._address = this._customerAddress(record);
                    this.handleMarker(group.id, marker);
                }
            }
        }
        group._markerColor = markerColor;
        group._hasGeolocation = hasGeolocation;
    }

    /**
     * @override
     */
    prepareInfoWindowValues(record, isMulti) {
        let options = super.prepareInfoWindowValues(record, isMulti);
        let group = record._group;
        let total = 0;
        if (group.aggregates) {
            total = group.aggregates.amount_total || 0;
        }
        options.title = group.displayName || '';
        options.subTitle = group._address || '';
        options.total = total.toLocaleString();
        options.count = group.count;
        options.string = this.props.archInfo.viewTitle || '';
        return options;
    }

    /**
     * @override
     */
    get infoWindowTemplate() {
        return 'sale_google_map.MarkerInfoWindow';
    }

    /**
     *
     * @overwrite
     */
    getMarkerContent(record, isMulti) {
        const content = this.markerInfoWindowContent(record, isMulti);
        const divContent = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');

        const group = record._group;
        divContent
            .querySelector('#btn-open_form')
            .addEventListener('click', this._openCustomerForm.bind(this, group), false);

        divContent
            .querySelector('#btn-open_sales')
            .addEventListener('click', this.actionSeeSales.bind(this, group), false);

        return divContent;
    }

    _openCustomerForm(group) {
        this.props.list.model.action.doAction(
            {
                name: group.displayName || '',
                type: 'ir.actions.act_window',
                res_model: group.resModel,
                views: [[false, 'form']],
                res_id: group.resId,
                target: 'new',
            },
            {
                props: {
                    onSave: async () => {
                        this.props.list.model.action.doAction({
                            type: 'ir.actions.client',
                            tag: 'reload',
                        });
                    },
                },
            }
        );
    }

    _groupFindRecord(group) {
        function matchPartner(record) {
            let isMatched = false;
            if (record.data.partner_id) {
                isMatched = record.data.partner_id[0] === group.resId;
            }
            return isMatched;
        }

        return this.props.list.records.find(matchPartner);
    }

    actionSeeSales(group) {
        let actionId = getCurrentActionId();
        if (actionId) {
            let domain = [];
            let groupField = this.props.list.groupBy ? this.props.list.groupBy[0] : null;
            if (groupField) {
                domain.push([groupField, '=', group.resId]);
            }
            let context = group.list.defaultContext ? { ...group.list.defaultContext } : {};
            this._handleActionSeeMore(actionId, domain, context);
        }
    }

    get sidebarProps() {
        let props = super.sidebarProps;
        props.records = this.props.list.groups;
        props.openCustomerSales = this.actionSeeSales.bind(this);
        return props;
    }

    _createOverlayInnerContent(group) {
        let total = 0;
        if (group.aggregates) {
            total = group.aggregates.amount_total || 0;
        }
        return `
<div class="text-wrap">
    <h4>${group.displayName}</h4>
    <span class="text-muted">${group._address}</span>
    <div class="d-flex justify-content-between pt-2 font-monospace fs-6">
        <span>${group.count} ${this.props.archInfo.viewTitle || ''}</span>
        <span>
            <i class="fa fa-usd" aria-hidden="true"></i>
            <span>${total.toLocaleString()}</span>
        </span>
    </div>
</div>`;
    }

    _createOverlayContent(marker, otherRecords) {
        const content = document.createElement('div');
        const group = marker._odooRecord._group;
        const groups = [group].concat(
            otherRecords
                .map((record) => record._marker._odooRecord._group || false)
                .filter((group) => group)
        );
        const groupsContent = groups
            .slice(0, 3)
            .map((group) => this._createOverlayInnerContent(group))
            .join('<hr>');

        content.classList.add('marker-overlay-info', 'p-3');
        content.innerHTML = groupsContent;
        return content;
    }

    _drawMarkerOverlay(marker, otherRecords) {
        const self = this;
        let overlay = new google.maps.OverlayView();
        overlay.onAdd = function () {
            const div = self._createOverlayContent(marker, otherRecords);
            this.getPanes().floatPane.appendChild(div);
            this.div_ = div;
        };
        overlay.draw = function () {
            const projection = this.getProjection();
            const position = projection.fromLatLngToDivPixel(marker.getPosition());
            const div = this.div_;
            div.style.left = position.x + 'px';
            div.style.top = position.y + 'px';
            let color = marker._odooMarkerColor || '#ededed';
            if (color) {
                div.style.border = `0.5px solid ${color}`;
            }
        };
        overlay.onRemove = function () {
            if (this.div_) {
                this.div_.parentNode.removeChild(this.div_);
                this.div_ = null;
            }
        };
        overlay.setMap(this.googleMap);
        return overlay;
    }
}

GoogleMapRendererSales.components = {
    ...GoogleMapRenderer.components,
    Sidebar: GoogleMapSidebarSales,
};
