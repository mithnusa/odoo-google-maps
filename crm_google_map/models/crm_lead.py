from collections import defaultdict
import time
import logging

from odoo import api, fields, models
from odoo.fields import Domain
from odoo.addons.base.models.res_partner import ADDRESS_FIELDS
from odoo.addons.crm.models.crm_lead import PARTNER_ADDRESS_FIELDS_TO_SYNC

_logger = logging.getLogger(__name__)


def _lead_address_matches_partner(lead, partner):
    """Return True when the lead's address is still in sync with its partner.

    Normalises False and '' for Char fields — the ORM may store either
    depending on the write path, and a bare False != '' comparison would
    wrongly detect a divergence and schedule the lead for re-geocoding.
    Many2one fields (state_id, country_id) use recordset equality, which
    correctly compares by ID and handles empty recordsets.
    """
    for fname in PARTNER_ADDRESS_FIELDS_TO_SYNC:
        lead_val = lead[fname]
        partner_val = partner[fname]
        if isinstance(lead_val, str):
            lead_val = lead_val or False
        if isinstance(partner_val, str):
            partner_val = partner_val or False
        if lead_val != partner_val:
            return False
    return True


class CrmLead(models.Model):
    _inherit = "crm.lead"

    @api.model
    def _get_default_address_format(self):
        return "%(street)s\n%(street2)s\n%(city)s %(state_code)s %(zip)s\n%(country_name)s"

    def _display_address_depends(self):
        # field dependencies of method _display_address()
        return self._formatting_address_fields() + [
            "country_id",
            "state_id",
        ]

    def _get_address_format(self):
        return (
            self.country_id.address_format
            or self._get_default_address_format()
        )

    @api.depends(
        "partner_id",
        "partner_id.partner_latitude",
        "partner_id.partner_longitude",
        "street",
        "street2",
        "city",
        "zip",
        "state_id",
        "country_id",
    )
    def _compute_customer_geo(self):
        for lead in self:
            partner = lead.partner_id
            if not partner:
                lead.customer_latitude = 0.0
                lead.customer_longitude = 0.0
                continue
            if _lead_address_matches_partner(lead, partner):
                # Address still in sync with partner — mirror partner's geo.
                lead.customer_latitude = partner.partner_latitude
                lead.customer_longitude = partner.partner_longitude
            else:
                # Address diverged — reset to (0, 0) so action_cron_geolocalize
                # picks this lead up for re-geocoding against its own address.
                # Coordinates written directly by Google Places autocomplete are
                # protected from this reset by the is_from_google_maps context
                # guard in crm_google_autocomplete.
                lead.customer_latitude = 0.0
                lead.customer_longitude = 0.0

    @api.model
    def _address_fields(self):
        """Returns the list of address fields that are synced from the parent."""
        return list(ADDRESS_FIELDS)

    @api.model
    def _formatting_address_fields(self):
        """Returns the list of address fields usable to format addresses."""
        return self._address_fields()

    def _get_country_name(self):
        return self.country_id.name or ""

    def _prepare_display_address(self, without_company=False):
        # get the information that will be injected into the display format
        # get the address format
        address_format = self._get_address_format()
        args = defaultdict(
            str,
            {
                "state_code": self.state_id.code or "",
                "state_name": self.state_id.name or "",
                "country_code": self.country_id.code or "",
                "country_name": self._get_country_name(),
            },
        )
        for field in self._formatting_address_fields():
            args[field] = getattr(self, field) or ""
        if without_company:
            args["company_name"] = ""

        return address_format, args

    def _display_address(self, without_company=False):
        """copied from res.partner"""
        address_format, args = self._prepare_display_address(without_company)
        return address_format % args

    @api.depends(lambda self: self._display_address_depends())
    def _compute_customer_address(self):
        for lead in self:
            lead.customer_address = lead._display_address()

    customer_latitude = fields.Float(
        string="Customer latitude",
        digits=(10, 7),
        compute="_compute_customer_geo",
        readonly=False,
        store=True,
    )
    customer_longitude = fields.Float(
        string="Customer longitude",
        digits=(10, 7),
        compute="_compute_customer_geo",
        readonly=False,
        store=True,
    )
    customer_address = fields.Char(
        compute="_compute_customer_address",
        string="Complete Address",
    )

    @api.model
    def _geo_localize(self, street="", zip="", city="", state="", country=""):
        geo_obj = self.env["base.geocoder"]
        search = geo_obj.geo_query_address(
            street=street,
            zip=zip,
            city=city,
            state=state,
            country=country,
        )
        result = geo_obj.geo_find(search, force_country=country)
        if result is None:
            search = geo_obj.geo_query_address(
                city=city, state=state, country=country
            )
            result = geo_obj.geo_find(search, force_country=country)
        return result

    def geo_localize(self):
        lead_not_geo_localized = self.env[self._name]
        for lead in self.with_context(lang="en_US"):
            result = self._geo_localize(
                lead.street,
                lead.zip,
                lead.city,
                lead.state_id.name,
                lead.country_id.name,
            )

            if result:
                lead.write(
                    {
                        "customer_latitude": result[0],
                        "customer_longitude": result[1],
                    }
                )
            else:
                lead_not_geo_localized |= lead
        if lead_not_geo_localized:
            self.env.user._bus_send(
                "simple_notification",
                {
                    "type": "danger",
                    "title": self.env._("Warning"),
                    "message": self.env._(
                        "No match found for %(lead_names)s address(es).",
                        lead_names=", ".join(
                            lead_not_geo_localized.mapped("display_name")
                        ),
                    ),
                },
            )

        return True

    @api.model
    def action_cron_geolocalize(self):
        has_address = Domain.OR(
            [
                Domain("city", "!=", False),
                Domain("zip", "!=", False),
                Domain("street", "!=", False),
                Domain("street2", "!=", False),
            ]
        )
        lead_ids = self.env[self._name].search(
            Domain.AND(
                [
                    Domain("country_id", "!=", False),
                    Domain("customer_latitude", "=", 0.0),
                    Domain("customer_longitude", "=", 0.0),
                    has_address,
                ]
            ),
            limit=80,
        )
        geo_provider_id = self.env["base.geocoder"]._get_provider()
        openstreetmap_provider_id = self.env.ref(
            "base_geolocalize.geoprovider_open_street",
            raise_if_not_found=False,
        )
        is_openstreetmap_provider = (
            openstreetmap_provider_id
            and geo_provider_id
            and geo_provider_id.tech_name
            == openstreetmap_provider_id.tech_name
        )
        # Need to add pause between lead to avoid hitting API rate limits
        for lead in lead_ids:
            try:
                with self.env.cr.savepoint():
                    lead.geo_localize()
            except Exception:
                _logger.warning(
                    "Error geolocalizing lead %s", lead.id, exc_info=True
                )

            if is_openstreetmap_provider:
                time.sleep(
                    1
                )  # Sleep for 1 second between geolocalization calls

        return True
