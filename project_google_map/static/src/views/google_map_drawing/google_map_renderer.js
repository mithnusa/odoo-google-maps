import { useService } from '@web/core/utils/hooks';
import { GoogleMapSidebarProject } from './google_map_sidebar';
import { GoogleMapDeckGLRenderer } from '@web_view_google_map_drawing/views/google_map_drawing/google_map_deckgl_renderer';
import { hexToRgba } from '@web_view_google_map/views/google_map/utils';
import { DECKGL_CONFIG, STROKE_CONFIG } from '@web_view_google_map_drawing/utils/map_config';

export class GoogleMapDeckGLRendererProject extends GoogleMapDeckGLRenderer {
    static components = {
        ...GoogleMapDeckGLRenderer.components,
        Sidebar: GoogleMapSidebarProject,
    };
    static templateInfoWindow = 'project_google_map.MarkerInfoWindow';

    setup() {
        super.setup();
        this.actionService = useService('action');
        this.ormService = useService('orm');
    }

    _createInfoWindowContent(record, isShifted = false) {
        const content = super._createInfoWindowContent(record, isShifted);
        if (content) {
            const viewTaskButton = content.querySelector('[data-role="btn-view_tasks"]');
            if (viewTaskButton && Number.isFinite(record.resId)) {
                const eventHandler = this._actionViewTasks.bind(this, record);
                viewTaskButton.addEventListener('click', eventHandler);
                this._storeElementEventListener(viewTaskButton, 'click', eventHandler);
            }
        }
        return content;
    }

    _actionViewTasks(record) {
        this.ormService.call('project.project', 'action_view_tasks', [record.resId]).then((action) => {
            if (action) {
                this.actionService.doAction(action);
            }
        });
    }

    get sidebarProps() {
        return Object.assign(super.sidebarProps, {
            onActionViewTask: this._actionViewTasks.bind(this),
        });
    }
}

const PROJECT_GEOJSON_FIELD = 'project_geojson';
const PROJECT_ID_FIELD = 'project_id';
const PROJECT_COLOR = '#ff5100';

export class GoogleMapDeckGLRendererTask extends GoogleMapDeckGLRenderer {
    setup() {
        super.setup();
        // Parent project boundary features, rendered underneath the task's own
        // shapes. Keyed by project id so a project shared by several tasks is
        // only processed once per render.
        this.projectGeoJsonData = new Map();
        this._processedProjectIds = new Set();
    }

    validateProps() {
        super.validateProps();
        if (!this.props.list.fieldNames.includes(PROJECT_GEOJSON_FIELD)) {
            throw new Error(`GeoJSON field "${PROJECT_GEOJSON_FIELD}" not found in list view fields.`);
        }
    }

    _clearRenderingData() {
        super._clearRenderingData();
        this.projectGeoJsonData.clear();
        this._processedProjectIds.clear();
    }

    _processRecordGeoJSON(record, color) {
        super._processRecordGeoJSON(record, color);
        this._processProjectGeoJSON(record);
    }

    /**
     * Capture the parent project's boundary geojson once per project.
     * @private
     */
    _processProjectGeoJSON(record) {
        const projectId = record.data[PROJECT_ID_FIELD]?.id;
        if (!projectId || this._processedProjectIds.has(projectId)) return;
        this._processedProjectIds.add(projectId);

        const geoJson = record.data[PROJECT_GEOJSON_FIELD];
        if (!geoJson?.features?.length) return;

        const fillColor = hexToRgba(PROJECT_COLOR, 0.15, DECKGL_CONFIG.DEFAULT_COLORS.FILL);
        const strokeColor = hexToRgba(PROJECT_COLOR, 0.9, DECKGL_CONFIG.DEFAULT_COLORS.STROKE);

        geoJson.features.forEach((feature, i) => {
            const featureId = `project-${projectId}-${i}`;
            this.projectGeoJsonData.set(featureId, {
                id: featureId,
                type: feature.type,
                geometry: feature.geometry,
                properties: {
                    ...feature.properties,
                    odooProjectId: projectId,
                    color: PROJECT_COLOR,
                    fillColor,
                    strokeColor,
                },
            });
        });
    }

    /**
     * @override
     * Renders the project boundary polygons/lines beneath the task layers.
     * Non-pickable: it is a visual backdrop, not a selectable feature.
     */
    _getBackgroundLayers() {
        if (!this.projectGeoJsonData.size) return [];

        const polygonData = [];
        const lineData = [];
        for (const feature of this.projectGeoJsonData.values()) {
            const type = feature.geometry.type;
            if (type === 'Polygon' || type === 'MultiPolygon') {
                polygonData.push(feature);
            } else if (type === 'LineString' || type === 'MultiLineString') {
                lineData.push(feature);
            }
        }

        const dottedLineProps = {
            extensions: [new window.deck.PathStyleExtension({ dash: true })],
            getDashArray: [1, 3],
            dashJustified: true,
            capRounded: true,
        };

        return [
            new window.deck.GeoJsonLayer({
                id: 'projectPolygonsLayer',
                data: polygonData,
                filled: true,
                stroked: true,
                wrapLongitude: true,
                getFillColor: (d) => d.properties.fillColor,
                getLineColor: (d) => d.properties.strokeColor,
                getLineWidth: STROKE_CONFIG.DEFAULT_WIDTH,
                lineWidthMinPixels: STROKE_CONFIG.DEFAULT_WIDTH,
                lineWidthMaxPixels: STROKE_CONFIG.HOVER_WIDTH,
                pickable: false,
                ...dottedLineProps,
            }),
            new window.deck.GeoJsonLayer({
                id: 'projectLinesLayer',
                data: lineData,
                filled: false,
                stroked: true,
                wrapLongitude: true,
                getLineColor: (d) => d.properties.strokeColor,
                getLineWidth: 3,
                lineWidthUnits: 'pixels',
                lineWidthMinPixels: 3,
                lineWidthMaxPixels: 6,
                pickable: false,
                ...dottedLineProps,
            }),
        ];
    }
}
