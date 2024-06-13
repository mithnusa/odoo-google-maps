/** @odoo-module */
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarCRM } from './google_map_sidebar';

export class GoogleMapRendererCRM extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarCRM,
    };

    /**
     * @overwrite
     */
    get infoWindowTemplate() {
        return 'crm_google_map.MarkerInfoWindow';
    }

    /**
     * @override
     */
    prepareInfoWindowValues(record, isMulti) {
        let values = super.prepareInfoWindowValues(record, isMulti);
        values.expectedRevenue = record.data.expected_revenue
            ? record.data.expected_revenue.toLocaleString()
            : false;
        values.probability = record.data.probability || false;
        values.dateDeadline = record.data.date_deadline
            ? record.data.date_deadline.toLocaleString()
            : false;
        return values;
    }

    /**
     *
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

    _createOverlayInnerContent(record) {
        return `
<div class="text-wrap">
    <h4>${record.data.name}</h4>
    <span class="text-muted">${record.data.customer_address}</span>
    <div class="d-flex justify-content-between pt-2 font-monospace fs-6">
        <small>
            <i class="fa fa-usd" aria-hidden="true"></i>
            <span>${(record.data.expected_revenue || 0.0).toLocaleString()}</span>
        </small>
        <small>
            <span>${record.data.probability}</span>
            <i class="fa fa-percent"></i>
        </small>
    </div>
</div>`;
    }

    _createOverlayContent(marker, otherRecords) {
        const content = document.createElement('div');
        const record = marker._odooRecord;
        const records = [record].concat(otherRecords);
        const recordsContent = records
            .slice(0, 3)
            .map((rec) => this._createOverlayInnerContent(rec))
            .join('<hr>');

        content.classList.add('marker-overlay-info', 'p-3');
        content.innerHTML = recordsContent;
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
