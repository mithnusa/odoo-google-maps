from lxml import etree
from odoo import fields, models


class IrUiView(models.Model):
    _inherit = "ir.ui.view"

    type = fields.Selection(selection_add=[("google_map", "Google Maps")])

    def _get_view_info(self):
        view_info = super()._get_view_info()
        view_info["google_map"] = {"icon": "fa fa-map-o"}
        return view_info

    def _validate_tag_google_map(self, node, name_manager, node_info):
        super()._validate_tag_google_map(node, name_manager, node_info)
        if not node_info["validate"]:
            return

        att_js_class = node.get("js_class")
        att_lat = node.get("lat")
        att_lng = node.get("lng")
        att_geojson = node.get("geojson")

        if att_js_class and "drawing" in att_js_class:
            if att_geojson is None:
                self._raise_view_error(
                    self.env._(
                        'Missing mandatory attribute for google_map_drawing view: "geojson"'
                    ),
                    node,
                )

            if att_lat or att_lng:
                self._log_view_warning(
                    self.env._(
                        'Attributes "lat" and "lng" should not be set when using "drawing" js_class in google_map view'
                    ),
                    node,
                )

        fields_name = [
            child.get("name")
            for child in node.iterchildren(tag=etree.Element)
            if child.tag == "field"
        ]

        if att_geojson and att_geojson not in fields_name:
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "geojson" does not exist. All fields used in google_map view attribute must be loaded',
                    name=att_geojson,
                ),
                node,
            )
