# -*- coding: utf-8 -*-
{
    'name': 'Project Google Maps',
    'summary': 'Google Maps views for Projects and Tasks with site addresses and status-colored markers',
    'description': """
Project Google Maps
===================

Adds Google Maps views to both the Project and Task lists in Odoo's Project
application.

Provides:

- ``partner_site_id`` (Many2one to ``res.partner``), ``site_latitude``, and ``site_longitude`` fields on both ``project.project`` and ``project.task``
- ``marker_color`` computed on ``project.project`` — derives a hex color from ``last_update_status``: green (on track), orange (at risk), red (off track), cyan (on hold), purple (done), gray (no status)
- ``marker_color`` Integer field on ``project.task`` with a color picker widget for per-task marker customization
- New ``site`` partner type on ``res.partner`` with a dedicated site icon as the avatar placeholder, keeping site addresses separate from contacts
- ``post_init_hook``: adds the ``google_map`` view mode to 4 project actions (All Projects, All Projects by Stage, Configuration, Configuration by Stage) and 1 task action; ``uninstall_hook`` removes them cleanly on uninstall
- Sidebar listing projects or tasks alongside the map; a "View Tasks" button in each project marker opens the filtered task list directly from the map
""",
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Project',
    'version': '19.0.1.0.5',
    'depends': [
        'project',
        'web_view_google_map',
    ],
    'data': [
        'views/project_project.xml',
        'views/project_task.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'project_google_map/static/src/views/google_map/google_map_sidebar.js',
            'project_google_map/static/src/views/google_map/google_map_sidebar.xml',
            'project_google_map/static/src/views/google_map/google_map_renderer.js',
            'project_google_map/static/src/views/google_map/google_map_renderer.xml',
            'project_google_map/static/src/views/google_map/google_map_view.js',
        ],
    },
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
}
