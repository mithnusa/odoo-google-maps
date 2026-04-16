# -*- coding: utf-8 -*-
import math
from ast import literal_eval

from odoo import _, api, fields, models
from odoo.fields import Domain
from odoo.exceptions import UserError


class ResPartner(models.Model):
    _inherit = "res.partner"

    marker_color = fields.Integer(string="Marker Color", default=1)

    def _compute_bounding_box(self, lat, lng, radius_meters):
        """Computes a bounding box around a geographic point for proximity search.

        Uses a flat-Earth degree approximation. Latitude is clamped to ±90°.
        Longitude is not normalised here — antimeridian handling is done in
        :meth:`_compute_bounding_box_domain`.

        Args:
            lat (float): Center latitude in decimal degrees.
            lng (float): Center longitude in decimal degrees.
            radius_meters (float): Search radius in meters.

        Returns:
            dict: Keys ``min_lat``, ``max_lat``, ``min_lng``, ``max_lng``.
        """
        lat_delta = radius_meters / 111320
        cos_lat = max(abs(math.cos(math.radians(lat))), 0.0001)
        lng_delta = radius_meters / (111320 * cos_lat)
        return {
            "min_lat": max(lat - lat_delta, -90),
            "max_lat": min(lat + lat_delta, 90),
            "min_lng": lng - lng_delta,
            "max_lng": lng + lng_delta,
        }

    def _compute_bounding_box_domain(self, lat, lng, radius_meters):
        """Builds an Odoo domain that filters partners within a bounding box around
        a geographic point. Longitude wraparound at ±180° is handled by splitting
        the longitude range into two OR clauses when the box crosses the antimeridian.

        Returns both the domain (for search queries) and the bounding box coordinates
        (for forwarding to the frontend via context).

        Args:
            lat (float): Center latitude in decimal degrees.
            lng (float): Center longitude in decimal degrees.
            radius_meters (float): Search radius in meters; determines box half-width.

        Returns:
            tuple: A 2-tuple of:
                - ``domain`` (list): Odoo domain filtering partners within the box.
                - ``bounding_box`` (dict): Keys ``north``, ``south``, ``east``, ``west``.
        """
        bbox = self._compute_bounding_box(lat, lng, radius_meters)
        min_lat = bbox["min_lat"]
        max_lat = bbox["max_lat"]
        min_lng = bbox["min_lng"]
        max_lng = bbox["max_lng"]

        lat_domain = [
            ("partner_latitude", ">=", min_lat),
            ("partner_latitude", "<=", max_lat),
        ]

        if max_lng > 180:
            # e.g. centre lng=179, max_lng=182 → lng >= 176 OR lng <= -178
            lng_domain = Domain.OR(
                [
                    [("partner_longitude", ">=", min_lng)],
                    [("partner_longitude", "<=", max_lng - 360)],
                ]
            )
        elif min_lng < -180:
            # e.g. centre lng=-179, min_lng=-182 → lng >= -178 OR lng <= maxLng
            lng_domain = Domain.OR(
                [
                    [("partner_longitude", ">=", min_lng + 360)],
                    [("partner_longitude", "<=", max_lng)],
                ]
            )
        else:
            lng_domain = [
                ("partner_longitude", ">=", min_lng),
                ("partner_longitude", "<=", max_lng),
            ]

        domain = Domain.AND([lat_domain, lng_domain])
        bounding_box = {
            "north": max_lat,
            "south": min_lat,
            "east": max_lng - 360 if max_lng > 180 else max_lng,
            "west": min_lng + 360 if min_lng < -180 else min_lng,
        }
        return domain, bounding_box

    @api.model
    def action_cron_geolocalize(self):
        self.search(
            [
                ("country_id", "!=", False),
                ("partner_latitude", "=", False),
                ("partner_longitude", "=", False),
            ],
            limit=500,
        ).geo_localize()
        return True

    def action_nearby_search(self):
        self.ensure_one()
        if not self.partner_latitude and not self.partner_longitude:
            raise UserError(_("This contact does not have geolocation coordinates."))

        radius_meters = (
            self.env["ir.config_parameter"]
            .sudo()
            .get_param(
                "web_view_google_map.nearby_radius_search", default="1000"
            )
        )
        try:
            radius = int(radius_meters)
        except (ValueError, TypeError):
            radius = 1000

        domain, bounding_box = self._compute_bounding_box_domain(
            self.partner_latitude,
            self.partner_longitude,
            radius,
        )
        action = self.env["ir.actions.act_window"]._for_xml_id(
            "contacts.action_contacts"
        )
        context = dict(literal_eval(action.get("context", {})))
        context.update(
            {
                "is_nearby_search": True,
                "nearby_search_center": {
                    "lat": self.partner_latitude,
                    "lng": self.partner_longitude,
                },
                "nearby_search_radius": radius,
                "nearby_bounding_box": bounding_box,
            }
        )
        title = _("Nearby Contacts (within %.1f km)", radius / 1000)
        action.update(
            {
                "domain": domain,
                "context": context,
                "name": title,
                "display_name": title,
            }
        )
        return action

    @api.onchange('street', 'zip', 'city', 'state_id', 'country_id')
    def _delete_coordinates(self):
        # Odoo resets coordinates to False when the address changes.
        # However, when we update the partner from the Google Maps view after selecting a place,
        # it also updates these fields and would trigger this method, deleting the coordinates we just set.
        # To prevent this, we check for a context flag that indicates the update is coming from the Google Maps workflow and skip deleting coordinates in that case.
        if self.env.context.get('is_from_google_maps'):
            return

        # The method `_delete_coordinates` is defined in the enterprise version of res.partner,
        # so we check if it exists before calling super to avoid errors in the community edition.
        if hasattr(super(), '_delete_coordinates'):
            super()._delete_coordinates()
