import { useService } from '@web/core/utils/hooks';
import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

export class GoogleMapSidebarProject extends GoogleMapSidebar {
    static recordItemTemplate = 'project_google_map.RecordItem';

    setup() {
        super.setup();
        this.actionService = useService('action');
    }

    actionViewTask(record) {
        if (Number.isFinite(record.resId)) {
            this.env.model.orm
                .call('project.project', 'action_view_tasks', [record.resId])
                .then((action) => {
                    if (action) {
                        this.actionService.doAction(action);
                    }
                });
        }
    }
}
