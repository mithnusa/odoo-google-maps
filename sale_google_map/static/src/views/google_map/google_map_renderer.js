import { _t } from '@web/core/l10n/translation';
import { user } from '@web/core/user';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { formatNumber } from '@web_view_google_map/views/google_map/utils';
import { GoogleMapSidebarSaleOrder } from './google_map_sidebar';

/**
 * Configuration constants for sale order marker behavior and styling
 */
const SALE_MARKER_CONFIG = {
    VISUAL: {
        CLASSES: {
            CONTAINER: 'sale_order marker-drop-animation',
            LAYOUT: 'd-flex align-items-center justify-content-end gap-2',
            INFO_SECTION: 'flex-grow-1',
            NAME: 'mb-0 fs-6',
            AMOUNT: 'font-monospace',
            BUTTON: 'btn btn-link btn-sm flex-shrink-0',
            ICON: 'fa fa-angle-double-right fa-lg',
            INFO_ICON: 'fa fa-info-circle ms-1 text-info float-end',
            IMG_LOGO_CONTAINER: 'd-inline-block position-relative opacity-trigger-hover',
            IMG_LOGO: 'img img-fluid o_avatar rounded',
        },
        Z_INDEX: {
            DEFAULT: 1,
            HOVER: 10000,
        },
    },
};

export class GoogleMapRendererSaleOrder extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarSaleOrder,
    };

    /**
     * @override
     * Disable marker selector
     */
    initMapboxSelector() {}

    /**
     * @override
     * @param {*} datas
     */
    async _renderGroupedMarkers(datas) {
        const groupPromises = datas.map(async ({ group }) => {
            try {
                const records = group.records;
                if (records && records.length > 0) {
                    await this.createMarker(group, records[0]);
                }
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
     * @returns
     */
    async createMarker(group, record) {
        const { aggregates } = group;
        if (!this.isMapLoaded() || !aggregates || !record) return null;

        const dataView = this.getRecordDataView(record);
        if (!dataView || !dataView?.geolocation) return;

        try {
            const geolocation = dataView.geolocation;
            const marker = await this._createNewMarker(group, geolocation);
            return marker;
        } catch (error) {
            console.error('Error creating marker for group:', error);
            return null;
        }
    }

    /**
     * @override
     * Create marker element for sale order with enhanced structure
     * @param {Object} group The group containing aggregates and display data
     * @returns {HTMLElement} Marker content element
     */
    _createMarkerElement(group) {
        if (!this._isValidGroupForMarkerElement(group)) {
            return this._createFallbackMarkerElement();
        }

        const { aggregates } = group;
        const amountTotal = aggregates.amount_total || 0;
        const displayName = group.displayName || _t('Customer');
        const formattedAmount = formatNumber(amountTotal, 2, user.context.lang);

        const container = this._createMarkerContainer(group.groupColor);
        const layout = this._createMarkerLayout(displayName, formattedAmount, group);

        container.appendChild(layout);
        return container;
    }

    /**
     * Validate if group is ready for marker element creation
     * @private
     * @param {Object} group The group to validate
     * @returns {boolean} True if group is valid
     */
    _isValidGroupForMarkerElement(group) {
        if (!group || !group.aggregates) {
            console.warn('Invalid group data for marker creation:', group);
            return false;
        }
        return true;
    }

    /**
     * Create fallback marker element for invalid groups
     * @private
     * @returns {HTMLElement} Fallback marker element
     */
    _createFallbackMarkerElement() {
        const content = document.createElement('div');
        content.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.CONTAINER;
        content.textContent = _t('Invalid Data');
        return content;
    }

    /**
     * Create the main container for the marker
     * @private
     * @param {string} [color] - The color for the left border of the marker container
     * @returns {HTMLElement} Container element
     */
    _createMarkerContainer(color) {
        const container = document.createElement('div');
        container.style.borderLeft = `4px solid ${color || 'red'}`;
        container.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.CONTAINER;
        return container;
    }

    /**
     * Create the layout structure for marker content
     * @private
     * @param {string} displayName Customer display name
     * @param {string} formattedAmount Formatted amount string
     * @param {Object} group The group data
     * @returns {HTMLElement} Layout element
     */
    _createMarkerLayout(displayName, formattedAmount, group) {
        const layout = document.createElement('div');
        layout.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.LAYOUT;

        const infoSection = this._createInfoSection(displayName, formattedAmount);
        const actionButton = this._createActionButton(group);
        const logoEl = this._createCustomerLogo(group.value);
        if (logoEl) {
            layout.appendChild(logoEl);
        }
        layout.appendChild(infoSection);
        layout.appendChild(actionButton);

        // Store action button reference for cleanup
        layout._actionClickHandler = {
            element: actionButton,
            handler: actionButton._clickHandler,
        };

        return layout;
    }

    /**
     * Create the info section with customer name and amount
     * @private
     * @param {string} displayName Customer display name
     * @param {string} formattedAmount Formatted amount string
     * @returns {HTMLElement} Info section element
     */
    _createInfoSection(displayName, formattedAmount) {
        const infoDiv = document.createElement('div');
        infoDiv.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.INFO_SECTION;

        const nameEl = this._createNameElement(displayName);
        const amountEl = this._createAmountElement(formattedAmount);

        infoDiv.appendChild(nameEl);
        infoDiv.appendChild(amountEl);

        return infoDiv;
    }

    _createCustomerLogo(partnerId) {
        if (!partnerId) return;

        const divEl = document.createElement('div');
        divEl.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.IMG_LOGO_CONTAINER;

        const logoEl = document.createElement('img');
        logoEl.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.IMG_LOGO;
        logoEl.loading = 'lazy';
        logoEl.src = `/web/image/res.partner/${partnerId}/avatar_128`;
        logoEl.alt = _t('Logo');
        logoEl.height = 32;
        logoEl.width = 32;

        divEl.appendChild(logoEl);
        return divEl;
    }

    /**
     * Create customer name element
     * @private
     * @param {string} displayName Customer display name
     * @returns {HTMLElement} Name element
     */
    _createNameElement(displayName) {
        const nameEl = document.createElement('p');
        nameEl.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.NAME;
        nameEl.textContent = displayName;
        return nameEl;
    }

    /**
     * Create amount element
     * @private
     * @param {string} formattedAmount Formatted amount string
     * @returns {HTMLElement} Amount element
     */
    _createAmountElement(formattedAmount) {
        const amountEl = document.createElement('small');
        amountEl.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.AMOUNT;
        amountEl.textContent = `$ ${formattedAmount}`;
        return amountEl;
    }

    /**
     * Create action button for opening records
     * @private
     * @param {Object} group The group data
     * @returns {HTMLElement} Action button element
     */
    _createActionButton(group) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.BUTTON;
        button.dataset.tooltip = _t('Open');

        const icon = this._createActionButtonIcon();
        button.appendChild(icon);

        const clickHandler = this._createActionClickHandler(group);
        button.addEventListener('click', clickHandler);
        this._storeElementEventListener(button, 'click', clickHandler);

        return button;
    }

    /**
     * Create icon for action button
     * @private
     * @returns {HTMLElement} Icon element
     */
    _createActionButtonIcon() {
        const icon = document.createElement('i');
        icon.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.ICON;
        icon.setAttribute('aria-hidden', 'true');
        return icon;
    }

    /**
     * Create click handler for action button
     * @private
     * @param {Object} group The group data
     * @returns {Function} Click handler function
     */
    _createActionClickHandler(group) {
        return (ev) => {
            try {
                ev.preventDefault();
                ev.stopPropagation();

                const domain = group.groupDomain;
                if (!domain) {
                    console.warn('No domain found for this group.', group);
                    return;
                }

                const displayName = group.displayName || _t('Customer');
                this.props.showRecordsByDomain(displayName, domain);
            } catch (error) {
                console.error('Error handling marker action button click:', error);
            }
        };
    }

    /**
     * @override
     * Create a new marker for sale order groups with enhanced setup
     * @param {Object} group The group data
     * @param {Object} geolocation Position data
     * @returns {Object} New marker
     */
    async _createNewMarker(group, geolocation) {
        const marker = await this._buildSaleOrderMarker(group, geolocation);
        this._setupSaleOrderMarkerMetadata(marker, group, geolocation);
        this._attachSaleOrderEventListeners(marker, group);
        this._handleSaleOrderMarkerPositioning(marker);
        this._updateMapBounds(marker);

        return marker;
    }

    /**
     * Build the actual AdvancedMarkerElement for sale orders
     * @private
     * @param {Object} group The group data
     * @param {Object} geolocation Position data
     * @returns {Object} AdvancedMarkerElement
     */
    async _buildSaleOrderMarker(group, geolocation) {
        const { AdvancedMarkerElement } = await this.apiLoader.importLibrary('marker');
        const content = this._createMarkerElement(group);
        const options = this._createSaleOrderMarkerOptions(geolocation);
        options.content = content;

        return new AdvancedMarkerElement(options);
    }

    /**
     * Create marker options for sale orders
     * @private
     * @param {Object} geolocation Position data
     * @returns {Object} Marker options
     */
    _createSaleOrderMarkerOptions(geolocation) {
        return {
            position: geolocation,
            map: this.googleMap,
            collisionBehavior: google.maps.CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL,
            zIndex: SALE_MARKER_CONFIG.VISUAL.Z_INDEX.DEFAULT,
        };
    }

    /**
     * Setup marker metadata and relationships for sale orders
     * @private
     * @param {Object} marker The marker to setup
     * @param {Object} group The group data
     * @param {Object} geolocation Position data
     */
    _setupSaleOrderMarkerMetadata(marker, group, geolocation) {
        marker._odooRecord = group;
        marker._markerOptionValues = marker.options;
        marker._isShifted = false;
        marker._originalPosition = {
            lat: geolocation.lat,
            lng: geolocation.lng,
        };

        // Establish bidirectional relationship
        group._marker = marker;

        // Store in cache
        this.cache.set(group.id, marker);
    }

    /**
     * Attach event listeners to sale order marker
     * @private
     * @param {Object} marker The marker to attach listeners to
     * @param {Object} group The group data
     */
    _attachSaleOrderEventListeners(marker, group) {
        const content = marker.content;
        const eventListeners = this._createSaleOrderEventListeners(marker, content);

        // Attach all event listeners
        Object.entries(eventListeners.events).forEach(([event, handler]) => {
            content.addEventListener(event, handler);
            this._storeElementEventListener(content, event, handler);
        });

    }

    /**
     * Create event listeners for sale order markers
     * @private
     * @param {Object} marker The marker object
     * @param {HTMLElement} content The marker content element
     * @returns {Object} Event listeners object
     */
    _createSaleOrderEventListeners(marker, content) {
        const handleMouseEnter = () => {
            marker.zIndex = SALE_MARKER_CONFIG.VISUAL.Z_INDEX.HOVER;
            content.classList.add('marker-hover-animation');
        };

        const handleMouseLeave = () => {
            marker.zIndex = SALE_MARKER_CONFIG.VISUAL.Z_INDEX.DEFAULT;
            content.classList.remove('marker-hover-animation');
        };

        return {
            events: {
                mouseenter: handleMouseEnter,
                mouseleave: handleMouseLeave,
                touchstart: handleMouseEnter,
                touchend: handleMouseLeave,
            },
        };
    }

    /**
     * Handle marker positioning including overlap management for sale orders
     * @private
     * @param {Object} marker The marker to position
     */
    _handleSaleOrderMarkerPositioning(marker) {
        this._handleMarkersOverlapAt(marker);

        if (marker._isShifted) {
            this._addShiftedMarkerIndicator(marker);
        }
    }

    /**
     * Add visual indicator for shifted markers
     * @private
     * @param {Object} marker The shifted marker
     */
    _addShiftedMarkerIndicator(marker) {
        const content = marker.content;
        const indicator = this._createShiftedMarkerIndicator();
        content.prepend(indicator);
    }

    /**
     * Create indicator element for shifted markers
     * @private
     * @returns {HTMLElement} Indicator element
     */
    _createShiftedMarkerIndicator() {
        const indicator = document.createElement('i');
        indicator.setAttribute('aria-hidden', 'true');
        indicator.className = SALE_MARKER_CONFIG.VISUAL.CLASSES.INFO_ICON;
        indicator.dataset.tooltip = _t(
            "This marker has been adjusted slightly so it doesn't overlap with others. The line points to its original location."
        );
        return indicator;
    }

    /**
     * @override
     */
    _handleAfterZoomAtMarker(marker) {
        super._handleAfterZoomAtMarker(marker);
        this._triggerMarkerHoverEffect(marker);
    }

    /**
     * Trigger hover effect on marker
     * @private
     * @param {Object} marker The marker to apply hover effect to
     */
    _triggerMarkerHoverEffect(marker) {
        const content = marker?.content;
        if (!content) {
            return;
        }

        // Clear any existing timeout to prevent conflicts
        if (marker._hoverTimeout) {
            clearTimeout(marker._hoverTimeout);
        }

        const mouseEnterEvent = new MouseEvent('mouseenter', {
            view: window,
            bubbles: true,
            cancelable: true,
        });

        const mouseLeaveEvent = new MouseEvent('mouseleave', {
            view: window,
            bubbles: true,
            cancelable: true,
        });

        // Trigger hover effect
        content.dispatchEvent(mouseEnterEvent);

        // Schedule automatic hover removal
        marker._hoverTimeout = setTimeout(() => {
            // Check if marker still exists and is valid
            if (content.isConnected) {
                // ← This checks if the DOM element is still in the document
                content.dispatchEvent(mouseLeaveEvent);
            }
            delete marker._hoverTimeout;
        }, 1000);
    }
    /**
     * @override
     */
    _cleanUpMarker(id, marker) {
        super._cleanUpMarker(id, marker);
        if (marker._hoverTimeout) {
            clearTimeout(marker._hoverTimeout);
            delete marker._hoverTimeout;
        }
    }

}
