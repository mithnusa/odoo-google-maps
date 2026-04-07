import { _t } from '@web/core/l10n/translation';
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
            const btnViewTasks = content.querySelector('#btn-view_tasks');
            if (btnViewTasks && Number.isFinite(record.resId)) {
                btnViewTasks.addEventListener('click', () => {
                    this.env.model.orm
                        .call('project.project', 'action_view_tasks', [record.resId])
                        .then((action) => {
                            if (action) {
                                this.actionService.doAction(action);
                            }
                        });
                });
            }
        }
        return content;
    }
}
