/** @odoo-module */
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
        marker.addListener('click', this.handleMarkerInfoWindow.bind(this, marker, otherRecords));
    }

    /**
     * @override
     */
    _prepareMarkerOptions(latLng, record, color) {
        let options = super._prepareMarkerOptions(latLng, record, color);
        let group = record._group;
        options.title = group.displayName || '';
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
    get infoWindowQwebName() {
        return 'sale_google_map.MarkerInfoWindow';
    }

    /**
     * @override
     */
    getMarkerContent(record, isMulti) {
        const divContent = super.getMarkerContent(record, isMulti);
        const group = record._group;

        // remove the original event listener
        divContent.querySelector('#btn-open_form').removeEventListener('click', this.props.showRecord.bind(this, record));
        // add the new event listener
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

    actionSeeSales(group) {
        let actionId = this._getCurrentActionId();
        if (actionId) {
            let domain = [];
            let groupField = this.props.list.groupBy ? this.props.list.groupBy[0] : null;
            if (groupField) {
                domain.push([groupField, '=', group.resId]);
            }
            let context = group.list.defaultContext ? { ...group.list.defaultContext } : {};
            this._handleAction(actionId, domain, context);
        }
    }

    get sidebarProps() {
        let props = super.sidebarProps;
        props.records = this.props.list.groups;
        props.openCustomerSales = this.actionSeeSales.bind(this);
        return props;
    }
}

GoogleMapRendererSales.components = {
    ...GoogleMapRenderer.components,
    Sidebar: GoogleMapSidebarSales,
};
