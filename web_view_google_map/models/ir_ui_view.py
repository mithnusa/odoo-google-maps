# -*- coding: utf-8 -*-
from pprint import pprint
import warnings
from lxml import etree
from lxml.builder import E

from odoo import _, api, fields, models


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    type = fields.Selection(selection_add=[('google_map', 'Google Maps')])

    @api.model
    def get_google_form_view_id(self, model_name):
        domain = [
            ('arch_db', 'ilike', 'js_class="google_map_form"'),
            ('model', '=', model_name),
        ]
        view = self.sudo().search_read(domain, [], limit=1)
        return view and view[0]['id']

    @api.model
    def _get_default_google_map_view(self):
        element = E.field(name=self._rec_name_fallback())
        return E.google_map(element, string=self._description)

    def _postprocess_tag_google_map(self, node, name_manager, node_info):
        print('\n\t _postprocess_tag_google_map')
        pprint({
            'node': node,
            'name_manager': name_manager,
            'node_info': node_info,
        })
        # reuse form view post-processing
        self._postprocess_tag_form(node, name_manager, node_info)

    def _editable_tag_google_map(self, node, name_manager):
        return node.get('editable') or node.get('multi_edit')

    def _onchange_able_view_google_map(self, node):
        return True

    def _validate_tag_google_map(self, node, name_manager, node_info):
        pass

    def _postprocess_tag_field(self, node, name_manager, node_info):
        '''This is a copy-paste code with a small modification in order to allow to render google_map inside a form view'''
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
                        node_t = E.t(groups=field.groups, postprocess_added='1')
                        node.getparent().replace(node, node_t)
                        node_t.append(node)
                    else:
                        node.set('groups', field.groups)
                if (
                    node_info.get('view_type') == 'form'
                    and field.type in ('one2many', 'many2many')
                    and not node.get('widget')
                    and node.get('invisible') not in ('1', 'True')
                    and not name_manager.parent
                ):
                    # Embed kanban/tree/form views for visible x2many fields in form views
                    # if no widget or the widget requires it.
                    # So the web client doesn't have to call `get_views` for x2many fields not embedding their view
                    # in the main form view.
                    for arch, _view in self._get_x2many_missing_view_archs(field, node, node_info):
                        node.append(arch)

                for child in node:
                    if child.tag in ('form', 'tree', 'graph', 'kanban', 'calendar', 'google_map'):
                        node_info['children'] = []
                        self._postprocess_view(
                            child, field.comodel_name, editable=node_info['editable'], parent_name_manager=name_manager,
                        )
                if node_info['editable'] and field.type in ('many2one', 'many2many'):
                    node.set('model_access_rights', field.comodel_name)

            name_manager.has_field(node, node.get('name'), attrs)

    def _validate_tag_field(self, node, name_manager, node_info):
        '''This is a copy-paste code with a small modification in order to allow to render google_map inside a form view'''
        validate = node_info['validate']

        name = node.get('name')
        if not name:
            self._raise_view_error(_("Field tag must have a \"name\" attribute defined"), node)

        field = name_manager.model._fields.get(name)
        if field:
            if validate and field.relational:
                domain = (
                    node.get('domain')
                    or node_info['editable'] and field._description_domain(self.env)
                )
                if isinstance(domain, str):
                    # dynamic domain: in [('foo', '=', bar)], field 'foo' must
                    # exist on the comodel and field 'bar' must be in the view
                    desc = (f'domain of <field name="{name}">' if node.get('domain')
                            else f"domain of python field {name!r}")
                    try:
                        self._validate_domain_identifiers(node, name_manager, domain, desc, field.comodel_name)
                    except ValueError as e:
                        if 'Modifier must be a domain' in str(e):
                            warnings.warn(f"Non-domain syntaxes are deprecated for attribute 'domain': {desc}\n{domain!r}", DeprecationWarning, 2)
                        else:
                            raise

            elif validate and node.get('domain'):
                msg = _(
                    'Domain on non-relational field "%(name)s" makes no sense (domain:%(domain)s)',
                    name=name, domain=node.get('domain'),
                )
                self._raise_view_error(msg, node)

            for child in node:
                if child.tag not in ('form', 'tree', 'graph', 'kanban', 'calendar', 'google_map'):
                    continue
                node.remove(child)
                sub_manager = self._validate_view(
                    child, field.comodel_name, view_type=child.tag, editable=node_info['editable'], full=validate,
                )
                for fname, groups_uses in sub_manager.mandatory_parent_fields.items():
                    for groups, use in groups_uses.items():
                        name_manager.must_have_field(node, fname, use, groups=groups)

        elif validate and name not in name_manager.field_info:
            msg = _(
                'Field "%(field_name)s" does not exist in model "%(model_name)s"',
                field_name=name, model_name=name_manager.model._name,
            )
            self._raise_view_error(msg, node)

        name_manager.has_field(node, name, {'id': node.get('id'), 'select': node.get('select')})