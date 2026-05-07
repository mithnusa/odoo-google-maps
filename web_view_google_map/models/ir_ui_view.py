# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.tools.view_validation import get_expression_field_names


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    type = fields.Selection(selection_add=[('google_map', 'Google Maps')])

    def _get_view_info(self):
        view_info = super()._get_view_info()
        view_info['google_map'] = {'icon': 'fa fa-map-o'}
        return view_info

    def _validate_tag_google_map(self, node, name_manager, node_info):
        if not node_info['validate']:
            return

        att_js_class = node.get('js_class')
        att_lat = node.get('lat')
        att_lng = node.get('lng')
        att_color = node.get('color')
        att_sidebar_title = node.get('sidebar_title')

        if not att_sidebar_title:
            self._raise_view_error(_('Attribute "sidebar_title" is required on tag "google_map"'), node)

        is_drawing_view = att_js_class and 'drawing' in att_js_class
        if not is_drawing_view and (not att_lat or not att_lng):
            self._raise_view_error(_('Missing mandatory attribute for google_map view: "lat" and "lng"'), node)

        fields_name = [child.get('name') for child in node.iterchildren(tag='field')]

        if att_lat and att_lat not in fields_name:
            self._raise_view_error(_('Field %(name)s assigned to attribute "lat" but the field is not loaded. All fields used in "google_map" view attribute must be loaded', name=att_lat), node)

        if att_lng and att_lng not in fields_name:
            self._raise_view_error(_('Field %(name)s assigned to attribute "lng" but the field is not loaded. All fields used in "google_map" view attribute must be loaded', name=att_lng), node)

        if att_sidebar_title and att_sidebar_title not in fields_name:
            self._raise_view_error(_('Field %(name)s assigned to attribute "sidebar_title" but the field is not loaded. All fields used in "google_map" view attribute must be loaded', name=att_sidebar_title), node)

        if att_color and name_manager.model._fields.get(att_color) and att_color not in fields_name:
            self._raise_view_error(_('Field %(name)s assigned to attribute "color" but the field is not loaded. All fields used in "google_map" view attribute must be loaded', name=att_color), node)

    # The following methods are mostly copied from ir.ui.view and modified to
    # support google_map view type for x2many fields
    def _postprocess_tag_field(self, node, name_manager, node_info):
        name = node.get('name')
        if not name:
            return

        attrs = {'id': node.get('id'), 'select': node.get('select')}
        field = name_manager.model._fields.get(name)

        if field:
            if field.groups:
                group_definitions = self.env['res.groups']._get_group_definitions()
                node_info['model_groups'] &= group_definitions.parse(field.groups, raise_if_not_found=False)
            if (
                node_info.get('view_type') == 'form'
                and field.type in ('one2many', 'many2many')
                and not node.get('widget')
                and node.get('invisible') not in ('1', 'True')
                and not name_manager.parent
            ):
                # Embed kanban/list/form views for visible x2many fields in form views
                # if no widget or the widget requires it.
                # So the web client doesn't have to call `get_views` for x2many fields not embedding their view
                # in the main form view.
                for arch, _view in self._get_x2many_missing_view_archs(field, node, node_info):
                    node.append(arch)

            if field.relational:
                domain = (
                    node.get('domain')
                    or node_info['editable'] and field._description_domain(self.env)
                )
                if isinstance(domain, str):
                    vnames = get_expression_field_names(domain)
                    name_manager.must_have_fields(node, vnames, node_info, ('domain', domain))
            if field.type == 'properties':
                name_manager.must_have_fields(node, [field.definition_record], node_info, ('fieldname', field.name))
            context = node.get('context')
            if context:
                vnames = get_expression_field_names(context)
                name_manager.must_have_fields(node, vnames, node_info, ('context', context))

            for child in node:
                if child.tag in ('form', 'list', 'graph', 'kanban', 'calendar', 'google_map'):
                    node_info['children'] = []
                    self._postprocess_view(child, field.comodel_name, editable=node_info['editable'], node_info=node_info)

            if node_info['editable'] and field.type in ('many2one', 'many2many'):
                node.set('model_access_rights', field.comodel_name)

        name_manager.has_field(node, name, node_info, attrs)

    def _validate_tag_field(self, node, name_manager, node_info):
        validate = node_info['validate']

        name = node.get('name')
        if not name:
            self._raise_view_error(_("Field tag must have a \"name\" attribute defined"), node)

        field = name_manager.model._fields.get(name)
        if field:
            if field.groups:
                group_definitions = self.env['res.groups']._get_group_definitions()
                node_info['model_groups'] &= group_definitions.parse(field.groups, raise_if_not_found=False)

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
                    self._validate_domain_identifiers(node, name_manager, domain, desc, field.comodel_name, node_info)

            elif validate and node.get('domain'):
                msg = _(
                    'Domain on non-relational field "%(name)s" makes no sense (domain:%(domain)s)',
                    name=name, domain=node.get('domain'),
                )
                self._raise_view_error(msg, node)

            if field.type == 'properties' and node_info['view_type'] != 'search':
                name_manager.must_have_fields(node, {field._description_definition_record}, node_info, use=f"definition record of {field.name}")

            for child in node:
                if child.tag not in ('form', 'list', 'graph', 'kanban', 'calendar', 'google_map'):
                    continue
                node.remove(child)
                self._validate_view(
                    child, field.comodel_name, view_type=child.tag, editable=node_info['editable'],
                    node_info=node_info,
                )

        elif validate and name not in name_manager.field_info:
            msg = _(
                'Field "%(field_name)s" does not exist in model "%(model_name)s"',
                field_name=name, model_name=name_manager.model._name,
            )
            self._raise_view_error(msg, node)

        name_manager.has_field(node, name, node_info, {'id': node.get('id'), 'select': node.get('select')})

    @api.model
    def _get_view_fields(self, view_type, models):
        models = super()._get_view_fields(view_type, models)
        if view_type == 'google_map':
            for model, model_fields in models.items():
                model_fields.add('id')
                if 'write_date' in self.env[model]._fields:
                    model_fields.add('write_date')
        return models

    def _modifiers_from_model(self, node):
        modifier_names = super()._modifiers_from_model(node)
        if node.tag == 'google_map' and not all(name in modifier_names for name in ('readonly', 'required')):
            modifier_names += ['readonly', 'required']
        return modifier_names
