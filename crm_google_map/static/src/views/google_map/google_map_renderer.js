import { _t } from '@web/core/l10n/translation';
import { renderToString } from '@web/core/utils/render';
import { user } from '@web/core/user';
import { formatNumber } from '@web_view_google_map/views/google_map/utils';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarCRM } from './google_map_sidebar';

/**
 * Configuration constants for CRM lead marker behavior and styling
 */
const CRM_MARKER_CONFIG = {
    VISUAL: {
        CLASSES: {
            CONTAINER: 'crm_lead marker-drop-animation',
            INFO_ICON: 'fa fa-info-circle ms-1 text-info float-end',
        },
        Z_INDEX: {
            DEFAULT: 1,
            HOVER: 10000,
        },
    },
};

export class GoogleMapRendererCRM extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarCRM,
    };
    static templateInfoWindow = 'crm_google_map.MarkerInfoWindow';

    /**
     * @override
     */
    prepareInfoWindowValues(record) {
        let values = super.prepareInfoWindowValues(record);
        const lang = (user.context.lang || 'en_US').replace('_', '-');
        const { other = {} } = record.dataView;
        const {
            expectedRevenue,
            probability,
            dateDeadline,
            partnerId,
            userId,
            title,
            subTitle,
            stageId,
        } = other;

        values.expectedRevenue = expectedRevenue
            ? formatNumber(expectedRevenue, 2, user.context.lang)
            : false;
        values.probability = probability || 0;
        values.dateDeadline = dateDeadline ? dateDeadline.toLocaleString(lang || 'en-US') : false;
        values.partnerName = partnerId || false;
        values.salespersonName = userId || false;
        values.title = title || _t('Lead');
        values.subTitle = subTitle || '';
        values.stage = stageId || false;
        return values;
    }

    /**
     * @override
     */
    get markerSelectedClass() {
        return 'crm_lead marker-drop-animation selected-marker';
    }

    /**
     * @override
     */
    get markerDefaultClass() {
        return 'crm_lead marker-drop-animation';
    }

    /**
     * @override
     * Create marker element for CRM lead with enhanced structure
     * @param {Object} record The record containing lead data
     * @returns {HTMLElement} Marker content element
     */
    _createMarkerElement(record, elementValues) {
        if (!this._isValidRecordForMarkerElement(record)) {
            return this._createFallbackMarkerElement();
        }
        const values = this.prepareInfoWindowValues(record);
        values.markerColor = elementValues.color || 'red';
        values.isSelected = record.selected;
        const content = renderToString(this.constructor.templateInfoWindow, values);
        const divContent = new DOMParser()
            .parseFromString(content, 'text/html')
            .querySelector('div');

        const titleElement = divContent.querySelector('.lead-title');
        if (titleElement) {
            const eventHandler = this.props.showRecord.bind(this, record);
            titleElement.style.cursor = 'pointer';
            titleElement.addEventListener('click', eventHandler);
            this._storeElementEventListener(titleElement, 'click', eventHandler);
        }
        return divContent;
    }

    /**
     * Validate if record is ready for marker element creation
     * @private
     * @param {Object} record The record to validate
     * @returns {boolean} True if record is valid
     */
    _isValidRecordForMarkerElement(record) {
        if (!record || !record.dataView) {
            console.warn('Invalid record data for marker creation:', record);
            return false;
        }
        return true;
    }

    /**
     * Create fallback marker element for invalid records
     * @private
     * @returns {HTMLElement} Fallback marker element
     */
    _createFallbackMarkerElement() {
        const content = document.createElement('div');
        content.className = CRM_MARKER_CONFIG.VISUAL.CLASSES.CONTAINER;
        content.textContent = _t('Invalid Data');
        return content;
    }

    /**
     * Create icon for action button
     * @private
     * @returns {HTMLElement} Icon element
     */
    _createIcon(faIconClass, tooltipText) {
        const icon = document.createElement('i');
        icon.className = faIconClass;
        icon.setAttribute('aria-hidden', 'true');
        if (tooltipText) {
            icon.dataset.tooltip = tooltipText;
        }
        return icon;
    }

    /**
     * @override
     * Create a new marker for CRM leads with enhanced setup
     * @param {Object} record The record data
     * @param {Object} geolocation Position data
     * @param {Object} data Record data
     * @param {Object} elementValues Marker element values
     * @returns {Object} New marker
     */
    async _createNewMarker(record, geolocation, data, elementValues) {
        const marker = await this._buildCRMMarker(record, geolocation, data, elementValues);
        this._setupCRMMarkerMetadata(marker, record, geolocation, elementValues);
        this._attachCRMMarkerEventListeners(marker);
        this._handleCRMMarkerPositioning(marker);
        this._updateMapBounds(marker);

        return marker;
    }

    /**
     * Build the actual AdvancedMarkerElement for CRM leads
     * @private
     * @param {Object} record The record data
     * @param {Object} geolocation Position data
     * @param {Object} data Record data
     * @param {Object} elementValues Marker element values
     * @returns {Object} AdvancedMarkerElement
     */
    async _buildCRMMarker(record, geolocation, data, elementValues) {
        const { AdvancedMarkerElement } = await this.apiLoader.importLibrary('marker');
        const content = this._createMarkerElement(record, elementValues);
        const options = this._createCRMMarkerOptions(geolocation, data);
        options.content = content;

        return new AdvancedMarkerElement(options);
    }

    /**
     * Create marker options for CRM leads
     * @private
     * @param {Object} geolocation Position data
     * @param {Object} data Record data
     * @returns {Object} Marker options
     */
    _createCRMMarkerOptions(geolocation, data) {
        return {
            position: geolocation,
            map: this.googleMap,
            collisionBehavior: google.maps.CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL,
            zIndex: CRM_MARKER_CONFIG.VISUAL.Z_INDEX.DEFAULT,
            title: data.title || '',
        };
    }

    /**
     * Setup marker metadata and relationships for CRM leads
     * @private
     * @param {Object} marker The marker to setup
     * @param {Object} record The record data
     * @param {Object} geolocation Position data
     * @param {Object} elementValues Marker element values
     */
    _setupCRMMarkerMetadata(marker, record, geolocation, elementValues) {
        marker._odooRecord = record;
        marker._markerOptionValues = marker.options;
        marker._elementValues = elementValues;
        marker._isShifted = false;
        marker._originalPosition = {
            lat: geolocation.lat,
            lng: geolocation.lng,
        };

        // Establish bidirectional relationship
        record._marker = marker;

        // Store in cache
        this.cache.set(record.id, marker);
    }

    /**
     * Attach event listeners to CRM marker
     * @private
     * @param {Object} marker The marker to attach listeners to
     */
    _attachCRMMarkerEventListeners(marker) {
        const content = marker.content;
        const eventListeners = this._createCRMEventListeners(marker, content);

        // Attach all event listeners
        Object.entries(eventListeners.events).forEach(([event, handler]) => {
            content.addEventListener(event, handler);
            this._storeElementEventListener(content, event, handler);
        });
    }

    /**
     * Create event listeners for CRM markers
     * @private
     * @param {Object} marker The marker object
     * @param {HTMLElement} content The marker content element
     * @returns {Object} Event listeners object
     */
    _createCRMEventListeners(marker, content) {
        const handleMouseEnter = () => {
            marker.zIndex = CRM_MARKER_CONFIG.VISUAL.Z_INDEX.HOVER;
            content.classList.add('marker-hover-animation');
        };

        const handleMouseLeave = () => {
            marker.zIndex = CRM_MARKER_CONFIG.VISUAL.Z_INDEX.DEFAULT;
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
     * Handle marker positioning including overlap management for CRM leads
     * @private
     * @param {Object} marker The marker to position
     */
    _handleCRMMarkerPositioning(marker) {
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
        const indicator = this._createIcon(
            CRM_MARKER_CONFIG.VISUAL.CLASSES.INFO_ICON,
            _t(
                "This marker has been adjusted slightly so it doesn't overlap with others. The line points to its original location."
            )
        );
        content.prepend(indicator);
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
