# Web Widget Google Place Autocomplete

## Overview

This module provides the `gplace_autocomplete_el` widget and the Google Places Mapping configuration system. It connects Google's Places API (New) to any Odoo form field, automatically populating address, geolocation, and other fields when a user selects a place from the autocomplete suggestions.

## What It Does

Adds a configurable autocomplete widget that can be applied to any Char field in any Odoo form view. When a user types in the field, Google Places suggestions appear. Selecting one populates other fields on the record — street, city, state, zip, country, latitude, longitude, phone, website, or any other mapped field — in a single atomic write. Which fields get populated, and how, is controlled by a mapping configuration stored in Odoo.

## Key Features

- **`gplace_autocomplete_el` Widget**: Extends the standard Char field with a Google Places autocomplete panel that opens on demand
- **Two Autocomplete Modes**: `places` mode returns businesses and landmarks; `address` mode is restricted to street addresses and routes only
- **Google Places Mapping Configuration**: A dedicated configuration model defines how Google Places API data maps to Odoo model fields — per model, per mode
- **Address and Other Field Mapping**: Maps address components and non-address place data (phone, website, etc.) to any Odoo fields
- **Geolocation Storage**: Each mapping designates which Float fields receive the selected place's latitude and longitude
- **Country Street Format**: Controls whether addresses are formatted as "Route + Number" or "Number + Route" per country
- **No Manual Edit Mode**: An optional `no_manual_edit` option makes the input read-only, requiring users to select from suggestions
- **Mapping Test Tool**: Built-in test on the mapping form lets administrators verify what data will be returned before deploying
- **Quick Access Button**: Shortcut button next to the autocomplete field opens the mapping configuration (visible to Technical Feature users)

## Dependencies

- `base_google_map`

## Related Modules

- `base_google_map`: Provides the API key configuration and Google Maps JavaScript API loader
- `contacts_google_autocomplete`: Applies the widget to the Contact form with a pre-configured `res.partner` mapping
- `crm_google_autocomplete`: Applies the widget to the Lead form with a pre-configured `crm.lead` mapping

---

## Mapping System: How It Works

The mapping system is the core of this module. It is entirely driven by configuration — no code changes are needed to adapt the widget to any model or any set of Google Places data.

### Model and Mode

Each mapping record targets a specific Odoo model and one autocomplete mode:

- **`places` mode** — returns any Google Place: businesses, landmarks, points of interest, addresses
- **`address` mode** — restricts suggestions to street addresses and routes only

One model can have multiple mapping records with different modes (e.g. one for company name lookup in `places` mode, another for street field in `address` mode).

### Address Component Mapping

The **Address Mapping** section maps Google address components to Odoo fields. Each line specifies:

| Setting | Options | Description |
| --- | --- | --- |
| **Google Address Component** | Any list of Google component types | e.g. `['route', 'street_number']`, `['locality']`, `['postal_code']` |
| **Text Option** | `shortText` / `longText` | Whether to use the abbreviated or full form of the value (e.g. "CA" vs "California") |
| **Handling Mode** | `direct` / `fallback` / `concat` | Controls how multiple components in the list are resolved |
| **Separator** | Space, Comma, Hyphen, Underscore, Slash, New Line | Used when joining components in `concat` mode |
| **Odoo Field** | Any stored, writable Char, Text, Many2one, or Many2many field | The field to write the resolved value into |

**Handling modes explained:**

- **Direct** — takes a single component and writes its value directly. Use for unambiguous components like `postal_code`.
- **Fallback** — tries each component in the list in order and uses the first one that has a value. Useful for city-level fields where the component name varies by country (e.g. try `locality` first, fall back to `administrative_area_level_2`).
- **Concatenate** — joins all available components with the configured separator. The standard use case is building a street string from `['route', 'street_number']` or `['street_number', 'route']` depending on the country's street format.

**Relational field resolution** — when the target field is a `Many2one` pointing to `res.country` or `res.country.state`, the widget automatically looks up the record by name instead of writing a raw string.

### Other Field Mapping

The **Other Mapping** section maps any top-level Google Places API property — beyond address components — directly to an Odoo field. Each line specifies a Google Places property name and an Odoo field to receive its value.

Common properties available in `places` mode:

| Google Property | Typical Use |
| --- | --- |
| `displayName` | Business or place name |
| `internationalPhoneNumber` | Phone number in international format |
| `websiteURI` | Website URL |
| `nationalPhoneNumber` | Local phone number format |
| `formattedAddress` | Full formatted address as a single string |
| `businessStatus` | Whether the place is open, closed, etc. |

The Odoo field can be Char, Text, Many2one, Many2many, Integer, or Float — giving full flexibility to store any scalar value from the API response.

### Geolocation Fields

Two dedicated fields on the mapping record designate which Float fields on the target model receive the selected place's `latitude` and `longitude`. These are written in the same atomic update as all other mapped fields.

### Fetch Field Control

The `gplace_place_fetch_fields` and `gplace_address_fetch_fields` settings control which Google Places API data fields are requested. Limiting fetched fields to only what is needed reduces API costs. For example, an address-only mapping typically needs only `['addressComponents', 'location']`, while a business lookup may also need `['displayName', 'internationalPhoneNumber', 'websiteURI']`.

### PlaceAutocompleteElement Options

The `gplace_options` setting on the mapping record is passed directly to Google's `PlaceAutocompleteElement` constructor. This allows fine-grained control over suggestion filtering, for example:

```python
# Restrict to street addresses and routes only
{'includedPrimaryTypes': ['route', 'street_address']}

# Restrict suggestions to a specific country
{'componentRestrictions': {'country': 'id'}}

# Restrict to a specific region bias
{'locationBias': {'center': {'lat': -6.2, 'lng': 106.8}, 'radius': 50000}}
```

Refer to the [Google Places Autocomplete documentation](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete#supported-parameters) for the full list of available options.

### Mapping Validation

The system enforces consistency at save time:

- A field may not appear in both the Address and Other mapping sections of the same configuration
- `direct` handling mode requires exactly one component; `fallback` and `concat` require at least two
- `text_option` is validated against the field type
- Fetch fields and options are validated as proper JSON/Python literals

### Built-In Test Tool

Every mapping configuration form includes a live test tool that lets you verify, debug, and refine your mapping without leaving the configuration page or touching any real record.

**How to use it:**

1. Open (or create) a mapping record in `Settings > Technical > Google Places Mapping`
2. Scroll to the **Test** section at the bottom of the form
3. Type a place or address into the live autocomplete input — it uses the exact same `mode`, `options`, and `fetch fields` configured on the current record
4. Select a suggestion from the dropdown
5. A result dialog opens immediately, showing four sections:

| Section | What it shows |
| --- | --- |
| **Address** | The parsed values that would be written to each address-mapped Odoo field |
| **Other** | The parsed values for other-mapped fields (phone, website, etc.) — visible in `places` mode only |
| **Geolocation** | The `latitude` and `longitude` values that would be stored |
| **Google Place JSON** | The raw, complete response object returned by the Google Places API for the selected place |

The **Google Place JSON** panel is especially useful for discovering which properties are available for a given place type, so you can decide what to add to your Other Field Mapping.

If you make changes to the mapping configuration and want to re-run the test against the updated settings, use the **Reload** button below the autocomplete input to reinitialize the widget with the latest saved values.

> **Note**: The test tool always reflects the last **saved** state of the mapping record. Save your changes before reloading the test if you want to verify the updated configuration.

---

## Widget: gplace_autocomplete_el

This module introduces a new widget named `gplace_autocomplete_el` that leverages the latest Google Places API for enhanced autocomplete functionality.

### Prerequisites

Before using the widget, ensure you have:

1. Google Maps API key with Places API (New) enabled
2. At least one mapping configuration created in `Settings > Technical > Google Places Mapping`

**Reference Examples**: Check the `contacts_google_autocomplete` or `crm_google_autocomplete` modules for pre-configured mapping examples.

### Usage

To use the widget in your form views, you can configure it using the following options:

#### Option 1: Using Mapping Code (Recommended)

The `mapping_code` is the unique identifier of your mapping configuration. This option takes priority over `mapping_mode`.

```xml
<record id="view_form_your_model" model="ir.ui.view">
  <field name="name">your.model.form</field>
  <field name="model">your.model</field>
  <field name="arch" type="xml">
    <form>
      ...
      <field name="your_field_name" widget="gplace_autocomplete_el"
             options="{'mapping_code': 'your_mapping_code'}"/>
      ...
    </form>
    </field>
</record>
```

#### Option 2: Using Mapping Mode

There are two available mapping modes:

- **`places`**: General places autocomplete (businesses, landmarks, addresses)
- **`address`**: Restricted to street addresses only

```xml
<record id="view_form_your_model" model="ir.ui.view">
  <field name="name">your.model.form</field>
  <field name="model">your.model</field>
  <field name="arch" type="xml">
    <form>
      ...
      <field name="your_field_name" widget="gplace_autocomplete_el"
             options="{'mapping_mode': 'address'}"/>
      ...
    </form>
    </field>
</record>
```

#### Option 3: Disable Manual Edit

By default, users can freely type in the autocomplete field. Set `no_manual_edit` to `True` to make the input read-only, so data can only be populated through a Google Places suggestion. All mapped fields are still filled as usual when a suggestion is selected.

```xml
<record id="view_form_your_model" model="ir.ui.view">
  <field name="name">your.model.form</field>
  <field name="model">your.model</field>
  <field name="arch" type="xml">
    <form>
      ...
      <field name="your_field_name" widget="gplace_autocomplete_el"
             options="{'mapping_mode': 'address', 'no_manual_edit': True}"/>
      ...
    </form>
  </field>
</record>
```

### Configuration Options

1. Autocomplete Options (optional)
The widget behavior can be customized using Google Places Autocomplete options. These options are configured in the mapping configuration and control the autocomplete element initialization.
Please check this document [Google Places Autocomplete documentation](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete#supported-parameters) for more details.

**Example**: For address-only results, configure your mapping with:
```python
{'includedPrimaryTypes': ['route', 'street_address']}
```

2. Fields Property (mandatory)
It's recommended to define the `fields` property in your mapping configuration to specify which Google Places fields to retrieve. This optimizes performance by limiting data retrieval to only necessary fields.
Use the fields property wisely as it affects the cost of API usage.
Please check this document [Place Fields documentation](https://developers.google.com/maps/documentation/javascript/place-class-data-fields) for more details.

**Example**: To retrieve only location (geolocation) and address, configure your mapping with:
```python
['location', 'addressComponents']
```

### Street Formatting

Countries include a "Street Format" field (`google_street_format`) to control how street addresses are formatted:

- **`route_street_number`** (default): Route name followed by street number (e.g., "Main Street 123")
- **`street_number_route`**: Street number followed by route name (e.g., "123 Main Street")

Configure this in `Contacts > Configuration > Countries` for each country.


## Installation & Configuration

### Step 1: Google Cloud Platform Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - **Places API (New)** - Required for the new widget
   - **Maps JavaScript API** - Required for map display
   - **Geocoding API** - Optional, for additional geocoding features
3. Create or use an existing API key with the above APIs enabled

### Step 2: Odoo Configuration

1. Install the `web_widget_google_place_autocomplete` module
2. Go to `Settings > General Settings > Google Maps`
3. Configure your Google Maps API key
4. Save the configuration

### Step 3: Create Mapping Configuration

1. Go to `Settings > Technical > Google Places Mapping`
2. Create a new mapping configuration:
   - **Name**: Descriptive name for your mapping
   - **Model**: Target Odoo model (e.g., `res.partner`, `crm.lead`)
   - **Mapping Mode**: Choose `address` or `places`
   - **Field Mappings**: Map Google Places fields to Odoo model fields.
      There are two sections:
      - **Address Mapping**: For general address fields
      - **Other**: For any fields outside of the address scope
3. Use the Section test to test your mapping configuration

### Step 4: Apply Widget to Forms

Add the widget to your form views using one of the methods described in the [Usage](#usage) section.

## Examples

### Example 1: Using Mapping Code on inherited form view

```xml
<record id="view_partner_form_custom" model="ir.ui.view">
  <field name="name">res.partner.form.custom</field>
  <field name="model">res.partner</field>
  <field name="inherit_id" ref="base.view_partner_form"/>
  <field name="arch" type="xml">
    <field name="street" position="attributes">
      <attribute name="widget">gplace_autocomplete_el</attribute>
      <attribute name="options">{'mapping_code': 'ibSbbpMF'}</attribute>
    </field>
  </field>
</record>
```

### Example 2: Using Mapping Mode on inherited form view

```xml
<record id="view_crm_lead_form_custom" model="ir.ui.view">
  <field name="name">crm.lead.form.custom</field>
  <field name="model">crm.lead</field>
  <field name="inherit_id" ref="crm.crm_lead_view_form"/>
  <field name="arch" type="xml">
    <field name="street" position="attributes">
      <attribute name="widget">gplace_autocomplete_el</attribute>
      <attribute name="options">{'mapping_mode': 'address'}</attribute>
    </field>
  </field>
</record>
```

## Troubleshooting

### Widget Not Showing Autocomplete Suggestions

**Possible causes:**
- Google API key not configured or invalid
- Places API (New) not enabled in Google Cloud Console
- API key restrictions blocking requests
- Network/firewall blocking Google APIs

**Solution:**
1. Check API key configuration in `Settings > General Settings`
2. Verify Places API (New) is enabled in Google Cloud Console
3. Check browser console for API errors
4. Verify API key has no IP/domain restrictions preventing access

### Fields Not Populating After Selection

**Possible causes:**
- Mapping configuration not properly set up
- Field names in mapping don't match model fields
- Country-specific mapping missing

**Solution:**
1. Go to `Settings > Technical > Google Places Mapping`
2. Verify your mapping configuration exists and is active
3. Use the "Test Mapping" feature to verify field mappings
4. Check that mapped field names exactly match your model's field names
5. Ensure country-specific mappings are configured for target countries

### Incorrect Street Formatting

**Possible causes:**
- Country street format not configured
- Using default formatting when country-specific format is needed

**Solution:**
1. Go to `Contacts > Configuration > Countries`
2. Find the target country
3. Set the "Street Format" field to the appropriate value:
   - `route_street_number` for "Street Name Number"
   - `street_number_route` for "Number Street Name"

### Quick Access Button Not Visible

**Possible causes:**
- User doesn't have technical features enabled
- Widget options not properly configured

**Solution:**
1. Enable "Technical Features" for your user in `Settings > Users & Companies > Users`
2. Verify the widget is properly configured with a valid `mapping_code` or `mapping_mode`
