from odoo import api, models


class CrmLead(models.Model):
    _name = "crm.lead"
    _inherit = ["crm.lead", "google_map.add_place.mixin"]

    # Override the base mixin's used fields to adapt for crm.lead
    GPLACE_USED_FIELDS = [
        "name",
        "contact_name",
        "street",
        "street2",
        "city",
        "state_id",
        "zip",
        "country_id",
        "customer_latitude",
        "customer_longitude",
        "phone",
        "website",
        "gplace_id",
    ]

    def _get_mapping_odoo_fields(self):
        return {
            "name": "contact_name",
            "street": "street",
            "street2": "street2",
            "city": "city",
            "zip": "zip",
            "state_id": "state_id",
            "country_id": "country_id",
            "lat": "customer_latitude",
            "lng": "customer_longitude",
            "phone": "phone",
            "website": "website",
        }

    @api.model
    def action_in_map_google_place_create(self, place):
        action = super().action_in_map_google_place_create(place)
        # For lead creation, set the opportunity name to "<Place Name>'s opportunity" by default
        if not action.get("res_id") and action.get("context", {}).get(
            "default_gplace_id"
        ):
            #  Set default name
            place_display_name = place.get("displayName")
            field_name = self._get_mapping_odoo_fields().get("name")
            if place_display_name and action["context"].get(
                f"default_{field_name}"
            ):
                name_value = action["context"][f"default_{field_name}"]
                action["context"]["default_name"] = self.env._(
                    "%s's opportunity", name_value
                )
        return action
