import re

from bs4 import BeautifulSoup
from odoo import _, api, fields, models
from odoo.fields import Domain


GOOGLE_PLACES_COMPONENT_FORM = {
    "street_number": "longText",
    "route": "longText",
    "intersection": "shortText",
    "political": "shortText",
    "country": "shortText",
    "administrative_area_level_1": "shortText",
    "administrative_area_level_2": "shortText",
    "administrative_area_level_3": "shortText",
    "administrative_area_level_4": "shortText",
    "administrative_area_level_5": "shortText",
    "colloquial_area": "shortText",
    "locality": "shortText",
    "ward": "shortText",
    "sublocality_level_1": "shortText",
    "sublocality_level_2": "shortText",
    "sublocality_level_3": "shortText",
    "sublocality_level_4": "shortText",
    "sublocality_level_5": "shortText",
    "neighborhood": "shortText",
    "premise": "shortText",
    "postal_code": "shortText",
    "natural_feature": "shortText",
    "airport": "shortText",
    "park": "shortText",
    "point_of_interest": "longText",
}


class GoogleMapAddPlaceMixin(models.AbstractModel):
    _name = "google_map.add_place.mixin"
    _description = "Google Map Add Place Mixin"

    GPLACE_USED_FIELDS = [
        "name",
        "street",
        "street2",
        "city",
        "zip",
        "state_id",
        "country_id",
        "partner_latitude",
        "partner_longitude",
        "phone",
        "website",
        "gplace_id",
    ]

    GPLACE_ADDRESS_FIELDS_MAPPINGS = {
        "street": ["route", "street_number"],
        "street2": [
            "administrative_area_level_3",
            "administrative_area_level_4",
            "administrative_area_level_5",
        ],
        "city": ["locality", "administrative_area_level_2"],
        "zip": ["postal_code"],
        "state_id": ["administrative_area_level_1"],
        "country_id": ["country"],
    }

    gplace_id = fields.Char(
        string="Google Place ID",
        help="The unique identifier for the place in Google Maps. This is used to link the record to a specific location on the map.",
        index=True,
        copy=False,
    )

    def _get_mapping_odoo_fields(self):
        """Return a mapping of alias keys to actual Odoo field names on res.partner.

        Used by the place-creation methods to resolve which Odoo field should
        receive each piece of data returned by the Google Places API.

        :return: dict mapping alias (str) -> Odoo field name (str)
        """
        return {
            "name": "name",
            "street": "street",
            "street2": "street2",
            "city": "city",
            "zip": "zip",
            "state_id": "state_id",
            "country_id": "country_id",
            "lat": "partner_latitude",
            "lng": "partner_longitude",
            "phone": "phone",
            "website": "website",
        }

    def _prepare_geolocation_fields(self, odoo_fields, location_dict):
        """Build a dict of geolocation field values from a Google location dict.

        Only populates values when both the field mapping and the location data
        contain valid lat/lng entries.

        :param odoo_fields: dict returned by :meth:`_get_mapping_odoo_fields`
        :param location_dict: dict with ``lat`` and ``lng`` float values,
            as returned by the Google Places API ``location`` field
        :return: dict mapping Odoo field names to their float coordinate values,
            or an empty dict if coordinates are missing
        """
        values = {}
        lat_field = odoo_fields.get("lat")
        lng_field = odoo_fields.get("lng")
        lat = location_dict.get("lat")
        lng = location_dict.get("lng")
        if (
            lat_field
            and lng_field
            and isinstance(lat, (int, float))
            and isinstance(lng, (int, float))
        ):
            values[lat_field] = lat
            values[lng_field] = lng
        return values

    def _mapping_address(
        self,
        address_components,
        adr_format_address,
        field_mapping=None,
    ):
        """Map Google Places address components to Odoo partner address fields.

        Builds a flat address dict by:

        1. Extracting each component type defined in field_mapping from the
           Google addressComponents list.
        2. Falling back to parsed adrFormatAddress values for city, zip,
           country, state, street, and street2 when components are absent.
        3. Resolving country_id and state_id to their Odoo record IDs
           via case-insensitive searches on code and name.

        Street and street2 from adrFormatAddress take final priority over
        component-derived values, as they tend to contain better-formatted
        data (e.g. correct number-before-street order).

        :param address_components: list of Google address component dicts,
            each with types, longText, and shortText keys
        :param adr_format_address: dict of parsed adr microformat components,
            as returned by :meth:`_parse_adr_format_address`
        :param field_mapping: dict mapping Odoo field names to ordered lists of
            Google component type keys; defaults to ADDRESS_FIELDS_MAPPING
        :return: dict of Odoo field name -> value, ready for write/context
        """
        component_lookup = {}
        for component in address_components:
            for t in component.get("types") or []:
                component_lookup.setdefault(t, component)

        old_type_keys = {
            "shortText": "short_name",
            "longText": "long_name",
        }

        if field_mapping is None:
            field_mapping = self.GPLACE_ADDRESS_FIELDS_MAPPINGS

        values = {}
        for field, mapping in field_mapping.items():
            parts = []
            for type_key in mapping:  # Follow mapping order
                component = component_lookup.get(type_key)
                if component:
                    name_form = GOOGLE_PLACES_COMPONENT_FORM.get(type_key, "longText")
                    value = component.get(name_form)
                    if not value:
                        value = component.get(
                            old_type_keys.get(name_form, "short_name")
                        )  # Fallback for old API versions
                    parts.append(value)
            if parts:
                values[field] = parts

        street_delimiter = {"street": " ", "street2": ", "}
        address = {}
        for key, val in values.items():
            vals = list(filter(None, val))
            if not vals:
                address[key] = False
                continue

            if key == "city":
                address[key] = vals[0]
            elif key in ["state_id", "country_id", "zip"]:
                address[key] = vals[-1]
            else:
                fields_delimeter = street_delimiter.get(key, " ")
                address[key] = fields_delimeter.join(vals)

        if not address.get("city") and adr_format_address.get("locality"):
            address["city"] = adr_format_address["locality"]

        if not address.get("zip") and adr_format_address.get("postal-code"):
            address["zip"] = adr_format_address["postal-code"]

        if not address.get("country_id") and adr_format_address.get("country"):
            address["country_id"] = adr_format_address["country"]

        if not address.get("state_id") and adr_format_address.get("region"):
            address["state_id"] = adr_format_address["region"]

        # Resolve country_id: Google returns short_name (ISO 2-letter code)
        country_id = False
        if address.get("country_id"):
            country_domain = Domain.OR(
                [
                    Domain("code", "=ilike", address["country_id"]),
                    Domain("name", "=ilike", address["country_id"]),
                ]
            )
            country_id = self.env["res.country"].sudo().search(country_domain, limit=1)
            address["country_id"] = country_id.id if country_id else False

        # Resolve state_id: search by name within the resolved country
        if address.get("state_id"):
            state_domain = Domain.OR(
                [
                    Domain("name", "=ilike", address["state_id"]),
                    Domain("code", "=ilike", address["state_id"]),
                ]
            )
            if country_id:
                state_domain = Domain.AND(
                    [state_domain, Domain("country_id", "=", country_id.id)]
                )
            state_id = (
                self.env["res.country.state"].sudo().search(state_domain, limit=1)
            )
            address["state_id"] = state_id.id if state_id else False

        # Prioritize using street and street2 from adrFormatAddress if available, as it may contain more complete information than the component mapping
        # Also fix the route_street and number formatting issue, e.g. route: "Ihimaera Terrace", street_number: "33" should be combined to "33 Ihimaera Terrace"
        if adr_format_address.get("street-address"):
            address["street"] = adr_format_address["street-address"]
        if adr_format_address.get("extended-address"):
            address["street2"] = adr_format_address["extended-address"]

        return address

    @api.model
    def action_in_map_google_place_create(self, place):
        """Create a new partner pre-filled from a Google Places API result.

        If a partner with the same gplace_id already exists, opens that
        record in a popup form instead of creating a duplicate.

        Otherwise, maps the place data (name, website, phone, address,
        coordinates) to Odoo partner fields and opens a new partner form
        pre-populated via context defaults, allowing the user to review and
        save the record.

        :param place: dict from the Google Places API (New) containing any of:

            - placeId (str): unique Google Place identifier
            - displayName (str): place name
            - websiteURI (str): place website, must start with http/https
            - internationalPhoneNumber (str): E.164 formatted phone number
            - addressComponents (list): structured address components
            - adrFormatAddress (str): HTML adr microformat address string
            - location (dict): lat and lng float coordinates
        :return: ir.actions.act_window action opening a partner form in a
            popup (target: "new"), either for the existing or a new record
        """
        place_id = place.get("placeId")
        if place_id:
            record_id = self.env[self._name].search(
                [("gplace_id", "=", place_id)], limit=1
            )
            if record_id:
                model_description = self.env[self._name]._description or _("Record")
                return {
                    "type": "ir.actions.act_window",
                    "name": _("%s exists: %s", model_description, record_id.display_name),
                    "res_model": self._name,
                    "view_mode": "form",
                    "view_id": False,
                    "views": [(False, "form")],
                    "target": "new",
                    "res_id": record_id.id,
                }

        values = self.default_get(self.GPLACE_USED_FIELDS)
        address_components = place.get("addressComponents")
        location = place.get("location") or {}

        odoo_fields = self._get_mapping_odoo_fields()
        place_display_name = place.get("displayName")
        if (
            odoo_fields.get("name")
            and place_display_name
            and isinstance(place_display_name, str)
        ):
            values[odoo_fields["name"]] = place_display_name

        place_website = place.get("websiteURI")
        if (
            odoo_fields.get("website")
            and place_website
            and isinstance(place_website, str)
            and place_website.startswith(("http://", "https://"))
        ):
            values[odoo_fields["website"]] = place_website

        place_phone = place.get("internationalPhoneNumber")
        if odoo_fields.get("phone") and place_phone and isinstance(place_phone, str):
            values[odoo_fields["phone"]] = place_phone

        # address
        if address_components:
            adr_format_address = place.get("adrFormatAddress")
            adr_components = self._parse_adr_format_address(adr_format_address)
            address_values = self._mapping_address(address_components, adr_components)
            values.update(address_values)

        # geolocation
        if location:
            geo_values = self._prepare_geolocation_fields(odoo_fields, location)
            values.update(geo_values)

        default_values = {}
        for key, val in values.items():
            default_values["default_{}".format(key)] = val

        if place_id:
            default_values["default_gplace_id"] = place_id

        model_description = self.env[self._name]._description or _("Record")
        return {
            "type": "ir.actions.act_window",
            "name": _("New %s", model_description),
            "res_model": self._name,
            "view_mode": "form",
            "view_id": False,
            "views": [(False, "form")],
            "target": "new",
            "context": dict(self.env.context, **default_values),
        }

    @api.model
    def action_in_map_google_place_from_reverse_geocode(self, geocoding):
        """Create a new partner pre-filled from a Google Geocoding API result.

        Intended for use with reverse geocoding (coordinate → address), where
        a full Places API result is not available. Follows the same
        deduplication and form-opening logic as
        :meth:`action_in_map_google_place_create`.

        Address parsing falls back to :meth:`_parse_formatted_address` instead
        of the richer adr microformat, since geocoding responses do not include
        adrFormatAddress.

        :param geocoding: dict from the Google Geocoding API containing any of:

            - place_id (str): unique Google Place identifier
            - address_components (list): structured address components
            - formatted_address (str): plain-text full address string
            - geometry (dict): with a nested location dict holding
              lat and lng float values
        :return: ir.actions.act_window action opening a partner form in a
            popup (target: "new"), either for the existing or a new record
        """
        place_id = geocoding.get("place_id")
        model_description = self.env[self._name]._description or _("Record")
        if place_id:
            record_id = self.env[self._name].search(
                [("gplace_id", "=", place_id)], limit=1
            )
            if record_id:
                return {
                    "type": "ir.actions.act_window",
                    "name": _("%s exists: %s", model_description, record_id.display_name),
                    "res_model": self._name,
                    "view_mode": "form",
                    "view_id": False,
                    "views": [(False, "form")],
                    "target": "new",
                    "res_id": record_id.id,
                }

        values = self.default_get(self.GPLACE_USED_FIELDS)
        address_components = geocoding.get("address_components")
        location = geocoding.get("geometry", {}).get("location", {})
        formatted_address = geocoding.get("formatted_address")
        odoo_fields = self._get_mapping_odoo_fields()
        # address
        if address_components:
            adr_components = self._parse_formatted_address(formatted_address)
            address_values = self._mapping_address(address_components, adr_components)
            values.update(address_values)

        # geolocation
        if location:
            geo_values = self._prepare_geolocation_fields(odoo_fields, location)
            values.update(geo_values)

        default_values = {}
        for key, val in values.items():
            default_values["default_{}".format(key)] = val

        if place_id:
            default_values["default_gplace_id"] = place_id

        return {
            "type": "ir.actions.act_window",
            "name": _("Reverse Geocoded Location"),
            "res_model": self._name,
            "view_mode": "form",
            "view_id": False,
            "views": [(False, "form")],
            "target": "new",
            "context": dict(self.env.context, **default_values),
        }

    @api.model
    def _parse_adr_format_address(self, adr_format_address):
        """Parse a Google Places adrFormatAddress HTML string into a flat dict.

        The adrFormatAddress field uses the adr microformat: each address
        component is wrapped in a <span> whose class attribute identifies
        the component type, e.g.::

            <span class="street-address">33 Ihimaera Terrace</span>,
            <span class="postal-code">3432</span>
            <span class="locality">Leamington</span>,
            <span class="country">New Zealand</span>

        :param adr_format_address: HTML string from the Google Places API
            adrFormatAddress field, or None/empty
        :return: dict mapping span class names to their text content,
            e.g. {"street-address": "33 Ihimaera Terrace", "locality": "Leamington", ...},
            or an empty dict if the input is falsy
        """
        if not adr_format_address:
            return {}

        soup = BeautifulSoup(adr_format_address, "html.parser")
        components = {}
        for span in soup.find_all("span"):
            class_name = span.get("class", [None])[0]  # Get the first class name
            if class_name:
                components[class_name] = span.get_text(strip=True)

        return components

    @api.model
    def _parse_formatted_address(self, formatted_address):
        """Parse a plain-text Google formatted_address string into a flat dict.

        Fallback parser used by reverse geocoding results, which do not provide
        an adrFormatAddress HTML string. Splits the address on commas and
        heuristically extracts street, locality, postal code, country, region,
        and extended address based on the number of segments.

        Three structural patterns are handled:

        **Standard short** (3 segments)::

            "33 Ihimaera Terrace, Leamington 3432, New Zealand"
            → street-address: "33 Ihimaera Terrace"
            → locality:       "Leamington"
            → postal-code:    "3432"
            → country:        "New Zealand"

        **Standard long** (4+ segments, last segment is not all digits)::

            "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA"
            → street-address: "1600 Amphitheatre Pkwy"
            → locality:       "Mountain View"
            → region:         "CA"
            → postal-code:    "94043"
            → country:        "USA"

        **Russian/CIS style** (any length, last segment is all digits)::

            "ул. Ленина 5, кв. 10, Москва, Россия, 123456"
            → street-address: "ул. Ленина 5, кв. 10"
            → locality:       "Москва"
            → country:        "Россия"
            → postal-code:    "123456"

        .. note::
            Postal codes are matched by anchored alphanumeric patterns covering
            UK (e.g. SW1A 2AA), Canada (e.g. K1A 0B1), Netherlands (e.g. 1234 AB),
            and Ireland (e.g. D01 F5P2), with a digit-only fallback (\\d{3,10})
            for all other locales. Alphanumeric codes without a space separator
            (e.g. Eircode without space) may not be extracted.

        :param formatted_address: plain-text address string from the Google
            Geocoding API formatted_address field, or None/empty
        :return: dict with any subset of the keys street-address,
            locality, postal-code, country, region,
            extended-address; or an empty dict if the input is falsy
        """
        if not formatted_address:
            return {}

        parts = [p.strip() for p in formatted_address.split(",")]
        n = len(parts)
        components = {}

        if n == 0:
            return components

        components["street-address"] = parts[0]

        if n < 2:
            return components

        # Russian/CIS style: last segment is a pure-digit postal code.
        # e.g. "ул. Ленина 5, кв. 10, Москва, Россия, 123456"
        if re.fullmatch(r"\d+", parts[-1]):
            components["postal-code"] = parts[-1]
            if n >= 3:
                components["country"] = parts[-2]
            if n >= 4:
                components["locality"] = parts[-3]
            if n >= 5:
                components["street-address"] = ", ".join(parts[: n - 3])
            return components

        # Standard format: last segment is the country name.
        components["country"] = parts[-1]

        if n == 2:
            return components

        # Extract an optional digit-only postal code from a segment such as
        # "Leamington 3432" or "CA 94043", leaving the non-digit remainder as
        # the city/region name.
        def _split_zip(segment):
            # Try alphanumeric postal codes anchored to the end of the segment.
            # Covers the most common international formats before falling back
            # to the original digit-only pattern.
            _ALPHANUMERIC_POSTAL_RE = re.compile(
                r"\s+("
                r"[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}"  # UK:          SW1A 2AA, M1 1AE
                r"|[A-Z]\d[A-Z]\s?\d[A-Z]\d"  # Canada:      K1A 0B1
                r"|\d{4}\s?[A-Z]{2}"  # Netherlands: 1234 AB
                r"|[A-Z\d]{2,4}\s[A-Z\d]{3,4}"  # Ireland:     D01 F5P2
                r")$",
                re.IGNORECASE,
            )
            match = _ALPHANUMERIC_POSTAL_RE.search(segment)
            if match:
                return segment[: match.start()].strip(), match.group(1).strip()
            # Fallback: numeric postal code anywhere in the segment
            match = re.search(r"\b(\d{3,10})\b", segment)
            if match:
                name = (
                    segment[: match.start()].strip() or segment[match.end() :].strip()
                )
                return name, match.group(1)
            return segment, None

        if n == 3:
            # "street, city [zip], country"
            city, postal_code = _split_zip(parts[1])
            components["locality"] = city
            if postal_code:
                components["postal-code"] = postal_code

        else:
            # 4+ segments: "street, [extras...,] city, state/region [zip], country"
            # parts[-2] holds state/region and optional zip; parts[-3] is the city.
            region_name, postal_code = _split_zip(parts[-2])
            components["locality"] = parts[-3]
            if postal_code:
                components["postal-code"] = postal_code
            if region_name:
                components["region"] = region_name
            if n > 4:
                components["extended-address"] = ", ".join(parts[1 : n - 3])

        return components
