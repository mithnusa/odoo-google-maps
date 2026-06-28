from . import models


def post_init_hook(env):
    # Project actions
    action_project1 = env.ref(
        'project.open_view_project_all', raise_if_not_found=False
    )
    if action_project1:
        view_mode = action_project1.view_mode.split(',')
        if 'google_map' not in view_mode:
            view_mode.append('google_map')
            action_project1.view_mode = ','.join(view_mode)

    action_project2 = env.ref(
        'project.open_view_project_all_group_stage', raise_if_not_found=False
    )
    if action_project2:
        view_mode = action_project2.view_mode.split(',')
        if 'google_map' not in view_mode:
            view_mode.append('google_map')
            action_project2.view_mode = ','.join(view_mode)

    action_project3 = env.ref(
        'project.open_view_project_all_config', raise_if_not_found=False
    )
    if action_project3:
        view_mode = action_project3.view_mode.split(',')
        if 'google_map' not in view_mode:
            view_mode.append('google_map')
            action_project3.view_mode = ','.join(view_mode)

    action_project4 = env.ref(
        'project.open_view_project_all_config_group_stage',
        raise_if_not_found=False,
    )
    if action_project4:
        view_mode = action_project4.view_mode.split(',')
        if 'google_map' not in view_mode:
            view_mode.append('google_map')
            action_project4.view_mode = ','.join(view_mode)

    # Task actions
    action_task1 = env.ref(
        'project.act_project_project_2_project_task_all',
        raise_if_not_found=False,
    )
    if action_task1:
        view_mode = action_task1.view_mode.split(',')
        if 'google_map' not in view_mode:
            view_mode.append('google_map')
            action_task1.view_mode = ','.join(view_mode)


def uninstall_hook(env):
    # Remove google_map view from project actions
    action_project1 = env.ref(
        'project.open_view_project_all', raise_if_not_found=False
    )
    if action_project1 and action_project1.view_mode:
        view_mode = action_project1.view_mode.split(',')
        if 'google_map' in view_mode:
            action_project1.view_mode = ','.join(
                [mode for mode in view_mode if mode != 'google_map']
            )

    action_project2 = env.ref(
        'project.open_view_project_all_group_stage', raise_if_not_found=False
    )
    if action_project2 and action_project2.view_mode:
        view_mode = action_project2.view_mode.split(',')
        if 'google_map' in view_mode:
            action_project2.view_mode = ','.join(
                [mode for mode in view_mode if mode != 'google_map']
            )

    action_project3 = env.ref(
        'project.open_view_project_all_config', raise_if_not_found=False
    )
    if action_project3 and action_project3.view_mode:
        view_mode = action_project3.view_mode.split(',')
        if 'google_map' in view_mode:
            action_project3.view_mode = ','.join(
                [mode for mode in view_mode if mode != 'google_map']
            )

    action_project4 = env.ref(
        'project.open_view_project_all_config_group_stage',
        raise_if_not_found=False,
    )
    if action_project4 and action_project4.view_mode:
        view_mode = action_project4.view_mode.split(',')
        if 'google_map' in view_mode:
            action_project4.view_mode = ','.join(
                [mode for mode in view_mode if mode != 'google_map']
            )

    # Remove google_map view from task actions
    action_task1 = env.ref(
        'project.act_project_project_2_project_task_all',
        raise_if_not_found=False,
    )
    if action_task1 and action_task1.view_mode:
        view_mode = action_task1.view_mode.split(',')
        if 'google_map' in view_mode:
            action_task1.view_mode = ','.join(
                [mode for mode in view_mode if mode != 'google_map']
            )
