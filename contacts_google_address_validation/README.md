# Contacts Google Address Validation

## Overview

`contacts_google_address_validation` adds the Google Address Validation API to the Odoo Contact form. It checks whether an entered address refers to a real, deliverable place, standardizes it for mailing, and geocodes it — directly from the Contact form.

## What It Does

Adds a **Validate Address** button below the address block on the Contact form. Clicking it sends the entered address via a server-side POST to the Google Address Validation REST API (`https://addressvalidation.googleapis.com/v1:validateAddress`) and opens a review dialog summarizing the verdict. The user can apply Google's standardized address (including latitude/longitude) or keep the entered address while storing only the validation verdict.

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
4. Configure a dedicated server key (see **API Key Setup** below) and enter it in **Settings → General Settings → Google Maps → Address Validation Server Key**

### Required Google Cloud APIs

- Address Validation API (required)

## API Key Setup

This module calls the Address Validation API **from the Odoo server**, not from the browser. This changes which key restrictions work, so the recommended setup uses **two API keys**, each restricted to match where it runs:

| Key | Used by | Application restriction | API restrictions |
| --- | --- | --- | --- |
| Browser key (`base_google_map`) | Map views, autocomplete widgets (browser) | **Websites** (HTTP referrers) — your Odoo domains | Maps JavaScript API, Places API (New), Geocoding API |
| Server key (this module) | Address Validation (Odoo server) | **IP addresses** — or **None** on hosts without a static IP (see below) | Address Validation API only |

Do **not** reuse the browser key for this module: Google rejects HTTP-referrer restricted keys for server-side requests (`PERMISSION_DENIED`).

### Creating the server key

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), open **APIs & Services → Credentials** and click **Create credentials → API key**
2. Rename it clearly, e.g. *Odoo Address Validation (server)*
3. Under **API restrictions**, select **Restrict key** and check only **Address Validation API**
4. Under **Application restrictions**:
   - **Server with a static IP** (on-premise, VPS): select **IP addresses** and add the server's outbound (egress) IP — verify it from the server itself with `curl ifconfig.me`
   - **Odoo.sh or other hosts without a static IP**: select **None** (see next section)
5. Save, then enter the key in **Settings → General Settings → Google Maps → Address Validation Server Key**

### Hosting without a static IP (Odoo.sh)

Odoo.sh does not provide static IP addresses — the outbound IP of your instance can change at any time, which would break an IP-restricted key. The recommended setup in that case relies on API restrictions plus usage limits instead of an IP allowlist:

1. Create the server key with **Application restrictions: None** and **API restrictions: Address Validation API only** (steps above)
2. Cap the usage: in **APIs & Services → Address Validation API → Quotas**, set a per-day request limit that comfortably covers your real usage (e.g. a few hundred requests per day)
3. Set a billing alert: in **Billing → Budgets & alerts**, create a budget with email alerts so unexpected usage is flagged early

This is safe in practice because the key never reaches the browser — it is stored in Odoo system parameters and used only in server-to-Google requests — and even if it leaked, the API restriction limits it to the Address Validation API, capped by your quota.

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
