# -*- coding: utf-8 -*-
from lxml import etree
from lxml.builder import E

from odoo import _, api, fields, models

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
        att_sidebar_title = node.get('sidebar_title')

        if not att_sidebar_title:
            self._raise_view_error(_('Attribute "sidebar_title" is required on tag "google_map"'), node)

        if ((att_js_class and not 'drawing' in att_js_class) or (not att_js_class)) and not att_lat and not att_lng:
            self._raise_view_error(_('Missing mandatory attribute for google_map view: "lat" and "lng"'), node)

        fields_name = [child.get('name') for child in node.iterchildren(tag=etree.Element) if child.tag == 'field']

        if att_lat and not att_lat in fields_name:
            self._raise_view_error(_('Field %(name)s assigned to attribute "lat" does not exist. All fields used in google_map view attribute must be loaded', name=att_lat), node)

        if att_lng and not att_lng in fields_name:
            self._raise_view_error(_('Field %(name)s assigned to attribute "lng" does not exist. All fields used in google_map view attribute must be loaded', name=att_lng), node)

        if att_sidebar_title and not att_sidebar_title in fields_name:
            self._raise_view_error(_('Field %(name)s assigned to attribute "sidebar_title" does not exist. All fields used in google_map view attribute must be loaded', name=att_sidebar_title), node)

    def _get_additional_nestable_view_tags(self):
        """Tags that _postprocess_tag_field/_validate_tag_field must treat as
        nested view archs embeddable inside a <field> node, on top of Odoo's
        built-in ('form', 'list', 'graph', 'kanban', 'calendar').
        Modules adding a new map-like view type should override this and
        extend the tuple via super(), instead of overriding the two methods
        below directly."""
        return ('google_map',)

    def _postprocess_tag_field(self, node, name_manager, node_info):
        super()._postprocess_tag_field(node, name_manager, node_info)

        name = node.get('name')
        field = name_manager.model._fields.get(name) if name else None
        if not field:
            return

        nestable_tags = self._get_additional_nestable_view_tags()
        if not nestable_tags:
            return

        for child in node:
            if child.tag in nestable_tags:
                node_info['children'] = []
                self._postprocess_view(child, field.comodel_name, editable=node_info['editable'], node_info=node_info)

    def _validate_tag_field(self, node, name_manager, node_info):
        super()._validate_tag_field(node, name_manager, node_info)

        name = node.get('name')
        field = name_manager.model._fields.get(name) if name else None
        if not field:
            return

        nestable_tags = self._get_additional_nestable_view_tags()
        if not nestable_tags:
            return

        for child in list(node):
            if child.tag not in nestable_tags:
                continue
            node.remove(child)
            self._validate_view(
                child, field.comodel_name, view_type=child.tag, editable=node_info['editable'],
                node_info=node_info,
            )
