# -*- coding: utf-8 -*-
from lxml.builder import E

from odoo import _, fields, models
from odoo.addons.base.models.ir_ui_view import transfer_field_to_modifiers
from odoo.tools import str2bool, safe_eval


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    type = fields.Selection(selection_add=[('google_map', 'Google Maps')])

    '''
    The following overwrite methods aims to allow render google_map view
    inside form view.
    '''

    def _modifiers_from_model(self, node):
        modifier_names = ['invisible']
        if node.tag in ('kanban', 'tree', 'form', 'google_map'):
            modifier_names += ['readonly', 'required']
        return modifier_names

    def _postprocess_tag_field(self, node, name_manager, node_info):
        if node.get('name'):
            attrs = {'id': node.get('id'), 'select': node.get('select')}
            field = name_manager.model._fields.get(node.get('name'))
            if field:
                if field.groups:
                    if node.get('groups'):
                        # if the node has a group (e.g. "base.group_no_one")
                        # and the field in the Python model has a group as well (e.g. "base.group_system")
                        # the user must have both group to see the field.
                        # groups="base.group_no_one,base.group_system" directly on the node
                        # would be one of the two groups, not both (OR instead of AND).
                        # To make mandatory to have both groups, wrap the field node in a <t> node with the group
                        # set on the field in the Python model
                        # e.g. <t groups="base.group_system"><field name="foo" groups="base.group_no_one"/></t>
                        # The <t> node will be removed later, in _postprocess_access_rights.
                        node_t = E.t(
                            groups=field.groups, postprocess_added='1'
                        )
                        node.getparent().replace(node, node_t)
                        node_t.append(node)
                    else:
                        node.set('groups', field.groups)
                if (
                    node_info.get('view_type') == 'form'
                    and field.type in ('one2many', 'many2many')
                    and not node.get('widget')
                    and not node.get('invisible')
                    and not name_manager.parent
                ):
                    # Embed kanban/tree/form views for visible x2many fields in form views
                    # if no widget or the widget requires it.
                    # So the web client doesn't have to call `get_views` for x2many fields not embedding their view
                    # in the main form view.
                    for arch, _view in self._get_x2many_missing_view_archs(
                        field, node, node_info
                    ):
                        node.append(arch)

                for child in node:
                    if child.tag in (
                        'form',
                        'tree',
                        'graph',
                        'kanban',
                        'calendar',
                        'google_map',
                    ):
                        node_info['children'] = []
                        self._postprocess_view(
                            child,
                            field.comodel_name,
                            editable=node_info['editable'],
                            parent_name_manager=name_manager,
                        )
                if node_info['editable'] and field.type in (
                    'many2one',
                    'many2many',
                ):
                    node.set('model_access_rights', field.comodel_name)

            name_manager.has_field(node, node.get('name'), attrs)

            field_info = name_manager.field_info.get(node.get('name'))
            if field_info:
                transfer_field_to_modifiers(
                    field_info,
                    node_info['modifiers'],
                    node_info['view_modifiers_from_model'],
                )

    def _validate_tag_field(self, node, name_manager, node_info):
        validate = node_info['validate']

        name = node.get('name')
        if not name:
            self._raise_view_error(
                _("Field tag must have a \"name\" attribute defined"), node
            )

        field = name_manager.model._fields.get(name)
        if field:
            if validate and field.relational:
                domain = (
                    node.get('domain')
                    or node_info['editable']
                    and field._description_domain(self.env)
                )
                if isinstance(domain, str):
                    # dynamic domain: in [('foo', '=', bar)], field 'foo' must
                    # exist on the comodel and field 'bar' must be in the view
                    desc = (
                        f'domain of <field name="{name}">'
                        if node.get('domain')
                        else f"domain of field '{name}'"
                    )
                    fnames, vnames = self._get_domain_identifiers(
                        node, domain, desc
                    )
                    self._check_field_paths(
                        node, fnames, field.comodel_name, f"{desc} ({domain})"
                    )
                    if vnames:
                        name_manager.must_have_fields(
                            node, vnames, f"{desc} ({domain})"
                        )

            elif validate and node.get('domain'):
                msg = _(
                    'Domain on non-relational field "%(name)s" makes no sense (domain:%(domain)s)',
                    name=name,
                    domain=node.get('domain'),
                )
                self._raise_view_error(msg, node)

            for child in node:
                if child.tag not in (
                    'form',
                    'tree',
                    'graph',
                    'kanban',
                    'calendar',
                    'google_map',
                ):
                    continue
                node.remove(child)
                sub_manager = self._validate_view(
                    child,
                    field.comodel_name,
                    editable=node_info['editable'],
                    full=validate,
                )
                for (
                    fname,
                    groups_uses,
                ) in sub_manager.mandatory_parent_fields.items():
                    for groups, use in groups_uses.items():
                        name_manager.must_have_field(
                            node, fname, use, groups=groups
                        )

        elif validate and name not in name_manager.field_info:
            msg = _(
                'Field "%(field_name)s" does not exist in model "%(model_name)s"',
                field_name=name,
                model_name=name_manager.model._name,
            )
            self._raise_view_error(msg, node)

        name_manager.has_field(
            node, name, {'id': node.get('id'), 'select': node.get('select')}
        )

        if validate:
            for attribute in ('invisible', 'readonly', 'required'):
                val = node.get(attribute)
                if val:
                    try:
                        # most (~95%) elements are 1/True/0/False
                        res = str2bool(val)
                    except ValueError:
                        res = safe_eval.safe_eval(
                            val, {'context': self._context}
                        )
                    if res not in (1, 0, True, False, None):
                        msg = _(
                            'Attribute %(attribute)s evaluation expects a boolean, got %(value)s',
                            attribute=attribute,
                            value=val,
                        )
                        self._raise_view_error(msg, node)
