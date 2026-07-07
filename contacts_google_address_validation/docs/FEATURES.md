# Contacts Google Address Validation — Features

## Architecture

- **`google.address.validation` (AbstractModel)** — the single point of contact with the Google Address Validation API (REST):
  - `_get_api_key()` — dedicated server key (`contacts_google_address_validation.api_key`) with fallback to `base_google_map.api_key`; a dedicated key is recommended because referrer-restricted browser keys are rejected server-side
  - `_google_request(payload)` — transport with timeout and per-status error mapping (`PERMISSION_DENIED`, `RESOURCE_EXHAUSTED`, `INVALID_ARGUMENT`, `UNAVAILABLE`) to actionable `UserError`s
  - `validate_address(lines, region_code, enable_usps_cass)` — calls `v1:validateAddress`; CASS is gated to US/PR
  - `_parse_validation(document)` — normalizes the REST response (verdict, components, postalAddress, USPS data, geocode) into the dict the dialog renders
  - `_compute_recommendation(verdict)` — accept / confirm / fix logic (prefers the API's `possibleNextAction`)
- **Thin OWL widget** — no API logic in JavaScript; the API key never reaches the browser; the Maps JS loader is no longer needed by this module

## Validation Flow

- **Validate Address button** on the Contact form, rendered by the `google_address_validation` view widget placed after the address block
- Pending form edits are saved automatically before validation so the stored verdict always matches the validated address
- The address request is built server-side from `street`, `street2`, and a combined `city + state + zip` line; the contact's country code is sent as `regionCode`
- Coverage guard: unsupported countries are rejected server-side (and the widget disables itself client-side using the same coverage list)

## Validation Dialog

- **Recommendation banner** (accept / confirm / fix) computed from the API verdict; uses the API's `possibleNextAction` field when available, with a documented heuristic fallback
- **Verdict badges**: address completeness, validation granularity, unconfirmed / inferred / replaced component flags
- **Entered vs. standardized address** side-by-side comparison
- **Component table** listing each address component with its confirmation level (Confirmed / Plausible / Suspicious) and inferred / replaced / spell-corrected markers
- Three actions: **Apply Google's Address**, **Keep current Address** (verdict only), **Discard** (no write)

## Data Model (`res.partner`)

| Field | Type | Description |
| --- | --- | --- |
| `google_address_validation_status` | Selection | `not_validated` / `valid` / `needs_review` / `invalid` |
| `google_address_validation_granularity` | Selection | Google `Granularity` enum value (`SUB_PREMISE` … `OTHER`) |
| `google_address_validation_date` | Datetime | When the address was last validated |
| `google_address_validation_response_id` | Char | API `responseId` of the validation request |

- All fields are readonly and `copy=False`
- A `write` override resets the verdict whenever an address field (`street`, `street2`, `city`, `zip`, `state_id`, `country_id`) changes outside the validation flow

## Applying the Standardized Address

- Standardized values come from the response `postalAddress` (address lines, locality, administrative area, postal code, region code)
- `state_id` and `country_id` are resolved server-side by `_prepare_google_validated_address` (country by ISO code, state by code or name within the country)
- Geocode latitude/longitude from the response is written to `partner_latitude` / `partner_longitude`
- Address, geolocation, and verdict are written in a single `write` call

## Status Mapping

| Recommendation | Stored status |
| --- | --- |
| ACCEPT | `valid` (Validated) |
| CONFIRM | `needs_review` (Needs Review) |
| FIX | `invalid` (Invalid) |

## Search & Filtering

- Search filters on the Contacts view: Address Validated, Address Needs Review, Address Invalid, Address Not Validated

## Limitations / Roadmap

- Only `res.partner` is covered; a generic reusable widget for other models is a candidate follow-up module
- No automatic validation on save — validation is always user-initiated (each request is billable)
