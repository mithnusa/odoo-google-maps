import { useService } from '@web/core/utils/hooks';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapSidebarProject } from './google_map_sidebar';

export class GoogleMapRendererProject extends GoogleMapRenderer {
    static components = {
        ...GoogleMapRenderer.components,
        Sidebar: GoogleMapSidebarProject,
    };
    static templateInfoWindow = 'project_google_map.MarkerInfoWindow';

    setup() {
        super.setup();
        this.actionService = useService('action');
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
        this.env.model.orm
            .call('project.project', 'action_view_tasks', [record.resId])
            .then((action) => {
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
