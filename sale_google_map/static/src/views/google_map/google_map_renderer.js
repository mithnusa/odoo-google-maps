import { _t } from '@web/core/l10n/translation';
import { user } from "@web/core/user";
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { formatNumber } from '@web_view_google_map/views/google_map/utils';
import { GoogleMapSidebarSaleOrder } from './google_map_sidebar';

export class GoogleMapRendererSaleOrder extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarSaleOrder,
    };

    /**
     * @override
     */
    initMapboxSelector() {}

    /**
     * @override
     * @param {*} datas 
     */
    async _renderGroupedMarkers(datas) {
        const groupPromises = datas.map(async ({ group }) => {
            try {
                const records = await group.groupRecords();
                this.createMarker(group, records[0], true);
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        });

        await Promise.all(groupPromises);
    }

    /**
     * @override
     * @param {*} group 
     * @param {*} record 
     * @param {*} skipFitBounds 
     * @returns 
     */
    async createMarker(group, record, skipFitBounds = false) {
        const { aggregates } = group;
        if (!this.isMapLoaded() || !aggregates || !record) return null;

        const dataView = this.getRecordDataView(record);
        if (!dataView || !dataView?.geolocation) return;

        try {
            const geolocation = dataView.geolocation;
            const marker = await this._createNewMarker(group, geolocation, skipFitBounds);
            return marker;
        } catch (error) {
            console.error('Error creating marker for group:', error);
            return null;
        }
    }

    _createMarkerElement(displayName, amountTotal) {
        const content = document.createElement('div');
        const formattedAmount = formatNumber(amountTotal, 2, user.context.lang);

        content.className = 'sale_order marker-drop-animation';
        // content.style.backgroundColor = '#fafafa';
        content.innerHTML = `
            <p class="mb-0 fs-6">${displayName}</p>
            <small class="font-monospace">$${formattedAmount}</small>
        `;

        return content;
    }

    async _createNewMarker(group, geolocation, skipFitBounds = false) {
        const { AdvancedMarkerElement } = await this.apiLoader.importLibrary('marker');

        const { aggregates } = group;
        const amountTotal = aggregates.amount_total || 0;
        const displayName = group.displayName || 'Customer';
        const content = this._createMarkerElement(displayName, amountTotal);
        const options = {
            position: geolocation,
            map: this.googleMap,
            collisionBehavior: google.maps.CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL,
            zIndex: 1,
        };
        options.content = content;

        // Create marker
        const marker = new AdvancedMarkerElement(options);

        // Store metadata with marker
        marker._odooRecord = group;
        marker._markerOptionValues = options;
        marker._isShifted = false;

        // Store the original position before any shifts
        marker._originalPosition = {
            lat: geolocation.lat,
            lng: geolocation.lng,
        };

        // Store marker with record
        group._marker = marker;

        // Create and store event listeners for proper cleanup
        const handleMouseEnter = () => {
            marker.zIndex = 10000;
            content.classList.add('marker-hover-animation');
        };

        const handleMouseLeave = () => {
            marker.zIndex = 1;
            content.classList.remove('marker-hover-animation');
        };

        content.addEventListener('mouseenter', handleMouseEnter);
        content.addEventListener('mouseleave', handleMouseLeave);

        // Store event listener references for cleanup
        marker._customContentEvListeners = {
            content,
            mouseenter: handleMouseEnter,
            mouseleave: handleMouseLeave,
        };

        // Store marker in cache
        this.cache.set(group.id, marker);

        // Handle overlapping markers
        this._handleMarkersOverlapAt(marker);

        // Update map bounds
        this._updateMapBounds(marker, skipFitBounds);

        return marker;
    }

    /**
     * @override
     * @param {*} groupId 
     * @returns 
     */
    pointInMap(groupId) {
        const marker = this.cache.get(groupId);
        if (!marker) return;

        const position = marker.position;
        this.googleMap.panTo(position);

        if (marker._isShifted) {
            this.notificationService.add(
                _t(
                    "This marker's location has been slightly shifted to prevent overlap with other markers." +
                        '\nCheck the other end of the line connected to this marker for its original location.'
                ),
                { type: 'info' }
            );
        }

        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
            const currentZoom = this.googleMap.getZoom();
            if (marker._isShifted && currentZoom < 22) {
                this.googleMap.setZoom(22);
            } else if ((currentZoom < 14 || currentZoom >= 21) && !marker._isShifted) {
                this.googleMap.setZoom(14);
            }
        });
    }

    _cleanUp() {
        // Clean up event listeners from markers
        if (this.cache) {
            for (const [, marker] of this.cache) {
                if (marker._customContentEvListeners) {
                    const { content, mouseenter, mouseleave } = marker._customContentEvListeners;
                    if (content) {
                        content.removeEventListener('mouseenter', mouseenter);
                        content.removeEventListener('mouseleave', mouseleave);
                    }
                    delete marker._customContentEvListeners;
                }
            }
        }

        super._cleanUp();
    }
}
