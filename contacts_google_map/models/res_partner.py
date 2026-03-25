# -*- coding: utf-8 -*-
import math
from ast import literal_eval
import requests
import time
import logging

from odoo import _, api, fields, models
from odoo.fields import Domain
from odoo.exceptions import UserError


_logger = logging.getLogger(__name__)


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
    def action_cron_geolocalize_using_nominatim(self):
        """Cron entry point: geolocate partners that have a country but no coordinates.

        Processes up to 50 partners per run to respect Nominatim's rate limit
        (1 request/second). The next cron run will pick up the remaining records.
        """
        self.search(
            [
                ("country_id", "!=", False),
                ("partner_latitude", "=", False),
                ("partner_longitude", "=", False),
            ],
            limit=50,
            order="id desc",
        )._geolocalize_using_nominatim()
        return True

    def _geolocalize_using_nominatim(self):
        """Geolocate each partner in the recordset using the Nominatim API.

        Skips partners with no resolvable address. Coordinates are written
        directly on the record upon a successful lookup.
        """
        _logger.info(
            'Starting Nominatim geolocation for %d contact(s).', len(self)
        )
        for partner in self:
            address_parts = [
                partner.street,
                partner.street2,
                partner.city,
                partner.state_id.name if partner.state_id else None,
                partner.zip,
                partner.country_id.name if partner.country_id else None,
            ]
            address = ", ".join(filter(None, address_parts))
            if not address:
                continue

            lat, lng = self._geolocate_address_using_nominatim(
                address, country_code=partner.country_id.code
            )
            if lat is not None and lng is not None:
                partner.partner_latitude = lat
                partner.partner_longitude = lng

    def _geolocate_address_using_nominatim(self, address, country_code):
        """Resolve a free-form address to (latitude, longitude) via Nominatim.

        Enforces a 1-second delay before every request to comply with
        Nominatim's usage policy. On a 429 response, waits an additional
        5 seconds and retries once. Returns (None, None) on any failure.

        Args:
            address (str): Full address string to geocode.
            country_code (str): ISO 3166-1 alpha-2 code used to bias results
                (e.g. "MY", "US"). Passed as ``countrycodes`` to Nominatim.

        Returns:
            tuple[float, float] | tuple[None, None]: (latitude, longitude) on
            success, or (None, None) if the address could not be resolved.
        """
        # Nominatim's usage policy requires at most 1 request per second.
        time.sleep(1)

        params = {
            "q": address,
            "format": "json",
            "limit": 1,
        }
        if country_code:
            params["countrycodes"] = country_code.lower()

        # Nominatim requires a descriptive User-Agent identifying the app and
        # a contact URL so abusive traffic can be traced. The context key
        # ``cron_user_agent_geocoder`` allows callers to override the value,
        # e.g. to include a specific job identifier in scheduled runs.
        company_name = (self.env.company.name or "Odoo").replace(" ", "-").lower()
        base_url = (
            self.env["ir.config_parameter"]
            .sudo()
            .get_param("web.base.url", default="http://localhost")
        )
        default_user_agent = f"odoo-{company_name}-geocoder/1.0 ({base_url})"
        user_agent = self.env.context.get("cron_user_agent_geocoder", default_user_agent) or default_user_agent
        headers = {
            "User-Agent": user_agent,
            "Referer": base_url,
        }

        try:
            response = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params=params,
                headers=headers,
                timeout=10,
            )
            if response.status_code == 429:
                _logger.warning(
                    'Nominatim rate limit exceeded for "%s". Retrying after 5s delay.',
                    address,
                )
                time.sleep(5)
                response = requests.get(
                    "https://nominatim.openstreetmap.org/search",
                    params=params,
                    headers=headers,
                    timeout=10,
                )
                if response.status_code == 429:
                    _logger.warning(
                        'Nominatim rate limit still exceeded for "%s". Skipping.',
                        address,
                    )
                    return None, None
            response.raise_for_status()
            data = response.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
        except (requests.RequestException, ValueError, KeyError):
            _logger.warning(
                'Failed to geolocate address "%s" via Nominatim.', address, exc_info=True
            )
        return None, None

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
