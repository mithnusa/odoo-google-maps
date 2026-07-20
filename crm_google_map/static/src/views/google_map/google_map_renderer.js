import { _t } from '@web/core/l10n/translation';
import { t, props } from '@odoo/owl';
import { renderToString } from '@web/core/utils/render';
import { user } from '@web/core/user';
import { formatNumber } from '@web_view_google_map/views/google_map/utils';
import { GoogleMapRenderer, googleMapRendererProps } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarCRM } from './google_map_sidebar';

const { DateTime } = luxon;

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
            DEFAULT: null, // Default z-index for markers, will be set by Google Maps API
            HOVER: 9999,
        },
    },
};

export class GoogleMapRendererCRM extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarCRM,
    };
    static templateInfoWindow = 'crm_google_map.MarkerInfoWindow';
    static props = {
        ...googleMapRendererProps,
        openRecordScheduleActivity: t.function(),
        showRecordScheduledActivity: t.function(),
    };

    /**
     * @override
     */
    prepareInfoWindowValues(record) {
        const values = super.prepareInfoWindowValues(record);
        const lang = (user.context.lang || 'en_US').replace('_', '-');
        const { other = {} } = record.dataView || {};
        const {
            expectedRevenue,
            probability,
            dateDeadline,
            partnerId,
            userId,
            title,
            subTitle,
            stageId,
            contactName,
            partnerName,
            phone,
        } = other;

        values.expectedRevenue = expectedRevenue ? formatNumber(expectedRevenue, 2, user.context.lang) : false;
        values.probability = probability || 0;
        values.contactName = partnerId || contactName || false;
        values.phone = phone || false;
        values.salespersonName = userId || false;
        values.partnerName = partnerName || false;
        values.title = title || _t('Lead');
        values.subTitle = this.formatAddressForInfoWindow(values.title, subTitle || '');
        values.stage = stageId || false;
        if (dateDeadline) {
            const deadlineDateTime = DateTime.fromISO(dateDeadline);
            if (deadlineDateTime.isValid) {
                values.dateDeadline = deadlineDateTime.setLocale(lang).toLocaleString(DateTime.DATE_MED);
            } else {
                values.dateDeadline = false;
            }
        } else {
            values.dateDeadline = false;
        }
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
        const divContent = new DOMParser().parseFromString(content, 'text/html').querySelector('div');

        this._bindMarkerButton(divContent, '.lead-title #show-record', () => this.props.showRecord(record));
        this._bindMarkerButton(divContent, '#action-buttons #open-schedule-activity', () =>
            this.props.openRecordScheduleActivity(record)
        );
        this._bindMarkerButton(divContent, '#action-buttons #show-scheduled-activities', () =>
            this.props.showRecordScheduledActivity(record)
        );
        this._bindMarkerButton(divContent, '#action-buttons #show-nearby', () => this.searchNearbyRecords(record));
        this._bindMarkerButton(divContent, '#action-buttons #show-street-view', () =>
            this.props.showGoogleStreetViewSideBySide(record)
        );

        return divContent;
    }

    /**
     * Validate if record is ready for marker element creation
     * @private
     * @param {Object} record The record to validate
     * @returns {boolean} True if record is valid
     */
    _isValidRecordForMarkerElement(record) {
        return !!(record && record.dataView);
    }

    _bindMarkerButton(container, selector, handler) {
        const el = container.querySelector(selector);
        if (!el) return;
        el.style.cursor = 'pointer';
        const wrappedHandler = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            handler();
        };
        el.addEventListener('click', wrappedHandler);
        this._storeElementEventListener(el, 'click', wrappedHandler);
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
        this._setupMarkerMetadata(marker, record, geolocation, elementValues);
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
        const options = this._createCRMMarkerOptions(geolocation, data);
        options.content = this._createMarkerElement(record, elementValues);

        const advMarkerElement = new AdvancedMarkerElement(options);
        this.addMarkerMouseEventHandler(record, advMarkerElement);
        return advMarkerElement;
    }

    addMarkerMouseEventHandler(record, marker) {
        const clickListener = marker.addListener('gmp-click', () => {
            this.toggleMarkerHighlight(marker);
        });
        this._storeMarkerEventListener(record.resId, 'gmp-click', clickListener);

        const hoverHandlers = this._hoverMarkerHighlight(marker);
        Object.entries(hoverHandlers).forEach(([event, handler]) => {
            marker.content.addEventListener(event, handler);
            this._storeElementEventListener(marker.content, event, handler);
        });
    }

    toggleMarkerHighlight(marker) {
        if (marker.content.classList.contains('highlight')) {
            marker.content.classList.remove('highlight');
        } else {
            marker.content.classList.add('highlight');
            this._panToFitExpandedMarker(marker);
        }
    }

    _panToFitExpandedMarker(marker) {
        // Read rect after class is applied but before the transition frame starts.
        // The synchronous getBoundingClientRect() call forces a layout reflow,
        // giving us the final expanded dimensions before any CSS transition runs.
        const markerRect = marker.content.getBoundingClientRect();
        const mapRect = this.googleMap.getDiv().getBoundingClientRect();
        const PADDING = 16;

        let panX = 0;
        let panY = 0;

        if (markerRect.top < mapRect.top) {
            panY = markerRect.top - mapRect.top - PADDING;
        }
        if (markerRect.left < mapRect.left) {
            panX = markerRect.left - mapRect.left - PADDING;
        } else if (markerRect.right > mapRect.right) {
            panX = markerRect.right - mapRect.right + PADDING;
        }

        if (panX !== 0 || panY !== 0) {
            this.googleMap.panBy(panX, panY);
        }
    }

    _hoverMarkerHighlight(marker) {
        const handleMouseEnter = () => {
            marker.zIndex = CRM_MARKER_CONFIG.VISUAL.Z_INDEX.HOVER;
            marker.content.classList.add('marker-hover-animation');
        };

        const handleMouseLeave = () => {
            marker.zIndex = CRM_MARKER_CONFIG.VISUAL.Z_INDEX.DEFAULT;
            marker.content.classList.remove('marker-hover-animation');
        };

        return {
            mouseenter: handleMouseEnter,
            mouseleave: handleMouseLeave,
            touchstart: handleMouseEnter,
            touchend: handleMouseLeave,
        };
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
        content.querySelector('#title').append(indicator);
    }
}
