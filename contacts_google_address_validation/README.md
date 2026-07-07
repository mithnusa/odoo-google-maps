# Contacts Google Address Validation

## Overview

`contacts_google_address_validation` adds the Google Address Validation API (Maps JavaScript API, `addressValidation` library) to the Odoo Contact form. It checks whether an entered address refers to a real, deliverable place, standardizes it for mailing, and geocodes it — directly from the Contact form.

## What It Does

Adds a **Validate Address** button below the address block on the Contact form. Clicking it sends the entered address to Google's `fetchAddressValidation` method and opens a review dialog summarizing the verdict. The user can apply Google's standardized address (including latitude/longitude) or keep the entered address while storing only the validation verdict.

## Key Features

- **Validate Address Button**: One-click validation of the contact's address; the contact's country is passed as `regionCode` for more accurate results
- **Validation Dialog**: Shows Google's verdict — validation granularity, address completeness, unconfirmed / inferred / replaced components — with a recommendation following Google's accept / confirm / fix guidance
- **Side-by-Side Comparison**: Entered address vs. Google's standardized formatted address
- **Component Breakdown**: Every address component with its confirmation level (Confirmed / Plausible / Suspicious) and inferred / replaced / spell-corrected flags
- **USPS CASS™ for US/PR**: Delivery Point Validation (DPV) confirmation, vacancy and No-Stat indicators, and the CASS-corrected mailing address shown in the dialog; the DPV code is stored in the chatter note
- **Apply Google's Address**: Writes the standardized street, street2, city, state, zip, and country plus the geocode latitude/longitude in a single write; state and country records are resolved server-side
- **Stored Verdict**: Validation status (Validated / Needs Review / Invalid), granularity, validation date, and API response ID are stored on the contact
- **Automatic Reset**: Editing any address field resets the status to Not Validated
- **Search Filters**: Filter contacts by validation status to find unvalidated or problematic addresses

## Dependencies

- `contacts`
- `base_google_map`

## Installation

1. Install `base_google_map` and configure your Google Maps API key in **Settings → General Settings → Google Maps**
2. Enable the **Address Validation API** in your Google Cloud Console
3. Install this module through Odoo Apps

### Required Google Cloud APIs

- Address Validation API (required)

## Basic Usage

1. Open a contact and enter an address
2. Click **Validate Address** below the address block
3. Review the verdict in the dialog:
   - **Apply Google's Address** — replace the entered address with the standardized one and store the verdict
   - **Keep current Address** — store only the verdict
   - **Discard** — close without storing anything
4. The validation badge next to the button reflects the stored status

## Notes

- Address Validation API calls are billed by Google. Each click on **Validate Address** performs one billable request.
- Coverage varies by country. See [Country and region coverage](https://developers.google.com/maps/documentation/javascript/address-validation/coverage).
- USPS CASS™ processing is enabled automatically for US and Puerto Rico addresses. The validation dialog shows the DPV (Delivery Point Validation) confirmation, vacancy and No-Stat indicators, and the CASS-corrected mailing address; the DPV code is also logged in the chatter. The CASS-corrected address itself is displayed only and never stored, per the Google Maps Platform caching terms.

## Related Modules

- `base_google_map`: Provides the API key configuration and Google Maps JavaScript API loader
- `contacts_google_autocomplete`: Google Places autocomplete on the Contact form — complementary; autocomplete helps enter addresses, validation verifies them
