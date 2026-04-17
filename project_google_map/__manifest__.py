# -*- coding: utf-8 -*-
{
    'name': 'Project Google Maps',
    'summary': 'Display and navigate projects on an interactive Google Maps view',
    'description': '''
        Adds a Google Maps view to the Project module, allowing you to
        visualize project locations on an interactive map. Each project
        is shown as a marker based on its site coordinates. A sidebar
        lists all projects alongside the map, and a "View Tasks" button
        on each project opens the related task list directly from the map.
    ''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Project',
    'version': '1.0.2',
    'depends': [
        'project',
        'web_view_google_map',
        'web_widget_google_map',
    ],
    'data': [
        'views/project_project.xml',
        'views/project_task.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'project_google_map/static/src/views/**/*',
        ],
    },
    'demo': [],
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
    'installable': True,
    'application': False,
    'auto_install': False,
}
