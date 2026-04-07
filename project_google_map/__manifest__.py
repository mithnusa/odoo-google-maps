# -*- coding: utf-8 -*-
{
    'name': 'Project Google Maps',
    'summary': 'Show projects in Google Maps view',
    'description': '''
        A new view 'Google Maps' added on projects, gives you
        an ability to show the project location in Google Maps
    ''',
    'license': 'AGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Project',
    'version': '1.0.1',
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
