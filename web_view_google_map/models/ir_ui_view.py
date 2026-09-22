# -*- coding: utf-8 -*-
from odoo import api, fields, models


class IrUiView(models.Model):
    _inherit = "ir.ui.view"

    type = fields.Selection(selection_add=[("google_map", "Google Maps")])

    def _get_view_info(self):
        view_info = super()._get_view_info()
        view_info["google_map"] = {"icon": "fa fa-map-o"}
        return view_info

    def _validate_tag_google_map(self, node, name_manager, node_info):
        if not node_info["validate"]:
            return

        att_js_class = node.get("js_class")
        att_lat = node.get("lat")
        att_lng = node.get("lng")
        att_color = node.get("color")
        att_sidebar_title = node.get("sidebar_title")

        if not att_sidebar_title:
            self._raise_view_error(
                self.env._(
                    'Attribute "sidebar_title" is required on tag "google_map"'
                ),
                node,
            )

        is_drawing_view = att_js_class and "drawing" in att_js_class
        if not is_drawing_view and (not att_lat or not att_lng):
            self._raise_view_error(
                self.env._(
                    'Missing mandatory attribute for google_map view: "lat" and "lng"'
                ),
                node,
            )

        fields_name = [
            child.get("name") for child in node.iterchildren(tag="field")
        ]

        if att_lat and att_lat not in fields_name:
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "lat" but the field is not loaded. All fields used in "google_map" view attribute must be loaded',
                    name=att_lat,
                ),
                node,
            )

        if att_lng and att_lng not in fields_name:
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "lng" but the field is not loaded. All fields used in "google_map" view attribute must be loaded',
                    name=att_lng,
                ),
                node,
            )

        if att_sidebar_title and att_sidebar_title not in fields_name:
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "sidebar_title" but the field is not loaded. All fields used in "google_map" view attribute must be loaded',
                    name=att_sidebar_title,
                ),
                node,
            )

        if (
            att_color
            and name_manager.model._fields.get(att_color)
            and att_color not in fields_name
        ):
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "color" but the field is not loaded. All fields used in "google_map" view attribute must be loaded',
                    name=att_color,
                ),
                node,
            )

    def _get_additional_nestable_view_tags(self):
        """Tags that _postprocess_tag_field/_validate_tag_field must treat
        as nested view archs embeddable inside a <field> node, on top of
        Odoo's built-in ('form', 'list', 'graph', 'kanban', 'calendar').
        Modules adding a new map-like view type should override this and
        extend the tuple via super(), instead of overriding the two
        methods below directly."""
        return ("google_map",)

    def _postprocess_tag_field(self, node, name_manager, node_info):
        super()._postprocess_tag_field(node, name_manager, node_info)

        name = node.get("name")
        field = name_manager.model._fields.get(name) if name else None
        if not field:
            return

        for child in node:
            if child.tag in self._get_additional_nestable_view_tags():
                node_info["children"] = []
                self._postprocess_view(
                    child,
                    field.comodel_name,
                    editable=node_info["editable"],
                    node_info=node_info,
                )

    def _validate_tag_field(self, node, name_manager, node_info):
        super()._validate_tag_field(node, name_manager, node_info)

        name = node.get("name")
        field = name_manager.model._fields.get(name) if name else None
        if not field:
            return

        for child in list(node):
            if child.tag not in self._get_additional_nestable_view_tags():
                continue
            node.remove(child)
            self._validate_view(
                child,
                field.comodel_name,
                view_type=child.tag,
                editable=node_info["editable"],
                node_info=node_info,
            )

    @api.model
    def _get_view_fields(self, view_type, models):
        models = super()._get_view_fields(view_type, models)
        if view_type == "google_map":
            for model, model_fields in models.items():
                model_fields.add("id")
                if "write_date" in self.env[model]._fields:
                    model_fields.add("write_date")
        return models

    def _modifiers_from_model(self, node):
        modifier_names = super()._modifiers_from_model(node)
        if node.tag == "google_map" and not all(
            name in modifier_names for name in ("readonly", "required")
        ):
            modifier_names += ["readonly", "required"]
        return modifier_names
