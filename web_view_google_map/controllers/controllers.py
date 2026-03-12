from odoo.http import route
from odoo.addons.base_google_map.controllers.controllers import Main


class WebViewGoogleMapController(Main):

    @route()
    def map_setting(self):
        values = super().map_setting()
        nearby_radius_search = (
            self.env["ir.config_parameter"]
            .sudo()
            .get_param("web_view_google_map.nearby_radius_search", default="1000")
        )
        default_radius = 1000
        try:
            values["nearby_radius_search"] = int(nearby_radius_search)
        except (ValueError, TypeError):
            values["nearby_radius_search"] = default_radius
        return values
