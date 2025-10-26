/** @odoo-module */
import { renderToString } from '@web/core/utils/render';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
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
    _prepareMarkerOptions(latLng, record, color) {
        let markerOptions = super._prepareMarkerOptions(latLng, record, color);
        markerOptions.zIndex = 999;
        markerOptions.optimized = false;
        delete markerOptions.title;
        return markerOptions;
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

    // handleMarkerInfoWindow(marker, otherRecords) {
    //     super.handleMarkerInfoWindow(marker, otherRecords);
    //     let group = marker._odooRecord._group;
    //     this.actionSeeMore(group);
    // }

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
    getMarkerContent(record, isMulti) {
        const { latitudeField, longitudeField } = this.props.archInfo;

        let group = record._group;
        const content = renderToString('sale_google_map.MarkerInfoWindow', {
            title: group.displayName || '',
            destination: `${record.data[latitudeField]},${record.data[longitudeField]}`,
            subTitle: group._address,
            isMulti: isMulti,
            seeMore: true,
        });

        const divContent = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');

        divContent
            .querySelector('#btn-open_form')
            .addEventListener('click', this._openCustomerForm.bind(this, group), false);

        divContent
            .querySelector('#btn-see_more')
            .addEventListener('click', this.actionSeeMore.bind(this, group), false);
        return divContent;
    }

    _openCustomerForm(group) {
        this.props.list.model.action.doAction(
            {
                name: group.displayName || '',
                type: 'ir.actions.act_window',
                res_model: group.resModel,
                views: [[false, 'form']],
                view_mode: 'form',
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

    openCustomerSales(group) {
        let context = group.list.defaultContext ? { ...group.list.defaultContext } : {};
        this.props.list.model.action.doAction({
            name: group.displayName || this.props.archInfo.viewTitle,
            type: 'ir.actions.act_window',
            res_model: this.props.list.resModel,
            view_mode: 'list,form,kanban',
            views: [
                [false, 'list'],
                [false, 'form'],
                [false, 'kanban'],
            ],
            domain: group.groupDomain,
            context,
        });
    }

    getDomainPosition(position) {
        const { latitudeField, longitudeField } = this.props.archInfo;
        return [
            [latitudeField, '=', position.lat()],
            [longitudeField, '=', position.lng()],
        ];
    }

    actionSeeMore(group) {
        let url = new URL(window.location.href);
        let hashParams = new URLSearchParams(url.hash.slice(1));
        let actionId = parseInt(hashParams.get('action'));
        let domain = [];
        if (!isNaN(actionId)) {
            let position = group._marker.getPosition();
            let positionDomain = this.getDomainPosition(position);
            if (positionDomain.length) {
                domain = domain.concat(positionDomain);
            }
            let context = group.list.defaultContext ? { ...group.list.defaultContext } : {};

            this.props.list.model.orm
                .call('ir.model.data', 'search_read', [
                    [
                        ['res_id', '=', actionId],
                        ['module', '=', 'sale'],
                        ['model', '=', 'ir.actions.act_window'],
                    ],
                    ['name', 'module'],
                ])
                .then((data) => {
                    let xmlId = data[0].module + '.' + data[0].name;
                    this.props.list.model.orm
                        .call('ir.ui.view', 'action_google_maps_see_more', [xmlId, domain, context])
                        .then((action) => {
                            if (action) {
                                this.props.list.model.action.doAction(action);
                            }
                        });
                });
        }
    }

    _createOverlayInnerContent(group) {
        let total = 0;
        if (group.aggregates) {
            total = group.aggregates.amount_total || 0;
        }
        return `
<div class="text-wrap">
    <h5>${group.displayName}</h5>
    <span class="text-muted">${group._address}</span>
    <div class="d-flex justify-content-between pt-2 font-monospace">
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
            this.getPanes().overlayLayer.appendChild(div);
            this.div_ = div;
        };
        overlay.draw = function () {
            const projection = this.getProjection();
            const position = projection.fromLatLngToDivPixel(marker.getPosition());
            const div = this.div_;
            div.style.left = position.x + 'px';
            div.style.top = position.y + 'px';
            let color = marker._odooMarkerColor || '#ededed';
            div.style.border = `0.5px solid ${color}`;
            div.style.zIndex = 9999;
            div.style.position = 'absolute';
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

    get sidebarProps() {
        let props = super.sidebarProps;
        props.records = this.props.list.groups;
        props.openCustomerSales = this.openCustomerSales.bind(this);
        return props;
    }
}

GoogleMapRendererSales.components = {
    ...GoogleMapRenderer.components,
    Sidebar: GoogleMapSidebarSales,
};
